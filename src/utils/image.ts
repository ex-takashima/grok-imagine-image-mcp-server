/**
 * Image utilities for saving and processing images
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { debugLog } from './debug.js';

/**
 * Save base64 image data to file
 */
export async function saveBase64Image(
  base64Data: string,
  outputPath: string
): Promise<void> {
  const buffer = Buffer.from(base64Data, 'base64');
  await fs.writeFile(outputPath, buffer);
  debugLog(`Saved image to: ${outputPath}`);
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
