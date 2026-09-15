---
name: new-article
description: 新しいアフィリエイト記事を1本生成してビルド確認する。トピックを引数で指定可能
---

# new-article

このスキルは、`affiliate/content/` に新しいアフィリエイト記事を1本追加し、ビルドを確認するための手順です。引数でトピックが指定された場合はそれを使用し、指定がない場合は既存記事と重複しないトピックを自分で選んでください。

## 手順

1. **既存記事の確認**
   - `affiliate/content/*.md` を一覧し、各ファイルの frontmatter (`title`, `slug`, `category`, `tags`) を読む。
   - 既にカバーされているトピック・スラッグを把握し、重複しない新しいトピックを選ぶ(引数でトピックが指定されている場合はそれを優先)。
   - `affiliate/links.json` を読み、利用可能なアフィリエイトID一覧を確認する。

2. **記事の作成**
   - `affiliate/content/<slug>.md` を新規作成する。`<slug>` は英小文字とハイフンのみ。
   - frontmatter は以下のスキーマに厳密に従うこと:
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
   - 本文は1200〜2000文字程度の日本語。`#`/`##`/`###` 見出し、`**太字**`、リンク `[text](url)`、箇条書き `- `、番号リスト `1. `、`` `インラインコード` ``、フェンスコードブロック、`> 引用`、`---` 区切りに対応した簡易Markdownとして書く(build.mjs のレンダラーが対応する範囲のみ使用)。
   - `affiliate/links.json` に登録されているIDを使い、本文中の自然な流れに `{{aff:ID}}` プレースホルダーを1〜2箇所挿入する。存在しないIDは使わないこと。

3. **ビルドで検証**
   - `node affiliate/build.mjs` を実行し、警告なく記事が1件増えていることを確認する(出力の "N article(s) built" を確認)。
   - `dist/blog/<slug>/index.html` が生成されていることを確認する。
   - 警告(`[build] Skipping ...` や `Unknown affiliate id` など)が出た場合は frontmatter やプレースホルダーを修正して再実行する。

4. **コミット**
   - `affiliate/content/<slug>.md` をステージしてコミットする(ユーザーから明示的に依頼された場合のみ)。`dist/` はコミットしない。

## 注意事項

- `affiliate/content/` 以外のディレクトリ(root の index.html, app.js, review.js, styles.css, assets/)は変更しないこと。
- 記事は日本語で、景品表示法に配慮した自然な紹介文にすること(誇大広告・断定的な効果表現は避ける)。
