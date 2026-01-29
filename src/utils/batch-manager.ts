/**
 * Batch execution manager with concurrency control
 */

import type {
  BatchConfig,
  BatchJobConfig,
  BatchResult,
  BatchJobResult,
  BatchExecutionOptions,
  CostEstimate,
} from '../types/batch.js';
import { resolveOutputPath, getDefaultOutputDirectory } from './batch-config.js';
import { generateImage } from '../tools/generate.js';
import { editImage } from '../tools/edit.js';
import { debugLog } from './debug.js';

/**
 * Semaphore for concurrency control
 */
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}

/**
 * Cost per image by model
 */
const MODEL_COSTS = {
  'grok-imagine-image': { base: 0.02, edit_input: 0.002 },
  'grok-2-image': { base: 0.07, edit_input: 0 },
  'grok-2-image-latest': { base: 0.07, edit_input: 0 },
  'grok-2-image-1212': { base: 0.07, edit_input: 0 },
};

/**
 * BatchManager handles batch execution with concurrency control
 */
export class BatchManager {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Estimate cost for batch execution
   */
  estimateBatchCost(config: BatchConfig): CostEstimate {
    const breakdown: CostEstimate['breakdown'] = [];
    const modelCounts: Record<string, { count: number; images: number; isEdit: boolean }> = {};

    for (const job of config.jobs) {
      const model = job.model || config.default_model || 'grok-imagine-image';
      const n = job.n || 1;
      const isEdit = !!(job.image_path || job.image_base64 || job.image_url);
      const key = `${model}${isEdit ? '_edit' : ''}`;

      if (!modelCounts[key]) {
        modelCounts[key] = { count: 0, images: 0, isEdit };
      }
      modelCounts[key].count++;
      modelCounts[key].images += n;
    }

    let totalMin = 0;
    let totalMax = 0;
    let totalImages = 0;

    for (const [key, data] of Object.entries(modelCounts)) {
      const modelName = key.replace('_edit', '') as keyof typeof MODEL_COSTS;
      const costs = MODEL_COSTS[modelName] || MODEL_COSTS['grok-imagine-image'];
      const baseCost = costs.base * data.images;
      const editCost = data.isEdit ? costs.edit_input * data.count : 0;
      const cost = baseCost + editCost;

      breakdown.push({
        model: key,
        count: data.count,
        images: data.images,
        costMin: cost,
        costMax: cost,
      });

      totalMin += cost;
      totalMax += cost;
      totalImages += data.images;
    }

    return {
      totalJobs: config.jobs.length,
      totalImages,
      estimatedCostMin: totalMin,
      estimatedCostMax: totalMax,
      breakdown,
    };
  }

  /**
   * Execute batch jobs with concurrency control
   */
  async executeBatch(
    config: BatchConfig,
    options: BatchExecutionOptions = {}
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();

    const maxConcurrent = config.max_concurrent || 2;
    const timeout = config.timeout || 600000;
    const outputDir = config.output_dir || getDefaultOutputDirectory();
    const semaphore = new Semaphore(maxConcurrent);

    debugLog(`Starting batch execution: ${config.jobs.length} jobs, max concurrent: ${maxConcurrent}`);

    const results: BatchJobResult[] = [];
    const jobPromises: Promise<void>[] = [];

    // Create job promises
    for (let i = 0; i < config.jobs.length; i++) {
      const job = config.jobs[i];
      const outputPath = resolveOutputPath(job, i, outputDir, options.allowAnyPath);

      const jobPromise = (async () => {
        await semaphore.acquire();
        try {
          const result = await this.executeJob(job, i, outputPath, config);
          results.push(result);
        } finally {
          semaphore.release();
        }
      })();

      jobPromises.push(jobPromise);
    }

    // Execute with timeout
    let timedOut = false;
    try {
      await Promise.race([
        Promise.all(jobPromises),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            timedOut = true;
            reject(new Error('Batch execution timed out'));
          }, timeout)
        ),
      ]);
    } catch (error: any) {
      if (timedOut) {
        debugLog('Batch timed out, waiting for in-progress jobs...');
        // Wait a bit for in-progress jobs to complete
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        throw error;
      }
    }

    // Mark incomplete jobs as cancelled
    const completedIndices = new Set(results.map((r) => r.index));
    for (let i = 0; i < config.jobs.length; i++) {
      if (!completedIndices.has(i + 1)) {
        results.push({
          index: i + 1,
          prompt: config.jobs[i].prompt,
          status: 'cancelled',
          error: 'Job cancelled due to timeout',
        });
      }
    }

    // Sort results by index
    results.sort((a, b) => a.index - b.index);

    const endTime = Date.now();
    const finishedAt = new Date().toISOString();

    // Calculate totals
    const succeeded = results.filter((r) => r.status === 'completed').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const cancelled = results.filter((r) => r.status === 'cancelled').length;

    // Estimate cost
    const estimate = this.estimateBatchCost(config);

    return {
      total: config.jobs.length,
      succeeded,
      failed,
      cancelled,
      results,
      started_at: startedAt,
      finished_at: finishedAt,
      total_duration_ms: endTime - startTime,
      estimated_cost: estimate.estimatedCostMin,
    };
  }

  /**
   * Execute a single job with retry logic
   */
  private async executeJob(
    job: BatchJobConfig,
    index: number,
    outputPath: string,
    config: BatchConfig
  ): Promise<BatchJobResult> {
    const jobIndex = index + 1;
    const isEditJob = !!(job.image_path || job.image_base64 || job.image_url);
    const retryPolicy = config.retry_policy || { max_retries: 2, retry_delay_ms: 1000 };
    const maxRetries = retryPolicy.max_retries ?? 2;
    const retryDelay = retryPolicy.retry_delay_ms ?? 1000;
    const retryPatterns = retryPolicy.retry_on_errors ?? ['rate_limit', 'timeout', '429', '503'];

    let lastError: string = '';
    const startTime = Date.now();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        debugLog(`Job ${jobIndex}: Starting (attempt ${attempt + 1}/${maxRetries + 1})`);

        let result: any;
        let revisedPrompt: string | undefined;
        let outputPaths: string[] = [];

        if (isEditJob) {
          // Edit job
          result = await editImage(this.apiKey, {
            prompt: job.prompt,
            image_path: job.image_path,
            image_base64: job.image_base64,
            image_url: job.image_url,
            output_path: outputPath,
            model: job.model || config.default_model,
            n: job.n || 1,
            resolution: job.resolution || config.default_resolution,
          });
        } else {
          // Generate job
          result = await generateImage(this.apiKey, {
            prompt: job.prompt,
            output_path: outputPath,
            model: job.model || config.default_model,
            n: job.n || 1,
            aspect_ratio: job.aspect_ratio || config.default_aspect_ratio,
            resolution: job.resolution || config.default_resolution,
          });
        }

        // Parse result
        if (typeof result === 'string') {
          // Extract output paths from result text
          const pathMatches = result.match(/(?:saved|generated|edited)[^:]*:\s*([^\n]+)/gi);
          if (pathMatches) {
            for (const match of pathMatches) {
              const pathMatch = match.match(/:\s*(.+)/);
              if (pathMatch) {
                outputPaths.push(pathMatch[1].trim());
              }
            }
          }

          // Extract revised prompt
          const promptMatch = result.match(/Revised prompt:\s*(.+)/i);
          if (promptMatch) {
            revisedPrompt = promptMatch[1].trim();
          }
        } else if (result && result.content) {
          // Result with content array
          const textContent = result.content.find((c: any) => c.type === 'text');
          if (textContent && textContent.text) {
            const pathMatches = textContent.text.match(/(?:saved|generated|edited)[^:]*:\s*([^\n]+)/gi);
            if (pathMatches) {
              for (const match of pathMatches) {
                const pathMatch = match.match(/:\s*(.+)/);
                if (pathMatch) {
                  outputPaths.push(pathMatch[1].trim());
                }
              }
            }

            const promptMatch = textContent.text.match(/Revised prompt:\s*(.+)/i);
            if (promptMatch) {
              revisedPrompt = promptMatch[1].trim();
            }
          }
        }

        // If no paths extracted, use the expected output path
        if (outputPaths.length === 0) {
          outputPaths.push(outputPath);
        }

        const duration = Date.now() - startTime;
        debugLog(`Job ${jobIndex}: Completed in ${duration}ms`);

        return {
          index: jobIndex,
          prompt: job.prompt,
          status: 'completed',
          output_paths: outputPaths,
          duration_ms: duration,
          revised_prompt: revisedPrompt,
          is_edit: isEditJob,
        };
      } catch (error: any) {
        lastError = error.message || String(error);
        debugLog(`Job ${jobIndex}: Failed (attempt ${attempt + 1}): ${lastError}`);

        // Check if we should retry
        const shouldRetry =
          attempt < maxRetries &&
          retryPatterns.some((pattern) =>
            lastError.toLowerCase().includes(pattern.toLowerCase())
          );

        if (shouldRetry) {
          debugLog(`Job ${jobIndex}: Retrying in ${retryDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    // All retries exhausted
    const duration = Date.now() - startTime;
    return {
      index: jobIndex,
      prompt: job.prompt,
      status: 'failed',
      error: lastError,
      duration_ms: duration,
      is_edit: isEditJob,
    };
  }
}
