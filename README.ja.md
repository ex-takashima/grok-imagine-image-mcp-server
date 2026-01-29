# Grok Imagine Image MCP Server

[![npm version](https://badge.fury.io/js/grok-imagine-image-mcp-server.svg)](https://www.npmjs.com/package/grok-imagine-image-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

xAI の Grok Imagine Image API 用 MCP (Model Context Protocol) サーバー。テキストプロンプトからの画像生成と、既存画像の編集をサポートします。

## クイックスタート (npx)

最も簡単な方法は `npx` を使用することです：

```bash
# APIキーを設定
export XAI_API_KEY="xai-your-api-key"

# サーバーを実行
npx grok-imagine-image-mcp-server
```

## 機能

- **画像生成**: テキストプロンプトから新規画像を生成
- **画像編集**: 既存画像をプロンプトで編集（grok-imagine-image のみ）
- 多様なアスペクト比をサポート（1:1, 4:3, 16:9 など）
- 解像度選択（1k, 2k）
- 一度に最大10枚の画像を生成
- MCP レスポンスにサムネイルプレビューを含めるオプション

## サポートモデル

| モデル | 価格 | 画像編集 | 備考 |
|--------|------|---------|------|
| `grok-imagine-image` | $0.02/枚 | ✅ (+$0.002/入力) | **推奨・デフォルト** |
| `grok-2-image` | $0.07/枚 | ❌ | エイリアス: grok-2-image-latest |
| `grok-2-image-1212` | $0.07/枚 | ❌ | バージョン指定 |

## 必要条件

- Node.js 18.0.0 以上
- xAI API キー（[console.x.ai](https://console.x.ai/) から取得）

## インストール

### 方法1: npx（推奨）

```bash
npx grok-imagine-image-mcp-server
```

### 方法2: グローバルインストール

```bash
npm install -g grok-imagine-image-mcp-server
grok-imagine-image-mcp-server
```

## 設定

### 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `XAI_API_KEY` | Yes | xAI API キー |
| `DEBUG` | No | `true` でデバッグログを有効化 |
| `OUTPUT_DIR` | No | 画像のデフォルト出力ディレクトリ |
| `XAI_IMAGE_THUMBNAIL` | No | `true` でサムネイルを含める |

### Claude Desktop 設定

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

## ツール

### generate_image

テキストプロンプトから画像を生成します。

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `prompt` | string | Yes | 生成する画像の説明テキスト |
| `output_path` | string | No | 出力ファイルパス（デフォルト: generated_image.jpg） |
| `model` | string | No | モデル（デフォルト: grok-imagine-image） |
| `n` | number | No | 生成枚数（1-10、デフォルト: 1） |
| `aspect_ratio` | string | No | アスペクト比（デフォルト: 1:1） |
| `resolution` | string | No | 解像度（デフォルト: 1k） |
| `return_base64` | boolean | No | Base64データを返す（デフォルト: false） |
| `include_thumbnail` | boolean | No | サムネイルを含める（デフォルト: false） |

### edit_image

既存画像を編集します（grok-imagine-image のみ対応）。

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `prompt` | string | Yes | 編集内容の説明 |
| `image_path` | string | No* | 編集する画像のファイルパス |
| `image_base64` | string | No* | 編集する画像のBase64データ |
| `image_url` | string | No* | 編集する画像のURL |
| `output_path` | string | No | 出力ファイルパス（デフォルト: edited_image.jpg） |
| `n` | number | No | 生成枚数（1-10、デフォルト: 1） |
| `resolution` | string | No | 解像度（デフォルト: 1k）。アスペクト比は入力画像から自動検出。 |

*`image_path`、`image_base64`、`image_url` のいずれか1つが必須

> **注意**: edit_image は入力画像を「参照」として使用し、画像全体を再生成します。全体の構図やスタイルは維持されますが、ピクセル単位の精密な編集（インペインティング）ではありません。スタイル変換、被写体の置換、シーンの変更に適しています。

## サポートされているアスペクト比

モデルによってサポートするアスペクト比が異なります：

### grok-imagine-image（5種類）

| アスペクト比 | 用途例 |
|-------------|--------|
| `1:1` | 正方形、SNSプロフィール画像（デフォルト） |
| `3:4` / `4:3` | 標準的な縦長/横長 |
| `9:16` / `16:9` | スマホ縦 / ワイドスクリーン |

### grok-2-image（14種類）

| アスペクト比 | 用途例 |
|-------------|--------|
| `1:1` | 正方形、SNSプロフィール画像（デフォルト） |
| `3:4` / `4:3` | 標準的な縦長/横長 |
| `9:16` / `16:9` | スマホ縦 / ワイドスクリーン |
| `2:3` / `3:2` | ポートレート / 一眼写真 |
| `9:19.5` / `19.5:9` | iPhone縦長/横長 |
| `9:20` / `20:9` | 超縦長/超横長 |
| `1:2` / `2:1` | 縦長/横長バナー |
| `auto` | 自動選択 |

## サポートされている解像度

| 解像度 | 説明 |
|--------|------|
| `1k` | 標準解像度（1024x1024、デフォルト） |
| `2k` | 高解像度 |

## 使用例

```
# 画像生成
山の上の夕日の画像を16:9で2k解像度で生成して

# 画像編集
この画像の背景を宇宙に変更して
```

## API リファレンス

| 機能 | エンドポイント |
|------|---------------|
| 画像生成 | `https://api.x.ai/v1/images/generations` |
| 画像編集 | `https://api.x.ai/v1/images/edits` |

- **ドキュメント**: [docs.x.ai/docs/guides/image-generations](https://docs.x.ai/docs/guides/image-generations)

## 開発

```bash
git clone https://github.com/takajun/grok-imagine-image-mcp-server.git
cd grok-imagine-image-mcp-server
npm install
npm run build
npm start
```

## ライセンス

MIT

## 作者

Junji Takashima <takajyun00@gmail.com>
