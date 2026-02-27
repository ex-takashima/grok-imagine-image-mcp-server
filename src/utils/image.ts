/**
 * Image utilities for saving and processing images
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { debugLog } from './debug.js';

/**
 * Strip data URL prefix from base64 string if present.
 * Returns { mimeType, base64 } where mimeType is extracted from the prefix (or undefined).
 * Handles formats like "data:image/png;base64,iVBOR..." returned by xAI API for 2k resolution.
 */
export function stripDataUrlPrefix(data: string): { mimeType?: string; base64: string } {
  const match = data.match(/^data:([^;]+);base64,/);
  if (match) {
    return { mimeType: match[1], base64: data.slice(match[0].length) };
  }
  return { base64: data };
}

/**
 * Detect actual image format from buffer magic bytes and return the correct extension.
 */
export function detectImageExtension(buffer: Buffer): string {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return '.png';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return '.jpg';
  }
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') {
    return '.webp';
  }
  return '.png'; // default fallback
}

/**
 * Replace the file extension of a path, preserving the base name.
 */
export function replaceExtension(filePath: string, newExt: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, parsed.name + newExt);
}

/**
 * Save base64 image data to file.
 * Handles data URL prefix (e.g. "data:image/png;base64,...") and
 * corrects file extension to match actual image format.
 * Returns the actual output path used (extension may differ from input).
 */
export async function saveBase64Image(
  base64Data: string,
  outputPath: string
): Promise<string> {
  // Strip data URL prefix if present (xAI API returns this for 2k resolution)
  const { base64 } = stripDataUrlPrefix(base64Data);
  const buffer = Buffer.from(base64, 'base64');

  // Detect actual format and correct extension if needed
  const actualExt = detectImageExtension(buffer);
  const currentExt = path.extname(outputPath).toLowerCase();
  let finalPath = outputPath;

  if (currentExt !== actualExt && currentExt !== '') {
    finalPath = replaceExtension(outputPath, actualExt);
    debugLog(`Corrected extension: ${currentExt} -> ${actualExt}`);
  }

  await fs.writeFile(finalPath, buffer);
  debugLog(`Saved image to: ${finalPath} (${buffer.length} bytes)`);
  return finalPath;
}

/**
 * Download image from URL and save to file
 */
export async function downloadAndSaveImage(
  url: string,
  outputPath: string
): Promise<void> {
  debugLog(`Downloading image from: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await fs.writeFile(outputPath, buffer);
  debugLog(`Saved image to: ${outputPath}`);
}

/**
 * Validate aspect ratio format
 */
export function validateAspectRatio(aspectRatio: string): boolean {
  // Format: "width:height" e.g., "4:3", "16:9", "1:1"
  const pattern = /^\d+:\d+$/;
  return pattern.test(aspectRatio);
}

/**
 * Get file extension from output format or path
 */
export function getImageExtension(outputPath: string): string {
  const ext = path.extname(outputPath).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    return ext.substring(1);
  }
  return 'png'; // default
}

/**
 * Generate thumbnail data from image file
 */
export async function generateThumbnailData(
  imagePath: string,
  maxWidth: number = 256,
  maxHeight: number = 256
): Promise<string> {
  try {
    // Dynamic import for sharp (optional dependency)
    const sharp = (await import('sharp')).default;

    const imageBuffer = await fs.readFile(imagePath);
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    return thumbnailBuffer.toString('base64');
  } catch (error: any) {
    debugLog(`Failed to generate thumbnail: ${error.message}`);
    throw error;
  }
}

/**
 * Check if thumbnail generation is enabled via environment variable
 */
export function isThumbnailEnabled(): boolean {
  return process.env.XAI_IMAGE_THUMBNAIL === 'true';
}

/**
 * Create MCP content object with thumbnail
 */
export function createThumbnailContent(base64Data: string): {
  type: string;
  data: string;
  mimeType: string;
} {
  return {
    type: 'image',
    data: base64Data,
    mimeType: 'image/jpeg',
  };
}
