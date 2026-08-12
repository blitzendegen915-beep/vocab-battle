# Article Scraper - AI要約スクラップアプリ

URLを入力するだけで、AIが記事を3行要約 + タグ付きで保存するモバイルアプリ。

## セットアップ

### 1. Supabaseプロジェクト作成

1. [supabase.com](https://supabase.com) でアカウント作成・プロジェクト作成
2. SQL Editor を開いて `supabase/migrations/001_init.sql` の内容を実行
3. Settings > API から以下をコピー:
   - Project URL
   - anon/public key

### 2. OpenAI APIキー取得

1. [platform.openai.com](https://platform.openai.com) でAPIキー作成
2. `gpt-4o-mini` を使用します

### 3. 環境変数設定

```bash
cd article-scraper
cp .env.example .env
```

`.env` を編集:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_OPENAI_API_KEY=sk-...
```

### 4. インストール・起動

```bash
npm install
npx expo start
```

Expo Go アプリ (iOS/Android) でQRコードをスキャンして動作確認。

## 使い方

1. **Add タブ** を開く
2. 記事の URL を貼り付け
3. **「取得して保存」** をタップ
4. 自動でタイトル取得 → AI要約 → タグ生成 → 保存
5. **My Articles タブ** で保存した記事一覧を確認
6. 記事をタップして詳細（要約・タグ）を表示

## 技術スタック

- **Expo SDK 51** + **Expo Router v3**
- **React Native 0.74** + **TypeScript**
- **Supabase** (PostgreSQL)
- **OpenAI API** (gpt-4o-mini)
- ダークモード対応

詳細は [SPEC.md](./SPEC.md) を参照。
