/**
 * Path utilities for cross-platform file handling
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { debugLog } from './debug.js';

/**
 * Normalize and validate output path
 */
export async function normalizeAndValidatePath(outputPath: string): Promise<string> {
  // Handle relative paths
  let normalizedPath = outputPath;

  if (!path.isAbsolute(outputPath)) {
    // Use OUTPUT_DIR env var or current working directory
    const baseDir = process.env.OUTPUT_DIR || process.cwd();
    normalizedPath = path.join(baseDir, outputPath);
  }

  // Ensure directory exists
  const dir = path.dirname(normalizedPath);
  try {
    await fs.mkdir(dir, { recursive: true });
    debugLog(`Directory ensured: ${dir}`);
  } catch (error: any) {
    debugLog(`Failed to create directory: ${dir}`, error.message);
    throw new Error(`Cannot create output directory: ${dir}`);
  }

  return normalizedPath;
}

/**
 * Generate unique file path to avoid overwriting
 */
export async function generateUniqueFilePath(filePath: string): Promise<string> {
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const dir = path.dirname(filePath);

  let counter = 0;
  let uniquePath = filePath;

  while (await fileExists(uniquePath)) {
    counter++;
    uniquePath = path.join(dir, `${baseName}_${counter}${ext}`);
  }

  if (counter > 0) {
    debugLog(`Generated unique path: ${uniquePath}`);
  }

  return uniquePath;
}

/**
 * Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get display-friendly path (relative to cwd if possible)
 */
export function getDisplayPath(filePath: string): string {
  const cwd = process.cwd();
  if (filePath.startsWith(cwd)) {
    return path.relative(cwd, filePath) || filePath;
  }
  return filePath;
}
