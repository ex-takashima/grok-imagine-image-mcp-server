# Grok Imagine Image Batch CLI 仕様書

## 概要

`grok-imagine-image-batch` は、xAI Grok Image API を使用して複数の画像を一括処理するためのコマンドラインツールです。

## コマンド構文

```bash
grok-imagine-image-batch <config.json> [options]
```

## オプション一覧

| オプション | 引数 | 説明 | デフォルト |
|-----------|------|------|-----------|
| `--output-dir` | `<path>` | 出力ディレクトリを上書き | 設定ファイルの値 |
| `--format` | `text` \| `json` | 出力フォーマット | `text` |
| `--timeout` | `<ms>` | タイムアウト（ミリ秒、1000以上） | `600000` |
| `--max-concurrent` | `<n>` | 最大同時実行数（1-10） | `2` |
| `--estimate-only` | - | コスト見積もりのみ（実行しない） | - |
| `--allow-any-path` | - | 任意の出力パスを許可（CI/CD用） | - |
| `--help`, `-h` | - | ヘルプを表示 | - |
| `--version`, `-v` | - | バージョンを表示 | - |

## 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `XAI_API_KEY` | Yes | xAI API キー |
| `OUTPUT_DIR` | No | デフォルト出力ディレクトリ |
| `DEBUG` | No | `true` でデバッグログを有効化 |

---

## 設定ファイル仕様

### 基本構造

```json
{
  "jobs": [...],
  "output_dir": "string",
  "max_concurrent": number,
  "timeout": number,
  "default_model": "string",
  "default_resolution": "string",
  "default_aspect_ratio": "string",
  "retry_policy": {...}
}
```

### トップレベルプロパティ

| プロパティ | 型 | 必須 | 説明 | デフォルト |
|-----------|-----|------|------|-----------|
| `jobs` | array | Yes | ジョブ配列（1-100件） | - |
| `output_dir` | string | No | 出力ディレクトリ | カレントディレクトリ |
| `max_concurrent` | number | No | 最大同時実行数（1-10） | `2` |
| `timeout` | number | No | タイムアウト（ms、1000-3600000） | `600000` |
| `default_model` | string | No | デフォルトモデル | `grok-imagine-image` |
| `default_resolution` | string | No | デフォルト解像度 | `1k` |
| `default_aspect_ratio` | string | No | デフォルトアスペクト比 | `1:1` |
| `retry_policy` | object | No | リトライポリシー | 下記参照 |

### ジョブ設定 (jobs[])

#### 画像生成ジョブ

| プロパティ | 型 | 必須 | 説明 | デフォルト |
|-----------|-----|------|------|-----------|
| `prompt` | string | Yes | 画像の説明テキスト | - |
| `output_path` | string | No | 出力ファイルパス | `generated_{index}.jpg` |
| `model` | string | No | モデル | 設定ファイルのdefault |
| `aspect_ratio` | string | No | アスペクト比 | 設定ファイルのdefault |
| `resolution` | string | No | 解像度（`1k`のみ） | `1k` |
| `n` | number | No | 生成枚数（1-10） | `1` |

#### 画像編集ジョブ

| プロパティ | 型 | 必須 | 説明 | デフォルト |
|-----------|-----|------|------|-----------|
| `prompt` | string | Yes | 編集内容の説明 | - |
| `image_path` | string | No* | 入力画像のファイルパス | - |
| `image_base64` | string | No* | 入力画像のBase64データ | - |
| `image_url` | string | No* | 入力画像のURL | - |
| `output_path` | string | No | 出力ファイルパス | `edited_{index}.jpg` |
| `resolution` | string | No | 解像度（`1k`のみ） | `1k` |
| `n` | number | No | 生成枚数（1-10） | `1` |

\* `image_path`、`image_base64`、`image_url` のいずれか1つが必須

> **注意**: 編集ジョブでは `aspect_ratio` は指定できません（入力画像から自動検出）。
> 編集は `grok-imagine-image` モデルのみ対応。

### リトライポリシー (retry_policy)

| プロパティ | 型 | 説明 | デフォルト |
|-----------|-----|------|-----------|
| `max_retries` | number | リトライ回数（0-5） | `2` |
| `retry_delay_ms` | number | リトライ間隔（100-60000ms） | `1000` |
| `retry_on_errors` | string[] | リトライ対象のエラーパターン | `["rate_limit", "timeout", "429", "503"]` |

---

## サポート値

### モデル

| モデル | 価格 | 編集対応 |
|--------|------|---------|
| `grok-imagine-image` | $0.02/枚 | ✅ (+$0.002/入力) |

### アスペクト比

```
1:1, 3:4, 4:3, 9:16, 16:9
```

### 解像度

| 値 | 説明 |
|----|------|
| `1k` | 標準解像度（1024x1024） |


---

## 出力フォーマット

### テキスト形式 (--format text)

```
✅ Batch Image Generation Completed Successfully

📊 Summary:
  - Total Jobs: 3
  - Succeeded: 3
  - Failed: 0
  - Cancelled: 0
  - Duration: 8.28s
  - Started: 1/29/2026, 10:40:11 PM
  - Finished: 1/29/2026, 10:40:20 PM

💰 Estimated Cost: $0.0600

### ✅ Successfully Generated Images

1. output/image1.jpg
   Generated: "A beautiful sunset..."
   Duration: 4.66s

### ❌ Failed Jobs
(none)

### 🚫 Cancelled Jobs
(none)
```

### JSON形式 (--format json)

```json
{
  "total": 3,
  "succeeded": 3,
  "failed": 0,
  "cancelled": 0,
  "results": [
    {
      "index": 1,
      "prompt": "A beautiful sunset...",
      "status": "completed",
      "output_paths": ["output/image1.jpg"],
      "duration_ms": 4660,
      "revised_prompt": "...",
      "is_edit": false
    }
  ],
  "started_at": "2026-01-29T13:40:11.000Z",
  "finished_at": "2026-01-29T13:40:20.000Z",
  "total_duration_ms": 8280,
  "estimated_cost": 0.06
}
```

### コスト見積もり (--estimate-only)

**テキスト形式:**
```
📊 Cost Estimation

Total jobs: 5
Total images: 12
Estimated cost: $0.2400

Breakdown by model:
  - 5 x grok-imagine-image: 12 images = $0.2400
```

**JSON形式:**
```json
{
  "totalJobs": 5,
  "totalImages": 12,
  "estimatedCostMin": 0.24,
  "estimatedCostMax": 0.24,
  "breakdown": [
    {
      "model": "grok-imagine-image",
      "count": 5,
      "images": 12,
      "costMin": 0.24,
      "costMax": 0.24
    }
  ]
}
```

---

## 終了コード

| コード | 意味 |
|--------|------|
| `0` | すべてのジョブが成功 |
| `1` | 1つ以上のジョブが失敗またはキャンセル |

---

## 使用例

### 基本的な使用

```bash
# 設定ファイルでバッチ実行
grok-imagine-image-batch config.json

# npx経由で実行
npx grok-imagine-image-batch config.json
```

### コスト見積もり

```bash
# テキスト形式
grok-imagine-image-batch config.json --estimate-only

# JSON形式
grok-imagine-image-batch config.json --estimate-only --format json
```

### 出力先の指定

```bash
# 出力ディレクトリを上書き
grok-imagine-image-batch config.json --output-dir ./images

# CI/CD環境で任意のパスを許可
grok-imagine-image-batch config.json --output-dir /var/output --allow-any-path
```

### パフォーマンス調整

```bash
# 高並列実行（最大10）
grok-imagine-image-batch config.json --max-concurrent 5

# 長時間タイムアウト（30分）
grok-imagine-image-batch config.json --timeout 1800000
```

### 結果の保存

```bash
# JSON結果をファイルに保存
grok-imagine-image-batch config.json --format json > results.json

# ログと結果を分離
grok-imagine-image-batch config.json --format json 2>batch.log >results.json
```

---

## 設定ファイル例

### シンプルな生成

```json
{
  "jobs": [
    { "prompt": "A sunset over mountains" },
    { "prompt": "A cat playing" },
    { "prompt": "A futuristic city" }
  ],
  "output_dir": "./output"
}
```

### 詳細な設定

```json
{
  "jobs": [
    {
      "prompt": "A majestic mountain landscape",
      "output_path": "mountain.jpg",
      "aspect_ratio": "16:9"
    },
    {
      "prompt": "Portrait of a wizard",
      "output_path": "wizard.jpg",
      "aspect_ratio": "3:4"
    }
  ],
  "output_dir": "./output",
  "max_concurrent": 3,
  "default_model": "grok-imagine-image",
  "retry_policy": {
    "max_retries": 3,
    "retry_delay_ms": 2000
  }
}
```

### 画像編集を含む

```json
{
  "jobs": [
    {
      "prompt": "A park scene",
      "output_path": "park_original.jpg"
    },
    {
      "prompt": "Change to autumn with orange leaves",
      "image_path": "./output/park_original.jpg",
      "output_path": "park_autumn.jpg"
    },
    {
      "prompt": "Transform to winter with snow",
      "image_path": "./output/park_original.jpg",
      "output_path": "park_winter.jpg"
    }
  ],
  "output_dir": "./output",
  "max_concurrent": 1
}
```

### バリエーション生成

```json
{
  "jobs": [
    {
      "prompt": "Logo design for a coffee brand",
      "output_path": "logo.jpg",
      "n": 5
    }
  ],
  "output_dir": "./output/logos"
}
```

---

## エラーハンドリング

### 設定エラー

- 設定ファイルが見つからない
- JSONパースエラー
- 必須フィールドの欠落
- 値の範囲外

### 実行時エラー

- API認証エラー (401)
- レート制限 (429) → 自動リトライ
- タイムアウト → ジョブはキャンセル扱い
- 画像保存エラー

### リトライ動作

1. エラー発生
2. エラーメッセージが `retry_on_errors` パターンに一致するか確認
3. 一致する場合、`retry_delay_ms` 待機後にリトライ
4. `max_retries` 回までリトライ
5. すべて失敗した場合、ジョブは `failed` ステータス

---

## 制限事項

| 項目 | 制限 |
|------|------|
| 最大ジョブ数 | 100件/バッチ |
| 最大同時実行 | 10 |
| タイムアウト | 1秒〜1時間 |
| 生成枚数/ジョブ | 1-10枚 |
| リトライ回数 | 0-5回 |

---

## バージョン履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 1.0.0 | 2026-01-29 | 初回リリース |
