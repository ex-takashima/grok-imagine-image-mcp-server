/**
 * Generate image tool - Create images from text prompts using xAI Grok Imagine
 */

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
import type { GenerateImageParams, XAIImageResponse } from '../types/tools.js';
import {
  ASPECT_RATIOS,
  RESOLUTIONS,
  QUALITIES,
  MODELS,
} from '../types/tools.js';

const XAI_API_ENDPOINT = 'https://api.x.ai/v1/images/generations';

export async function generateImage(
  apiKey: string,
  params: GenerateImageParams
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
  debugLog('Generate image called with params:', params);

  const {
    prompt,
    output_path = 'generated_image.jpg',
    model = 'grok-imagine-image',
    n = 1,
    aspect_ratio = '1:1',
    resolution = '1k',
    quality,
    response_format = 'b64_json',
    return_base64 = false,
    include_thumbnail,
  } = params;

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

  if (n < 1 || n > 10) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid n: ${n}. Must be between 1 and 10`
    );
  }

  // Validate aspect ratio
  if (!ASPECT_RATIOS.includes(aspect_ratio as any)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid aspect_ratio: ${aspect_ratio}. Must be one of: ${ASPECT_RATIOS.join(', ')}`
    );
  }

  if (!RESOLUTIONS.includes(resolution as any)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid resolution: ${resolution}. Must be one of: ${RESOLUTIONS.join(', ')}`
    );
  }

  if (quality && !QUALITIES.includes(quality as any)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid quality: ${quality}. Must be one of: ${QUALITIES.join(', ')}`
    );
  }

  try {
    debugLog('Calling xAI API...');

    // Build request body
    const requestBody: Record<string, any> = {
      model,
      prompt,
      n,
      aspect_ratio,
      resolution,
      response_format,
    };

    // Quality is currently no-op but include if specified
    if (quality) {
      requestBody.quality = quality;
    }

    debugLog('Request body:', requestBody);

    // Call xAI API
    const response = await fetch(XAI_API_ENDPOINT, {
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
      const imageData = data.data[i];

      // Collect revised prompts
      if (imageData.revised_prompt) {
        revisedPrompts.push(imageData.revised_prompt);
      }

      // Generate numbered filename for multiple images
      let imagePath = normalizedPath;
      if (n > 1) {
        const pathParts = normalizedPath.split('.');
        const ext = pathParts.pop();
        const basePath = pathParts.join('.');
        imagePath = `${basePath}_${i + 1}.${ext}`;
      }

      if (imageData.b64_json) {
        // Save base64 image
        await saveBase64Image(imageData.b64_json, imagePath);
        savedPaths.push(imagePath);
        if (return_base64) {
          base64Results.push(imageData.b64_json);
        }
        debugLog(`Image ${i + 1}: Saved from b64_json to ${imagePath}`);
      } else if (imageData.url) {
        // Download and save URL image
        await downloadAndSaveImage(imageData.url, imagePath);
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
      resultText = `Image generated successfully: ${displayPath}`;
    } else {
      resultText = `${n} images generated successfully:\n`;
      savedPaths.forEach((filePath, idx) => {
        resultText += `  ${idx + 1}. ${getDisplayPath(filePath)}\n`;
      });
    }

    // Add parameters info
    resultText += `\nParameters:`;
    resultText += `\n  - Model: ${model}`;
    resultText += `\n  - Aspect ratio: ${aspect_ratio}`;
    resultText += `\n  - Resolution: ${resolution}`;
    if (quality) {
      resultText += `\n  - Quality: ${quality}`;
    }

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
    debugLog('Error generating image:', error);

    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Failed to generate image: ${error.message}`
    );
  }
}
