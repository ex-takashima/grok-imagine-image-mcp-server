#!/usr/bin/env node

/**
 * xAI Grok Imagine Image MCP Server
 *
 * Model Context Protocol server for xAI's Grok Imagine Image API
 * Enables image generation and editing through Claude Desktop and other MCP clients
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';
import { generateImage } from './tools/generate.js';
import { editImage } from './tools/edit.js';
import { debugLog } from './utils/debug.js';

// Load environment variables
dotenv.config();

// Validate API key
const apiKey = process.env.XAI_API_KEY;
if (!apiKey) {
  console.error(
    'Error: XAI_API_KEY environment variable is required.\n' +
      'Please set it in your environment or .env file.\n' +
      'Get your API key from: https://console.x.ai/\n' +
      'Example: export XAI_API_KEY="xai-..."\n'
  );
  process.exit(1);
}

// Create MCP server
const server = new Server(
  {
    name: 'grok-imagine-image-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const TOOLS = [
  {
    name: 'generate_image',
    description:
      'Generate a new image from a text prompt using xAI Grok Imagine Image API. ' +
      'Default model is grok-imagine-image ($0.02/image). ' +
      'Supports various aspect ratios (1:1, 4:3, 16:9, etc.) and resolutions (1k, 2k). ' +
      'Can generate multiple images at once (up to 10).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The text prompt describing the image to generate',
        },
        output_path: {
          type: 'string',
          description: 'Output file path (default: generated_image.jpg)',
        },
        model: {
          type: 'string',
          enum: [
            'grok-imagine-image',
            'grok-2-image',
            'grok-2-image-latest',
            'grok-2-image-1212',
          ],
          description:
            'Model to use. grok-imagine-image is cheaper ($0.02) and supports editing. grok-2-image costs $0.07. (default: grok-imagine-image)',
        },
        n: {
          type: 'number',
          description: 'Number of images to generate (1-10, default: 1)',
          minimum: 1,
          maximum: 10,
        },
        aspect_ratio: {
          type: 'string',
          enum: [
            '1:1',
            '3:4',
            '4:3',
            '9:16',
            '16:9',
            '2:3',
            '3:2',
            '9:19.5',
            '19.5:9',
            '9:20',
            '20:9',
            '1:2',
            '2:1',
            'auto',
          ],
          description:
            'Aspect ratio (default: 1:1). grok-imagine-image supports: 1:1, 3:4, 4:3, 9:16, 16:9. grok-2-image supports all options including auto.',
        },
        resolution: {
          type: 'string',
          enum: ['1k'],
          description: 'Resolution of the generated image (default: 1k)',
        },
        quality: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description:
            'Quality of the output image (currently reserved for future use)',
        },
        return_base64: {
          type: 'boolean',
          description: 'Return base64 image data in response (default: false)',
        },
        include_thumbnail: {
          type: 'boolean',
          description:
            'Include thumbnail preview in MCP response for LLM recognition (default: false, overrides XAI_IMAGE_THUMBNAIL env var)',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'edit_image',
    description:
      'Edit an existing image using xAI Grok Imagine Image API. ' +
      'Only supported by grok-imagine-image model ($0.02/image + $0.002/input image). ' +
      'Provide a source image via file path, base64, or URL along with a prompt describing the desired changes.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Description of the desired edits to make to the image',
        },
        image_path: {
          type: 'string',
          description: 'Path to the source image file to edit',
        },
        image_base64: {
          type: 'string',
          description: 'Base64 encoded source image to edit',
        },
        image_url: {
          type: 'string',
          description: 'URL of the source image to edit',
        },
        output_path: {
          type: 'string',
          description: 'Output file path (default: edited_image.jpg)',
        },
        n: {
          type: 'number',
          description: 'Number of edited images to generate (1-10, default: 1)',
          minimum: 1,
          maximum: 10,
        },
        resolution: {
          type: 'string',
          enum: ['1k'],
          description:
            'Resolution of the output image (default: 1k). Aspect ratio is automatically detected from the input image.',
        },
        return_base64: {
          type: 'boolean',
          description: 'Return base64 image data in response (default: false)',
        },
        include_thumbnail: {
          type: 'boolean',
          description:
            'Include thumbnail preview in MCP response for LLM recognition (default: false)',
        },
      },
      required: ['prompt'],
    },
  },
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  debugLog('Listing available tools');
  return { tools: TOOLS };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Redact sensitive data from logs
  const safeArgs = { ...args };
  if ('image_base64' in safeArgs) {
    safeArgs.image_base64 = '[REDACTED]';
  }
  debugLog(`Tool called: ${name}`, safeArgs);

  try {
    switch (name) {
      case 'generate_image': {
        const result = await generateImage(apiKey!, args as any);
        if (typeof result === 'string') {
          return { content: [{ type: 'text', text: result }] };
        }
        return result;
      }

      case 'edit_image': {
        const result = await editImage(apiKey!, args as any);
        if (typeof result === 'string') {
          return { content: [{ type: 'text', text: result }] };
        }
        return result;
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error: any) {
    debugLog('Tool execution error:', error);

    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  debugLog('Starting xAI Grok Imagine Image MCP Server');
  debugLog(`API Key configured: ${apiKey!.substring(0, 10)}...`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  debugLog('Server running on stdio transport');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
