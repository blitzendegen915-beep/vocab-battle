# Article Scraper Web (Next.js)

## Vercelへのデプロイ (推奨・無料)

1. **Vercelに接続**: https://vercel.com/new でこのリポジトリをインポート
2. **Root Directory** を `article-scraper-web` に変更
3. **環境変数** を設定:

   | 変数名 | 値 |
   |--------|------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard > Settings > API > Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard > Settings > API > anon key |
   | `OPENAI_API_KEY` | platform.openai.com > API Keys |

4. **Deploy** ボタンを押す → 完了！

---

## ローカル起動

```bash
cd article-scraper-web
cp .env.local.example .env.local
# .env.local を編集して各値を記入

npm install
npm run dev
# → http://localhost:3000 で動作確認
```

## Supabase セットアップ

1. [supabase.com](https://supabase.com) でプロジェクト作成
2. SQL Editor で `article-scraper/supabase/migrations/001_init.sql` を実行
3. Settings > API からURLとanon keyを取得

## 構成

```
article-scraper-web/
├── src/
│   ├── app/
│   │   ├── page.tsx              # ホーム (記事一覧 + URL入力)
│   │   ├── article/[id]/page.tsx # 記事詳細
│   │   ├── api/summarize/        # スクレイピング + OpenAI (サーバー)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── AddArticleForm.tsx    # URL入力フォーム
│   │   ├── ArticleCard.tsx       # 一覧カード
│   │   └── DeleteButton.tsx      # 削除ボタン
│   └── lib/
│       ├── supabase.ts
│       └── types.ts
└── ...
```

## 特弴

- **CORS対応**: スクレイピングはサーバー側APIルートで実行するためCORS問題なし
- **APIキー安全**: OpenAIキーはブラウザに露出しない
- **ダークモード**: OS設定に連動して自動切替
