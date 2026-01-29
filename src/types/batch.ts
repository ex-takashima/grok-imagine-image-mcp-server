/**
 * Batch processing type definitions
 */

import type { AspectRatio, Resolution, Model } from './tools.js';

/**
 * Individual job configuration in batch
 */
export interface BatchJobConfig {
  /** Text prompt describing the image to generate */
  prompt: string;
  /** Output file path (optional, auto-generated if not specified) */
  output_path?: string;
  /** Model to use (default: grok-imagine-image) */
  model?: Model;
  /** Aspect ratio (model-dependent, default: 1:1) */
  aspect_ratio?: AspectRatio;
  /** Resolution (default: 1k) */
  resolution?: Resolution;
  /** Number of images to generate for this prompt (1-10, default: 1) */
  n?: number;

  // Edit-specific options
  /** Path to source image for editing */
  image_path?: string;
  /** Base64 encoded source image for editing */
  image_base64?: string;
  /** URL of source image for editing */
  image_url?: string;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts (0-5, default: 2) */
  max_retries?: number;
  /** Delay between retries in milliseconds (100-60000, default: 1000) */
  retry_delay_ms?: number;
  /** Error patterns to trigger retry (case-insensitive) */
  retry_on_errors?: string[];
}

/**
 * Batch configuration file structure
 */
export interface BatchConfig {
  /** Array of job configurations (required, 1-100 jobs) */
  jobs: BatchJobConfig[];
  /** Default output directory for generated images */
  output_dir?: string;
  /** Maximum concurrent jobs (1-10, default: 2) */
  max_concurrent?: number;
  /** Timeout in milliseconds (default: 600000 = 10 minutes) */
  timeout?: number;
  /** Retry policy for failed jobs */
  retry_policy?: RetryPolicy;
  /** Default model for all jobs */
  default_model?: Model;
  /** Default resolution for all jobs */
  default_resolution?: Resolution;
  /** Default aspect ratio for all jobs */
  default_aspect_ratio?: AspectRatio;
}

/**
 * Result of a single batch job
 */
export interface BatchJobResult {
  /** Job index (1-based) */
  index: number;
  /** Original prompt */
  prompt: string;
  /** Job status */
  status: 'completed' | 'failed' | 'cancelled';
  /** Output file path(s) */
  output_paths?: string[];
  /** Error message if failed */
  error?: string;
  /** Job duration in milliseconds */
  duration_ms?: number;
  /** Revised prompt from API */
  revised_prompt?: string;
  /** Whether this was an edit job */
  is_edit?: boolean;
}

/**
 * Overall batch execution result
 */
export interface BatchResult {
  /** Total number of jobs */
  total: number;
  /** Number of successful jobs */
  succeeded: number;
  /** Number of failed jobs */
  failed: number;
  /** Number of cancelled jobs (timeout) */
  cancelled: number;
  /** Individual job results */
  results: BatchJobResult[];
  /** Batch start timestamp (ISO) */
  started_at: string;
  /** Batch finish timestamp (ISO) */
  finished_at: string;
  /** Total batch duration in milliseconds */
  total_duration_ms: number;
  /** Estimated total cost in USD */
  estimated_cost?: number;
}

/**
 * Batch execution options (from CLI)
 */
export interface BatchExecutionOptions {
  /** Override output directory */
  outputDir?: string;
  /** Output format */
  format?: 'text' | 'json';
  /** Timeout in milliseconds */
  timeout?: number;
  /** Maximum concurrent jobs */
  maxConcurrent?: number;
  /** Estimate cost only without executing */
  estimateOnly?: boolean;
  /** Allow any output path (for CI/CD) */
  allowAnyPath?: boolean;
}

/**
 * Cost estimation result
 */
export interface CostEstimate {
  totalJobs: number;
  totalImages: number;
  estimatedCostMin: number;
  estimatedCostMax: number;
  breakdown: {
    model: string;
    count: number;
    images: number;
    costMin: number;
    costMax: number;
  }[];
}
