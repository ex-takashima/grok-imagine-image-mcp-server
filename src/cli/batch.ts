#!/usr/bin/env node

/**
 * Batch processing CLI for xAI Grok Imagine Image
 *
 * Usage:
 *   grok-imagine-image-batch <config.json> [options]
 *
 * Options:
 *   --output-dir <path>    Override output directory
 *   --format <text|json>   Output format (default: text)
 *   --timeout <ms>         Timeout in milliseconds (default: 600000)
 *   --max-concurrent <n>   Max concurrent jobs (1-10, default: 2)
 *   --estimate-only        Estimate cost without executing
 *   --allow-any-path       Allow any output path (for CI/CD)
 *   --help, -h             Show help message
 *   --version, -v          Show version
 */

import * as dotenv from 'dotenv';
import type { BatchExecutionOptions, BatchResult, CostEstimate } from '../types/batch.js';
import {
  loadBatchConfig,
  validateBatchConfig,
  mergeBatchConfig,
  BatchConfigError,
} from '../utils/batch-config.js';
import { BatchManager } from '../utils/batch-manager.js';

// Load environment variables
dotenv.config();

const VERSION = '1.0.0';

/**
 * Parse command line arguments
 */
function parseArgs(): {
  configPath?: string;
  options: BatchExecutionOptions;
  showHelp: boolean;
  showVersion: boolean;
} {
  const args = process.argv.slice(2);
  const options: BatchExecutionOptions = {
    format: 'text',
  };
  let configPath: string | undefined;
  let showHelp = false;
  let showVersion = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        showHelp = true;
        break;

      case '--version':
      case '-v':
        showVersion = true;
        break;

      case '--output-dir':
        options.outputDir = args[++i];
        if (!options.outputDir) {
          console.error('Error: --output-dir requires a path argument');
          process.exit(1);
        }
        break;

      case '--format':
        const format = args[++i];
        if (format !== 'text' && format !== 'json') {
          console.error('Error: --format must be "text" or "json"');
          process.exit(1);
        }
        options.format = format;
        break;

      case '--timeout':
        const timeout = parseInt(args[++i], 10);
        if (isNaN(timeout) || timeout < 1000) {
          console.error('Error: --timeout must be a number >= 1000');
          process.exit(1);
        }
        options.timeout = timeout;
        break;

      case '--max-concurrent':
        const maxConcurrent = parseInt(args[++i], 10);
        if (isNaN(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 10) {
          console.error('Error: --max-concurrent must be between 1 and 10');
          process.exit(1);
        }
        options.maxConcurrent = maxConcurrent;
        break;

      case '--estimate-only':
        options.estimateOnly = true;
        break;

      case '--allow-any-path':
        options.allowAnyPath = true;
        break;

      default:
        if (arg.startsWith('-')) {
          console.error(`Error: Unknown option: ${arg}`);
          process.exit(1);
        }
        if (configPath) {
          console.error('Error: Multiple config files specified');
          process.exit(1);
        }
        configPath = arg;
    }
  }

  return { configPath, options, showHelp, showVersion };
}

/**
 * Show help message
 */
function showHelpMessage(): void {
  console.log(`
xAI Grok Imagine Image Batch CLI v${VERSION}

Usage:
  grok-imagine-image-batch <config.json> [options]

Options:
  --output-dir <path>    Override output directory from config
  --format <text|json>   Output format (default: text)
  --timeout <ms>         Timeout in milliseconds (default: 600000)
  --max-concurrent <n>   Max concurrent jobs, 1-10 (default: 2)
  --estimate-only        Estimate cost without executing
  --allow-any-path       Allow any output path (for CI/CD)
  --help, -h             Show this help message
  --version, -v          Show version

Environment Variables:
  XAI_API_KEY            Required: xAI API key
  OUTPUT_DIR             Default output directory
  DEBUG                  Set to "true" for debug logging

Configuration File Format:
  {
    "jobs": [
      {
        "prompt": "A beautiful sunset",
        "output_path": "sunset.jpg",
        "aspect_ratio": "16:9",
        "resolution": "2k"
      },
      {
        "prompt": "Change to nighttime",
        "image_path": "input.jpg",
        "output_path": "edited.jpg"
      }
    ],
    "output_dir": "./output",
    "max_concurrent": 3,
    "default_model": "grok-imagine-image"
  }

Examples:
  # Run batch with config file
  grok-imagine-image-batch batch.json

  # Estimate cost only
  grok-imagine-image-batch batch.json --estimate-only

  # Custom output directory and format
  grok-imagine-image-batch batch.json --output-dir ./images --format json

  # High concurrency with extended timeout
  grok-imagine-image-batch batch.json --max-concurrent 5 --timeout 1800000
`);
}

/**
 * Format cost estimate as text
 */
function formatCostEstimateText(estimate: CostEstimate): string {
  let output = '\n📊 Cost Estimation\n\n';
  output += `Total jobs: ${estimate.totalJobs}\n`;
  output += `Total images: ${estimate.totalImages}\n`;
  output += `Estimated cost: $${estimate.estimatedCostMin.toFixed(4)}`;
  if (estimate.estimatedCostMin !== estimate.estimatedCostMax) {
    output += ` - $${estimate.estimatedCostMax.toFixed(4)}`;
  }
  output += '\n\nBreakdown by model:\n';

  for (const item of estimate.breakdown) {
    output += `  - ${item.count} x ${item.model}: ${item.images} images = $${item.costMin.toFixed(4)}\n`;
  }

  return output;
}

/**
 * Format batch result as text
 */
function formatResultText(result: BatchResult): string {
  const successIcon = result.failed === 0 && result.cancelled === 0 ? '✅' : '⚠️';
  let output = `\n${successIcon} Batch Image Generation ${result.failed === 0 && result.cancelled === 0 ? 'Completed Successfully' : 'Completed with Issues'}\n\n`;

  output += '📊 Summary:\n';
  output += `  - Total Jobs: ${result.total}\n`;
  output += `  - Succeeded: ${result.succeeded}\n`;
  output += `  - Failed: ${result.failed}\n`;
  output += `  - Cancelled: ${result.cancelled}\n`;
  output += `  - Duration: ${(result.total_duration_ms / 1000).toFixed(2)}s\n`;
  output += `  - Started: ${new Date(result.started_at).toLocaleString()}\n`;
  output += `  - Finished: ${new Date(result.finished_at).toLocaleString()}\n`;

  if (result.estimated_cost !== undefined) {
    output += `\n💰 Estimated Cost: $${result.estimated_cost.toFixed(4)}\n`;
  }

  // Succeeded jobs
  const succeeded = result.results.filter((r) => r.status === 'completed');
  if (succeeded.length > 0) {
    output += '\n### ✅ Successfully Generated Images\n';
    for (const job of succeeded) {
      const type = job.is_edit ? 'Edited' : 'Generated';
      output += `\n${job.index}. ${job.output_paths?.[0] || 'Unknown'}\n`;
      output += `   ${type}: "${job.prompt.substring(0, 60)}${job.prompt.length > 60 ? '...' : ''}"\n`;
      if (job.output_paths && job.output_paths.length > 1) {
        output += `   (+ ${job.output_paths.length - 1} more variants)\n`;
      }
      if (job.duration_ms) {
        output += `   Duration: ${(job.duration_ms / 1000).toFixed(2)}s\n`;
      }
    }
  }

  // Failed jobs
  const failed = result.results.filter((r) => r.status === 'failed');
  if (failed.length > 0) {
    output += '\n### ❌ Failed Jobs\n';
    for (const job of failed) {
      output += `\n${job.index}. "${job.prompt.substring(0, 60)}${job.prompt.length > 60 ? '...' : ''}"\n`;
      output += `   Error: ${job.error}\n`;
    }
  }

  // Cancelled jobs
  const cancelled = result.results.filter((r) => r.status === 'cancelled');
  if (cancelled.length > 0) {
    output += '\n### 🚫 Cancelled Jobs\n';
    for (const job of cancelled) {
      output += `\n${job.index}. "${job.prompt.substring(0, 60)}${job.prompt.length > 60 ? '...' : ''}"\n`;
      output += `   Reason: ${job.error || 'Timeout'}\n`;
    }
  }

  return output;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const { configPath, options, showHelp, showVersion } = parseArgs();

  if (showVersion) {
    console.log(`grok-imagine-image-batch v${VERSION}`);
    process.exit(0);
  }

  if (showHelp || !configPath) {
    showHelpMessage();
    process.exit(showHelp ? 0 : 1);
  }

  // Validate API key
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.error('Error: XAI_API_KEY environment variable is required');
    console.error('Get your API key from: https://console.x.ai/');
    process.exit(1);
  }

  try {
    // Load and validate config
    const config = await loadBatchConfig(configPath);
    validateBatchConfig(config);
    const mergedConfig = mergeBatchConfig(config, options);

    // Create batch manager
    const batchManager = new BatchManager(apiKey);

    // Estimate only mode
    if (options.estimateOnly) {
      const estimate = batchManager.estimateBatchCost(mergedConfig);

      if (options.format === 'json') {
        console.log(JSON.stringify(estimate, null, 2));
      } else {
        console.log(formatCostEstimateText(estimate));
      }
      process.exit(0);
    }

    // Execute batch
    console.error(`Starting batch execution: ${mergedConfig.jobs.length} jobs...`);
    const result = await batchManager.executeBatch(mergedConfig, options);

    // Output results
    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatResultText(result));
    }

    // Exit code based on results
    process.exit(result.failed > 0 || result.cancelled > 0 ? 1 : 0);
  } catch (error: any) {
    if (error instanceof BatchConfigError) {
      console.error(`Configuration Error: ${error.message}`);
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

main();
