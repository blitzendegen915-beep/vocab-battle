# 記事スクラップAI要約アプリ - MVP仕様書

## 概要

URLを手動入力するだけで、AIが記事を3行で要約しタグ付きで保存できるモバイルアプリ。
Safari / Chrome / X などで見つけた記事を素早くスクラップできる。

## コンセプト

「読みたい記事を見つけた → URLをコピペ → 3行要約 + タグで即保存」

## MVP機能一覧

| # | 機能 | 説明 |
|---|------|------|
| 1 | URL手動入力 | テキストフィールドにURLをペースト |
| 2 | タイトル取得 | og:title / titleタグからスクレイピング |
| 3 | AI 3行要約 | OpenAI gpt-4o-mini で要約生成 |
| 4 | タグ自動生成 | OpenAI で3〜5個のタグを生成 |
| 5 | 記事一覧 | 保存した記事をカード形式で表示 |
| 6 | 記事詳細 | タイトル・URL・要約・タグを表示 |
| 7 | Supabase保存 | PostgreSQLにデータを永続化 |
| 8 | スマホUI | シンプルなモバイルファーストUI |
| 9 | ダークモード | システム設定に連動して自動切替 |
| 10 | 記事削除 | 詳細画面から削除可能 |

## 技術スタック

| 分類 | 技術 | バージョン |
|------|------|----------|
| フレームワーク | Expo | SDK 51 |
| ルーティング | Expo Router | v3 |
| UI | React Native | 0.74 |
| 言語 | TypeScript | 5.x |
| スタイリング | StyleSheet (Tailwind風カラースキーム) | - |
| データベース | Supabase | - |
| AI | OpenAI API | gpt-4o-mini |

## 画面構成

### 1. ホーム画面 (`/`)

- 保存済み記事一覧をカード形式で表示
- 各カード: タイトル・要約1行目・タグ(最大3個)・保存日
- プルして更新 (RefreshControl)
- 画面フォーカス時に自動更新
- 記事なし時: 空の状態メッセージ表示

### 2. 記事追加画面 (`/add`)

- URL入力フィールド
- 「取得して保存」ボタン
- 処理ステータス表示 (記事を取得中... → AIで要約中...)
- 完了後はホームへ遷移

### 3. 記事詳細画面 (`/article/[id]`)

- タイトル
- URLリンク (タップでブラウザ起動)
- 保存日
- AI要約 (3行 bullet point)
- タグ一覧 (バッジ形式)
- 削除ボタン (確認ダイアログあり)

## DB設計

### articles テーブル

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | 記事ID |
| url | TEXT | NOT NULL | 記事URL |
| title | TEXT | NULL | 記事タイトル |
| summary | TEXT | NULL | AI生成の3行要約 (改行区切り) |
| tags | TEXT[] | DEFAULT '{}' | タグ配列 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新日時 |

### インデックス

```sql
CREATE INDEX articles_created_at_idx ON articles(created_at DESC);
```

### セキュリティ (MVP)

- Row Level Security (RLS) 有効
- MVP用: 全操作を許可するポリシーを設定
- 本番環境では Supabase Auth による認証追加を推奨

## ディレクトリ構成

```
article-scraper/
├── SPEC.md                    # 本仕様書
├── README.md                  # セットアップガイド
├── package.json
├── app.json                   # Expo設定
├── tsconfig.json
├── babel.config.js
├── metro.config.js
├── expo-env.d.ts
├── .env.example               # 環境変数サンプル
├── supabase/
│   └── migrations/
│       └── 001_init.sql       # DBスキーマ
├── src/
│   ├── types/
│   │   └── index.ts           # TypeScript型定義
│   ├── constants/
│   │   └── Colors.ts          # ダークモード対応カラー
│   ├── lib/
│   │   ├── supabase.ts        # Supabaseクライアント
│   │   ├── openai.ts          # OpenAI要約・タグ生成
│   │   └── scraper.ts         # タイトル・本文スクレイピング
│   ├── hooks/
│   │   └── useArticles.ts     # 記事CRUD hooks
│   └── components/
│       ├── ArticleCard.tsx    # 記事カードコンポーネント
│       ├── TagBadge.tsx       # タグバッジ
│       └── LoadingSpinner.tsx # ローディング表示
└── app/                       # Expo Router screens
    ├── _layout.tsx            # Root Stack
    ├── (tabs)/
    │   ├── _layout.tsx        # Tab Navigator
    │   ├── index.tsx          # ホーム (記事一覧)
    │   └── add.tsx            # 記事追加
    └── article/
        └── [id].tsx           # 記事詳細
```

## 必要な環境変数

| 変数名 | 説明 | 取得場所 |
|--------|------|--------|
| EXPO_PUBLIC_SUPABASE_URL | SupabaseプロジェクトURL | Supabase Dashboard > Settings > API |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | Supabase匿名キー | Supabase Dashboard > Settings > API |
| EXPO_PUBLIC_OPENAI_API_KEY | OpenAI APIキー | platform.openai.com > API Keys |

## 実装手順

### Step 1: Supabaseセットアップ
1. [supabase.com](https://supabase.com) でプロジェクト作成
2. `supabase/migrations/001_init.sql` を SQL Editor で実行
3. Settings > API から `URL` と `anon key` を取得

### Step 2: OpenAI APIキー取得
1. [platform.openai.com](https://platform.openai.com) でAPIキー取得
2. `gpt-4o-mini` モデルへのアクセスを確認

### Step 3: 環境変数設定
```bash
cd article-scraper
cp .env.example .env
# .envファイルを編集して各値を設定
```

### Step 4: 依存関係インストール
```bash
npm install
```

### Step 5: アプリ起動
```bash
npx expo start
# QRコードをExpo Go (iOS/Android) でスキャン
```

## AI要約プロンプト設計

```
以下の記事を3行で要約し、関連タグを3〜5個生成してください。

タイトル: {title}
内容: {content の先頭3000文字}

以下のJSON形式で返してください:
{
  "summary": "1行目\n2行目\n3行目",
  "tags": ["タグ1", "タグ2", "タグ3"]
}
```

- モデル: `gpt-4o-mini` (コスト効率重視)
- `response_format: { type: "json_object" }` でJSON強制
- `max_tokens: 500` でコスト制御

## 今後の拡張案

- Share Extension (iOS) / Share Intent (Android) からのURL共有
- 認証 (Supabase Auth) による個人データ管理
- 検索・フィルタリング機能
- お気に入り機能
- オリジナル記事のWebView表示
- オフラインキャッシュ
- 複数ユーザー対応
