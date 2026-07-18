---
name: affiliate-status
description: アフィリエイトブログの記事数・未収益化リンク・ビルド健全性を点検して報告する。「ブログの状態は?」「アフィリエイトの点検して」「収益化の状況教えて」「記事いくつある?」と言われたら使う。読み取り+ビルド確認のみで、コンテンツは書き換えない。
---

# affiliate-status

アフィリエイトブログの現状を点検し、オーナーに報告するスキル。

## 前提

`affiliate/` ディレクトリ(content/, links.json, build.mjs)が必要(ai-affiliate-earningsブランチ由来)。現在のブランチに無ければ、そのブランチから取り込むかユーザーに確認する。

## 手順

1. **記事数の集計**
   - `affiliate/content/*.md` の件数を数える。
   - 各ファイルの frontmatter を読み、`title` / `slug` / `date` / `category` が揃っているか確認する。欠けているファイルは一覧にする(build.mjs はそれらをスキップし警告を出す)。
   - 日付の新しい順に並べ、直近7日・30日で何本追加されたかを把握する。

2. **未収益化リンクの確認**
   - `affiliate/links.json` を読み、`url` が空文字列 `""` のエントリを「未収益化(アフィリエイトURL未設定)」としてリストアップする。
   - `official` のみ設定されている状態は公式リンクとしては機能するが、報酬は発生しないことを明記する。

3. **ビルド健全性の確認**
   - `node affiliate/build.mjs` を実行し、以下を確認する:
     - exit code 0 で成功したか
     - "N article(s) built" の件数
     - 警告(`[build] Skipping ...`, `Unknown affiliate id ...` など)の有無と内容
   - `dist/blog/index.html`, `dist/blog/feed.xml`, `dist/sitemap.xml`, `dist/robots.txt` が生成されているか確認する。

## 報告フォーマット

```
📊 ブログ点検結果
- 記事: N本(frontmatter不備 M本) / 直近7日 +x本・30日 +y本
- 未収益化リンク: chatgpt, claude (2件)
- ビルド: 成功 / N articles built / 警告0件
→ 次のアクション: ASP登録後に affiliate/links.json の url を更新
```

## 注意事項

- このスキルは読み取りとビルド確認のみ。`affiliate/content/` や `affiliate/links.json` は書き換えない(ユーザーから明示的に依頼された場合を除く)。
- `dist/` はビルド確認用の一時出力として扱い、コミットしない。
