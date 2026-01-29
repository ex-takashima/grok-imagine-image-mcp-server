# xAI Grok Image API チートシート

## クイックリファレンス

### エンドポイント

| 機能 | URL |
|------|-----|
| 生成 | `POST https://api.x.ai/v1/images/generations` |
| 編集 | `POST https://api.x.ai/v1/images/edits` |

### モデル

| モデル | 価格 | 編集 | アスペクト比 |
|--------|------|------|-------------|
| `grok-imagine-image` | $0.02 | ✅ | 5種類 |

### アスペクト比

```
1:1, 3:4, 4:3, 9:16, 16:9
```

---

## 画像生成

```typescript
fetch('https://api.x.ai/v1/images/generations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    model: 'grok-imagine-image',
    prompt: 'プロンプト',
    aspect_ratio: '16:9',      // default: 1:1
    resolution: '1k',          // 1k only
    response_format: 'b64_json', // url | b64_json
    n: 1,                      // 1-10
  }),
});
```

---

## 画像編集

```typescript
// 画像をBase64に変換
const base64 = fs.readFileSync('input.jpg').toString('base64');

fetch('https://api.x.ai/v1/images/edits', {  // ← /edits エンドポイント
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    model: 'grok-imagine-image',  // ← 編集は grok-imagine のみ
    prompt: '編集内容',
    image: {                      // ← ネストされたオブジェクト
      url: `data:image/jpeg;base64,${base64}`,
    },
    resolution: '1k',
    response_format: 'b64_json',
  }),
});
```

---

## レスポンス

```typescript
{
  data: [{
    b64_json?: string,      // Base64画像データ
    url?: string,           // 画像URL
    revised_prompt?: string // AIが修正したプロンプト
  }]
}
```

---

## よくある間違い

```typescript
// ❌ 編集に生成エンドポイントを使用
fetch('.../images/generations', { image: ... })

// ✅ 編集には /edits を使用
fetch('.../images/edits', { image: { url: ... } })
```

```typescript
// ❌ フラットな image パラメータ
{ image: "data:image/..." }

// ✅ ネストされたオブジェクト
{ image: { url: "data:image/..." } }
```

```typescript
// ❌ 編集時にアスペクト比を指定
{ aspect_ratio: '16:9' }  // 無視される

// ✅ 編集時はアスペクト比を省略（入力画像から自動検出）
```

---

## ヘッダー

```
Content-Type: application/json
Authorization: Bearer xai-xxxxxxxxxxxxx
```

---

## HTTPエラー

| コード | 意味 |
|--------|------|
| 400 | パラメータエラー |
| 401 | 認証失敗 |
| 403 | 権限不足 |
| 429 | レート制限 |
