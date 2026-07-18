# カスタムSkills一覧

このリポジトリで使えるClaude Codeカスタムスキルの索引。各スキルの詳細は各ディレクトリの `SKILL.md` を参照。

| スキル | 用途 | 依存ファイルの所在 |
|---|---|---|
| `qa-smoke` | リリース前スモークテスト実行と合否報告 | `ops/scripts/smoke-test.mjs`(workflow-automation-strategyブランチ) |
| `season-switch` | シーズン切替の定型手順(バックアップ確認→適用→テスト→コミット) | `ops/scripts/switch-season.mjs` ほか(同上) |
| `word-import` | 単語データの生成・検証・TSV納品 | `ops/scripts/validate-words.mjs`, `ops/prompts/word-list-generator.md`(同上) |
| `affiliate-status` | アフィリエイトブログの点検レポート | `affiliate/`(ai-affiliate-earningsブランチ) |
| `new-article` | アフィリエイト記事の新規作成+ビルド検証 | `affiliate/`(同上) |
| `video-production` | ffmpegベースの動画制作ワークフロー | なし(スクラッチパッドで完結) |

## 運用メモ

- スキル本体(このディレクトリ)と依存スクリプトが別ブランチにある場合、スキル実行前に該当ブランチから依存ファイルを取り込むこと。各SKILL.mdの「前提」節に必要ファイルを明記してある。
- 全スキルを常用するなら、このディレクトリと `ops/`・`affiliate/` をmainへマージするのが最も安全。
- 新しい落とし穴・実測値を得たら、その場で該当SKILL.mdに追記してコミットする。
