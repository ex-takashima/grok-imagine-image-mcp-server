/**
 * Edit image tool - Edit images using xAI Grok Imagine
 * Uses /v1/images/edits endpoint
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  saveBase64Image,
  downloadAndSaveImage,
  generateThumbnailData,
  isThumbnailEnabled,
  createThumbnailContent,
} from '../utils/image.js';
import {
  normalizeAndValidatePath,
  getDisplayPath,
  generateUniqueFilePath,
} from '../utils/path.js';
import { debugLog } from '../utils/debug.js';
import type { EditImageParams, XAIImageResponse } from '../types/tools.js';
import { RESOLUTIONS, MODELS } from '../types/tools.js';

// Edit endpoint is different from generation endpoint
const XAI_EDIT_ENDPOINT = 'https://api.x.ai/v1/images/edits';

export async function editImage(
  apiKey: string,
  params: EditImageParams
): Promise<
  | string
  | {
      content: Array<{
        type: string;
        text?: string;
        data?: string;
        mimeType?: string;
      }>;
    }
> {
  debugLog('Edit image called with params:', {
    ...params,
    image_base64: params.image_base64 ? '[REDACTED]' : undefined,
  });

  const {
    prompt,
    image_path,
    image_base64,
    image_url,
    output_path = 'edited_image.jpg',
    model = 'grok-imagine-image',
    n = 1,
    resolution = '1k',
    response_format = 'b64_json',
    return_base64 = false,
    include_thumbnail,
  } = params;

  // Validate that at least one image source is provided
  if (!image_path && !image_base64 && !image_url) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'One of image_path, image_base64, or image_url is required'
    );
  }

  // Normalize and validate output path
  let normalizedPath = await normalizeAndValidatePath(output_path);
  normalizedPath = await generateUniqueFilePath(normalizedPath);

  // Validation
  if (!prompt || prompt.trim().length === 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Prompt is required and cannot be empty'
    );
  }

  if (!MODELS.includes(model as any)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid model: ${model}. Must be one of: ${MODELS.join(', ')}`
    );
  }

  // Only grok-imagine-image supports image editing
  if (model !== 'grok-imagine-image') {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Image editing is only supported by grok-imagine-image model. Got: ${model}`
    );
  }

  if (n < 1 || n > 10) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid n: ${n}. Must be between 1 and 10`
    );
  }

  if (!RESOLUTIONS.includes(resolution as any)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid resolution: ${resolution}. Must be one of: ${RESOLUTIONS.join(', ')}`
    );
  }

  try {
    // Prepare image URL
    let imageDataUrl: string;

    if (image_base64) {
      imageDataUrl = `data:image/jpeg;base64,${image_base64}`;
      debugLog('Using provided base64 image');
    } else if (image_path) {
      // Read image from file and convert to data URL
      const absolutePath = path.isAbsolute(image_path)
        ? image_path
        : path.join(process.cwd(), image_path);

      debugLog(`Reading image from: ${absolutePath}`);

      try {
        const imageBuffer = await fs.readFile(absolutePath);
        const base64 = imageBuffer.toString('base64');
        imageDataUrl = `data:image/jpeg;base64,${base64}`;
        debugLog(`Image loaded: ${imageBuffer.length} bytes`);
      } catch (error: any) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Failed to read image file: ${error.message}`
        );
      }
    } else if (image_url) {
      // Use URL directly or download and convert
      if (image_url.startsWith('data:')) {
        imageDataUrl = image_url;
      } else {
        // Download image from URL and convert to data URL
        debugLog(`Downloading image from: ${image_url}`);

        try {
          const response = await fetch(image_url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          imageDataUrl = `data:image/jpeg;base64,${base64}`;
          debugLog(`Image downloaded: ${arrayBuffer.byteLength} bytes`);
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Failed to download image from URL: ${error.message}`
          );
        }
      }
    } else {
      throw new McpError(ErrorCode.InvalidParams, 'No image source provided');
    }

    debugLog('Calling xAI Edit API...');

    // Build request body according to /v1/images/edits spec
    const requestBody: Record<string, any> = {
      model,
      prompt,
      image: {
        url: imageDataUrl,
      },
      n,
      resolution,
      response_format,
    };

    debugLog('Request body:', {
      ...requestBody,
      image: { url: '[DATA_URL]' },
    });

    // Call xAI Edit API
    const response = await fetch(XAI_EDIT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;

      debugLog('API error:', errorData);

      if (response.status === 401) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Authentication failed. Please check your XAI_API_KEY environment variable.'
        );
      } else if (response.status === 403) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Access denied. Please check your API key permissions.'
        );
      } else if (response.status === 400) {
        throw new McpError(ErrorCode.InvalidRequest, `Bad request: ${errorMessage}`);
      } else if (response.status === 429) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Rate limit exceeded. Please wait and try again.'
        );
      } else {
        throw new McpError(
          ErrorCode.InternalError,
          `API error (${response.status}): ${errorMessage}`
        );
      }
    }

    const data = (await response.json()) as XAIImageResponse;

    debugLog('API response received');

    if (!data.data || data.data.length === 0) {
      throw new McpError(ErrorCode.InternalError, 'No image data returned from API');
    }

    debugLog(`Received ${data.data.length} image(s) from API`);

    // Process and save all generated images
    const savedPaths: string[] = [];
    const base64Results: string[] = [];
    const revisedPrompts: string[] = [];

    for (let i = 0; i < data.data.length; i++) {
      const imgData = data.data[i];

      // Collect revised prompts
      if (imgData.revised_prompt) {
        revisedPrompts.push(imgData.revised_prompt);
      }

      // Generate numbered filename for multiple images
      let imagePath = normalizedPath;
      if (n > 1) {
        const pathParts = normalizedPath.split('.');
        const ext = pathParts.pop();
        const basePath = pathParts.join('.');
        imagePath = `${basePath}_${i + 1}.${ext}`;
      }

      if (imgData.b64_json) {
        // Save base64 image
        await saveBase64Image(imgData.b64_json, imagePath);
        savedPaths.push(imagePath);
        if (return_base64) {
          base64Results.push(imgData.b64_json);
        }
        debugLog(`Image ${i + 1}: Saved from b64_json to ${imagePath}`);
      } else if (imgData.url) {
        // Download and save URL image
        await downloadAndSaveImage(imgData.url, imagePath);
        savedPaths.push(imagePath);
        debugLog(`Image ${i + 1}: Downloaded from URL to ${imagePath}`);
      } else {
        throw new McpError(
          ErrorCode.InternalError,
          `No image data (url or b64_json) in response for image ${i + 1}`
        );
      }
    }

    // Determine if thumbnails should be included
    const shouldIncludeThumbnail =
      include_thumbnail !== undefined ? include_thumbnail : isThumbnailEnabled();

    // Build result message
    let resultText: string;
    if (n === 1) {
      const displayPath = getDisplayPath(savedPaths[0]);
      resultText = `Image edited successfully: ${displayPath}`;
    } else {
      resultText = `${n} images edited successfully:\n`;
      savedPaths.forEach((filePath, idx) => {
        resultText += `  ${idx + 1}. ${getDisplayPath(filePath)}\n`;
      });
    }

    // Add parameters info
    resultText += `\nParameters:`;
    resultText += `\n  - Model: ${model}`;
    resultText += `\n  - Resolution: ${resolution}`;

    // Add revised prompt if available
    if (revisedPrompts.length > 0) {
      resultText += `\n\nRevised prompt: ${revisedPrompts[0]}`;
    }

    // Add base64 data if requested
    if (return_base64 && base64Results.length > 0) {
      resultText += '\n\nBase64 data included in response.';
    }

    // Return with thumbnails if enabled
    if (shouldIncludeThumbnail) {
      debugLog('[Thumbnail] Including thumbnails in response');
      const content: Array<{
        type: string;
        text?: string;
        data?: string;
        mimeType?: string;
      }> = [{ type: 'text', text: resultText }];

      // Generate and add thumbnails for each image
      for (const imagePath of savedPaths) {
        try {
          const thumbnailData = await generateThumbnailData(imagePath);
          const thumbnailContent = createThumbnailContent(thumbnailData);
          content.push(thumbnailContent);
          debugLog(`[Thumbnail] Added thumbnail for: ${imagePath}`);
        } catch (error: any) {
          debugLog(
            `[WARNING] Failed to generate thumbnail for ${imagePath}:`,
            error.message
          );
          // Continue without thumbnail for this image
        }
      }

      return { content };
    }

    return resultText;
  } catch (error: any) {
    debugLog('Error editing image:', error);

    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Failed to edit image: ${error.message}`
    );
  }
}
