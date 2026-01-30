# Grok Imagine Image MCP Server

[![npm version](https://badge.fury.io/js/grok-imagine-image-mcp-server.svg)](https://www.npmjs.com/package/grok-imagine-image-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[日本語版 README はこちら](README.ja.md)

MCP (Model Context Protocol) server for xAI's Grok Imagine Image API. Supports image generation from text prompts and editing existing images.

## Quick Start with npx

```bash
# Set your API key
export XAI_API_KEY="xai-your-api-key"

# Run the server
npx grok-imagine-image-mcp-server
```

## Features

- **Image Generation**: Generate new images from text prompts
- **Image Editing**: Edit existing images with prompts (grok-imagine-image only)
- **Batch Processing**: Process multiple images via CLI
- Various aspect ratios (1:1, 4:3, 16:9, and more)
- Resolution: 1k (standard)
- Generate multiple images at once (up to 10)
- Optional thumbnail preview in MCP responses

## Supported Models

| Model | Price | Image Editing | Notes |
|-------|-------|---------------|-------|
| `grok-imagine-image` | $0.02/image | ✅ (+$0.002/input) | **Recommended, Default** |

## Requirements

- Node.js 18.0.0 or higher
- xAI API key (get from [console.x.ai](https://console.x.ai/))

## Installation

### Option 1: npx (Recommended)

```bash
npx grok-imagine-image-mcp-server
```

### Option 2: Global Install

```bash
npm install -g grok-imagine-image-mcp-server
grok-imagine-image-mcp-server
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `XAI_API_KEY` | Yes | Your xAI API key |
| `DEBUG` | No | Set to `true` for debug logging |
| `OUTPUT_DIR` | No | Default output directory for images |
| `XAI_IMAGE_THUMBNAIL` | No | Set to `true` to include thumbnails |

### Claude Desktop Configuration

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "grok-imagine-image": {
      "command": "npx",
      "args": ["-y", "grok-imagine-image-mcp-server"],
      "env": {
        "XAI_API_KEY": "xai-your-api-key-here"
      }
    }
  }
}
```

## Tools

### generate_image

Generate images from text prompts.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Text description of the image to generate |
| `output_path` | string | No | Output file path (default: generated_image.jpg) |
| `model` | string | No | Model to use (default: grok-imagine-image) |
| `n` | number | No | Number of images (1-10, default: 1) |
| `aspect_ratio` | string | No | Aspect ratio (default: 1:1) |
| `resolution` | string | No | Resolution (default: 1k) |
| `return_base64` | boolean | No | Return base64 data (default: false) |
| `include_thumbnail` | boolean | No | Include thumbnail (default: false) |

### edit_image

Edit existing images (grok-imagine-image only).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Description of desired edits |
| `image_path` | string | No* | Path to source image file |
| `image_base64` | string | No* | Base64 encoded source image |
| `image_url` | string | No* | URL of source image |
| `output_path` | string | No | Output file path (default: edited_image.jpg) |
| `n` | number | No | Number of images (1-10, default: 1) |
| `resolution` | string | No | Resolution (default: 1k). Aspect ratio is auto-detected from input image. |

*One of `image_path`, `image_base64`, or `image_url` is required

> **Note**: The edit_image tool uses the source image as a reference and regenerates the entire image. It maintains the overall composition and style but is not pixel-level inpainting. Best suited for style transformations, subject replacements, and scene modifications.

## Batch Processing CLI

Process multiple images at once using the batch CLI:

```bash
# Run batch with config file
npx grok-imagine-image-batch batch.json

# Estimate cost only
npx grok-imagine-image-batch batch.json --estimate-only

# Custom output directory
npx grok-imagine-image-batch batch.json --output-dir ./images --format json
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output-dir <path>` | Override output directory | From config |
| `--format <text\|json>` | Output format | `text` |
| `--timeout <ms>` | Timeout in milliseconds | `600000` |
| `--max-concurrent <n>` | Max concurrent jobs (1-10) | `2` |
| `--estimate-only` | Estimate cost without executing | - |
| `--allow-any-path` | Allow any output path (CI/CD) | - |

### Batch Configuration File

```json
{
  "jobs": [
    {
      "prompt": "A beautiful sunset over mountains",
      "output_path": "sunset.jpg",
      "aspect_ratio": "16:9"
    },
    {
      "prompt": "Change to nighttime scene",
      "image_path": "input.jpg",
      "output_path": "edited.jpg"
    }
  ],
  "output_dir": "./output",
  "max_concurrent": 3,
  "default_model": "grok-imagine-image",
  "retry_policy": {
    "max_retries": 2,
    "retry_delay_ms": 1000
  }
}
```

See `examples/` directory for more configuration examples.

## Supported Aspect Ratios

| Aspect Ratio | Use Case |
|--------------|----------|
| `1:1` | Square, social media profiles (default) |
| `3:4` / `4:3` | Standard portrait/landscape |
| `9:16` / `16:9` | Smartphone / widescreen |

## Supported Resolutions

| Resolution | Description |
|------------|-------------|
| `1k` | Standard resolution (1024x1024, default) |


## Usage Examples

```
# Image generation
Generate an image of a sunset over mountains with aspect ratio 16:9

# Image editing
Change the background of this image to space
```

## API Reference

| Function | Endpoint |
|----------|----------|
| Image Generation | `https://api.x.ai/v1/images/generations` |
| Image Editing | `https://api.x.ai/v1/images/edits` |

- **Documentation**: [docs.x.ai/docs/guides/image-generations](https://docs.x.ai/docs/guides/image-generations)

## Development

```bash
git clone https://github.com/ex-takashima/grok-imagine-image-mcp-server.git
cd grok-imagine-image-mcp-server
npm install
npm run build
npm start
```

## License

MIT

## Author

Junji Takashima <takajyun00@gmail.com>
