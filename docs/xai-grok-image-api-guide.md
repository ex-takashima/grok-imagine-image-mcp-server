# xAI Grok Image API 実装ガイド

このドキュメントは xAI Grok Image API の実装で得た知見をまとめたものです。

## 目次

1. [API概要](#api概要)
2. [認証](#認証)
3. [モデル比較](#モデル比較)
4. [画像生成 API](#画像生成-api)
5. [画像編集 API](#画像編集-api)
6. [エラーハンドリング](#エラーハンドリング)
7. [実装例](#実装例)
8. [注意点・Tips](#注意点tips)

---

## API概要

| 機能 | エンドポイント |
|------|---------------|
| 画像生成 | `https://api.x.ai/v1/images/generations` |
| 画像編集 | `https://api.x.ai/v1/images/edits` |

公式ドキュメント: https://docs.x.ai/docs/guides/image-generations

---

## 認証

```
Authorization: Bearer {XAI_API_KEY}
```

APIキーは https://console.x.ai/ から取得。

---

## モデル比較

| モデル | 価格 | 画像編集 | アスペクト比 |
|--------|------|---------|-------------|
| `grok-imagine-image` | $0.02/枚 | ✅ (+$0.002/入力) | 5種類 |
| `grok-2-image` | $0.07/枚 | ❌ | 14種類 |
| `grok-2-image-latest` | $0.07/枚 | ❌ | 14種類 |
| `grok-2-image-1212` | $0.07/枚 | ❌ | 14種類 |

### アスペクト比サポート

**grok-imagine-image (5種類)**
```
1:1, 3:4, 4:3, 9:16, 16:9
```

**grok-2-image (14種類)**
```
1:1, 3:4, 4:3, 9:16, 16:9, 2:3, 3:2, 9:19.5, 19.5:9, 9:20, 20:9, 1:2, 2:1, auto
```

### 推奨モデル

- **コスト重視**: `grok-imagine-image` ($0.02/枚、3.5倍安い)
- **編集機能が必要**: `grok-imagine-image` (唯一の選択肢)
- **多様なアスペクト比**: `grok-2-image` (14種類対応)

---

## 画像生成 API

### エンドポイント

```
POST https://api.x.ai/v1/images/generations
```

### リクエストボディ

```typescript
interface GenerationRequest {
  model: string;              // "grok-imagine-image" | "grok-2-image" など
  prompt: string;             // 画像の説明
  n?: number;                 // 生成枚数 (1-10, default: 1)
  aspect_ratio?: string;      // アスペクト比 (default: "1:1")
  resolution?: string;        // "1k" | "2k" (default: "1k")
  response_format?: string;   // "url" | "b64_json" (default: "url")
}
```

### レスポンス

```typescript
interface GenerationResponse {
  data: Array<{
    url?: string;           // response_format="url" の場合
    b64_json?: string;      // response_format="b64_json" の場合
    revised_prompt?: string; // AIが修正したプロンプト
  }>;
}
```

### 実装例

```typescript
const response = await fetch('https://api.x.ai/v1/images/generations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: 'grok-imagine-image',
    prompt: '夕焼けの山々',
    n: 1,
    aspect_ratio: '16:9',
    resolution: '1k',
    response_format: 'b64_json',
  }),
});

const data = await response.json();
const base64Image = data.data[0].b64_json;
```

---

## 画像編集 API

### エンドポイント

```
POST https://api.x.ai/v1/images/edits
```

**重要**: 生成エンドポイント (`/generations`) とは異なるエンドポイントを使用。

### リクエストボディ

```typescript
interface EditRequest {
  model: string;              // "grok-imagine-image" のみ対応
  prompt: string;             // 編集内容の説明
  image: {
    url: string;              // data:image/jpeg;base64,... 形式
  };
  n?: number;                 // 生成枚数 (1-10, default: 1)
  resolution?: string;        // "1k" | "2k" (default: "1k")
  response_format?: string;   // "url" | "b64_json"
}
```

### 重要な仕様

1. **アスペクト比は指定不可** - 入力画像から自動検出
2. **モデルは `grok-imagine-image` のみ** - grok-2-image は非対応
3. **画像形式** - `image.url` にデータURLを渡す（ネストされたオブジェクト）

### 画像の渡し方

```typescript
// ファイルから読み込む場合
const imageBuffer = await fs.readFile('input.jpg');
const base64 = imageBuffer.toString('base64');
const imageDataUrl = `data:image/jpeg;base64,${base64}`;

// リクエストボディ
const requestBody = {
  model: 'grok-imagine-image',
  prompt: '背景を宇宙に変更',
  image: {
    url: imageDataUrl,  // ここが重要: ネストされたオブジェクト
  },
  resolution: '1k',
  response_format: 'b64_json',
};
```

### 編集の特性

> **注意**: 画像編集は「インペインティング」ではありません。

- 入力画像を「参照」として新しい画像を生成
- 全体の構図やスタイルは維持される
- ピクセル単位の精密な編集は不可
- 適した用途:
  - スタイル変換（昼→夜、写真→イラスト）
  - 被写体の置換（猫→犬）
  - シーン全体の変更（背景変更）

### 実装例

```typescript
const response = await fetch('https://api.x.ai/v1/images/edits', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: 'grok-imagine-image',
    prompt: 'この猫を犬に変更して、背景はそのまま維持',
    image: {
      url: `data:image/jpeg;base64,${base64Image}`,
    },
    n: 1,
    resolution: '1k',
    response_format: 'b64_json',
  }),
});

const data = await response.json();
// revised_prompt に実際の編集内容が記述される
console.log(data.data[0].revised_prompt);
```

---

## エラーハンドリング

### HTTPステータスコード

| コード | 意味 | 対処法 |
|--------|------|--------|
| 400 | Bad Request | パラメータを確認（アスペクト比、モデル名など） |
| 401 | Unauthorized | APIキーを確認 |
| 403 | Forbidden | APIキーの権限を確認 |
| 429 | Rate Limit | 待機してリトライ |
| 500+ | Server Error | 時間をおいてリトライ |

### エラーレスポンス形式

```typescript
interface ErrorResponse {
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}
```

### 実装例

```typescript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

  switch (response.status) {
    case 401:
      throw new Error('認証失敗: APIキーを確認してください');
    case 403:
      throw new Error('アクセス拒否: APIキーの権限を確認してください');
    case 429:
      throw new Error('レート制限: しばらく待ってから再試行してください');
    default:
      throw new Error(`APIエラー: ${errorMessage}`);
  }
}
```

---

## 実装例

### 完全な生成関数

```typescript
import * as fs from 'fs/promises';

interface GenerateOptions {
  prompt: string;
  model?: 'grok-imagine-image' | 'grok-2-image';
  aspectRatio?: string;
  resolution?: '1k' | '2k';
  outputPath?: string;
}

async function generateImage(apiKey: string, options: GenerateOptions): Promise<string> {
  const {
    prompt,
    model = 'grok-imagine-image',
    aspectRatio = '1:1',
    resolution = '1k',
    outputPath = 'output.jpg',
  } = options;

  // モデル別アスペクト比バリデーション
  const grokImagineRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
  if (model === 'grok-imagine-image' && !grokImagineRatios.includes(aspectRatio)) {
    throw new Error(`grok-imagine-image は ${grokImagineRatios.join(', ')} のみ対応`);
  }

  const response = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const base64 = data.data[0].b64_json;

  // ファイルに保存
  const buffer = Buffer.from(base64, 'base64');
  await fs.writeFile(outputPath, buffer);

  return outputPath;
}
```

### 完全な編集関数

```typescript
interface EditOptions {
  prompt: string;
  imagePath: string;
  resolution?: '1k' | '2k';
  outputPath?: string;
}

async function editImage(apiKey: string, options: EditOptions): Promise<string> {
  const {
    prompt,
    imagePath,
    resolution = '1k',
    outputPath = 'edited.jpg',
  } = options;

  // 画像を読み込んでBase64に変換
  const imageBuffer = await fs.readFile(imagePath);
  const base64 = imageBuffer.toString('base64');
  const imageDataUrl = `data:image/jpeg;base64,${base64}`;

  const response = await fetch('https://api.x.ai/v1/images/edits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-imagine-image',  // 編集は grok-imagine-image のみ
      prompt,
      image: {
        url: imageDataUrl,
      },
      resolution,
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const resultBase64 = data.data[0].b64_json;

  // ファイルに保存
  const buffer = Buffer.from(resultBase64, 'base64');
  await fs.writeFile(outputPath, buffer);

  // revised_prompt をログ出力（デバッグ用）
  if (data.data[0].revised_prompt) {
    console.log('Revised prompt:', data.data[0].revised_prompt);
  }

  return outputPath;
}
```

---

## 注意点・Tips

### 1. エンドポイントの違い

```
❌ 編集に /v1/images/generations を使用
✅ 編集には /v1/images/edits を使用
```

### 2. 画像データの渡し方

```typescript
// ❌ 間違い: フラットな構造
{ image: "data:image/jpeg;base64,..." }
{ image_url: "data:image/jpeg;base64,..." }

// ✅ 正解: ネストされたオブジェクト
{ image: { url: "data:image/jpeg;base64,..." } }
```

### 3. アスペクト比の制限

```typescript
// grok-imagine-image で 2:1 を指定するとエラー
// モデルに応じてバリデーションを実装すること
```

### 4. 編集時のアスペクト比

```typescript
// ❌ 編集時に aspect_ratio を指定してもエラーにはならないが無視される
// ✅ 編集時は aspect_ratio を省略（入力画像から自動検出）
```

### 5. revised_prompt の活用

APIは `revised_prompt` を返すことがある。これはAIが解釈した実際のプロンプトで、デバッグや結果の理解に役立つ。

```typescript
if (data.data[0].revised_prompt) {
  console.log('AIの解釈:', data.data[0].revised_prompt);
}
```

### 6. 複数画像生成

`n` パラメータで最大10枚まで一度に生成可能。コスト効率は変わらないが、APIコール回数を減らせる。

### 7. 解像度の選択

- `1k` (1024x1024): 標準、高速
- `2k`: 高解像度、処理時間長め

---

## 参考リンク

- [xAI API ドキュメント](https://docs.x.ai/docs/guides/image-generations)
- [xAI コンソール (APIキー取得)](https://console.x.ai/)
- [Grok Imagine API 発表](https://x.ai/news/grok-imagine-api)
