/**
 * Type definitions for Grok Imagine Image MCP Server
 */

// Supported models
export const MODELS = [
  'grok-imagine-image',
  'grok-imagine-image-pro',
  'grok-imagine-image-2.0',
] as const;

export type Model = (typeof MODELS)[number];

// Supported aspect ratios for grok-imagine-image (14 options)
export const GROK_IMAGINE_ASPECT_RATIOS = [
  '1:1',
  '3:4',
  '4:3',
  '3:2',
  '2:3',
  '2:1',
  '1:2',
  '9:16',
  '16:9',
  '19.5:9',
  '9:19.5',
  '20:9',
  '9:20',
  'auto',
] as const;

// All supported aspect ratios (grok-imagine-image only)
export const ASPECT_RATIOS = GROK_IMAGINE_ASPECT_RATIOS;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];

// Supported resolutions
export const RESOLUTIONS = ['1k', '2k'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

// Quality options (grok-imagine-image-2.0 only; the API default is medium)
export const QUALITIES = ['low', 'medium'] as const;
export type Quality = (typeof QUALITIES)[number];

export const DEFAULT_QUALITY: Quality = 'medium';

// Models accepting the quality parameter
export const QUALITY_MODELS: readonly Model[] = ['grok-imagine-image-2.0'];

// Models supporting image editing
export const EDIT_MODELS: readonly Model[] = [
  'grok-imagine-image',
  'grok-imagine-image-pro',
  'grok-imagine-image-2.0',
];

export interface GenerateImageParams {
  prompt: string;
  output_path?: string;
  model?: Model;
  n?: number;
  aspect_ratio?: AspectRatio;
  resolution?: Resolution;
  quality?: Quality;
  response_format?: 'url' | 'b64_json';
  return_base64?: boolean;
  include_thumbnail?: boolean;
}

export interface EditImageParams {
  prompt: string;
  image_path?: string;
  image_base64?: string;
  image_url?: string;
  image_paths?: string[];
  image_base64s?: string[];
  image_urls?: string[];
  output_path?: string;
  model?: Model;
  n?: number;
  aspect_ratio?: AspectRatio;
  resolution?: Resolution;
  quality?: Quality;
  response_format?: 'url' | 'b64_json';
  return_base64?: boolean;
  include_thumbnail?: boolean;
}

export interface XAIImageResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

export interface XAIErrorResponse {
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}
