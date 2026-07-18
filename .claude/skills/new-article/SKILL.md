---
name: new-article
description: 新しいアフィリエイト記事を1本生成してビルド確認する。「記事を書いて」「記事を追加して」「新しい記事作って」と言われたら使う。トピックは引数で指定可能、無指定なら既存記事と重複しないトピックを自動選定する。
---

# new-article

`affiliate/content/` に新しいアフィリエイト記事を1本追加し、ビルドを確認するスキル。引数でトピックが指定された場合はそれを使い、無指定なら既存記事と重複しないトピックを選ぶ。

## 前提

`affiliate/` ディレクトリ(content/, links.json, build.mjs)が必要(ai-affiliate-earningsブランチ由来)。現在のブランチに無ければ、そのブランチから取り込むかユーザーに確認する。

## 手順

1. **既存記事の確認**
   - `affiliate/content/*.md` の frontmatter (`title`, `slug`, `category`, `tags`) を一覧し、カバー済みトピック・スラッグを把握する。
   - `affiliate/links.json` を読み、利用可能なアフィリエイトID一覧を確認する。

2. **記事の作成**
   - `affiliate/content/<slug>.md` を新規作成。`<slug>` は英小文字とハイフンのみ。
   - frontmatter は以下のスキーマに厳密に従う:
     ```
     ---
     title: 記事タイトル
     description: SEOを意識した説明文(120文字程度)
     slug: lowercase-ascii-hyphens
     date: YYYY-MM-DD (今日の日付)
     category: カテゴリ名
     tags: ["タグ1", "タグ2"]
     ---
     ```
   - 本文は1200〜2000文字程度の日本語。使えるMarkdownは build.mjs のレンダラー対応範囲のみ: `#`/`##`/`###` 見出し、`**太字**`、`[text](url)`、`- ` 箇条書き、`1. ` 番号リスト、`` `インラインコード` ``、フェンスコードブロック、`> 引用`、`---` 区切り。
   - `affiliate/links.json` に登録済みのIDだけを使い、本文の自然な流れに `{{aff:ID}}` を1〜2箇所挿入する。

3. **ビルドで検証**
   - `node affiliate/build.mjs` を実行し、警告なしで記事が1件増えていることを確認("N article(s) built")。
   - `dist/blog/<slug>/index.html` の生成を確認。
   - 警告(`[build] Skipping ...`, `Unknown affiliate id`)が出たら frontmatter やプレースホルダーを修正して再実行する。

4. **コミット**
   - ユーザーから明示的に依頼された場合のみ、`affiliate/content/<slug>.md` をコミットする。`dist/` はコミットしない。

## 納品チェックリスト

- [ ] slug重複なし・英小文字ハイフンのみ
- [ ] frontmatter 6項目すべて充足
- [ ] `{{aff:ID}}` は登録済みIDのみ・1〜2箇所
- [ ] ビルド警告0件・記事数+1
- [ ] 誇大広告・断定的な効果表現なし(景品表示法配慮)

## 注意事項

- `affiliate/content/` 以外(root の index.html, app.js, review.js, styles.css, assets/)は変更しない。
- 記事は日本語で、景品表示法に配慮した自然な紹介文にする。
