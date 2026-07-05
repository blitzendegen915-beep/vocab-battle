# ops/ — 英単語バトルレート 運用ツール一式

このフォルダは「アプリ運用をAIとスクリプトに任せ、人間は判断だけする」ための業務OS。
作成: 2026-07-05(Claude Codeセッション)

## 何がどこにあるか

| パス | 中身 | いつ使う |
|---|---|---|
| `business-map.md` | 業務の棚卸しとボトルネック分析 | 迷ったら読む |
| `improvement-backlog.md` | 改善案15個+優先順位 | 次に何を作るか決める時 |
| `scripts/validate-words.mjs` | 単語データ検証・整形 | 単語を追加する前に毎回 |
| `scripts/switch-season.mjs` | シーズン切替の一括書換 | シーズン切替時 |
| `scripts/smoke-test.mjs` | リリース前の自動動作確認 | push/アップロード前に毎回 |
| `checklists/season-switch-checklist.md` | シーズン切替の全手順 | シーズン切替時 |
| `checklists/release-checklist.md` | リリース手順と巻き戻し方 | コード変更のたび |
| `monetization/monetization-plan.md` | 収益化ロードマップ(90日) | 収益化の意思決定 |
| `monetization/adsense-readiness-checklist.md` | AdSense審査準備 | 広告導入時 |
| `monetization/privacy-policy.html` | プライバシーポリシー下書き | 公開前に要記入・要承認 |
| `prompts/word-list-generator.md` | 単語リスト生成プロンプト | 単語データが欲しい時 |
| `prompts/sponsor-outreach.md` | スポンサー営業文テンプレ | 営業開始時 |
| `../.claude/skills/` | Claude用Skill(season-switch / word-import / qa-smoke) | Claudeセッションで自動適用 |

## 明日からの運用手順(基本サイクル)

1. **単語を足したい** → Claudeに「◯◯レベルの単語100語作って」(word-import Skillが動く)→ 出てきたTSVをWordsシートに貼る
2. **コードを直したい** → Claudeセッションで修正を依頼 → smoke-test合格 → push(Web UIアップロードはもう使わない)
3. **シーズンを切り替えたい** → Claudeに「シーズン切替。IDは◯◯、名前は◯◯」→ バックアップ確認に答える → あとは自動
4. **収益化を進めたい** → `monetization/monetization-plan.md` のPhase 1から。今週やるのは「プライバシーポリシー公開」と「利用統計の取得開始」

## 人間にしかできないこと(AIに任せない)
- バックアップ実行の最終確認 / 収益化の申請・契約・課金 / 外部への送信・投稿 / 生徒対応の最終判断 / 副業規定の確認
