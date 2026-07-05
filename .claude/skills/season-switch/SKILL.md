---
name: season-switch
description: 英単語バトルレートのシーズン切替を安全に実行する。新シーズンのID/名前を受け取り、バックアップ確認→app.js/index.htmlの一括更新→スモークテスト→コミットまでを定型手順で行う。「シーズンを切り替えて」「新シーズンにして」と言われたら使う。
---

# シーズン切替 Skill

## 入力(ユーザーから聞く。なければ質問する)
- 新シーズンID(半角小文字英数字+_。例: `snow_season`)
- 新シーズン表示名(例: `Snow Season`)
- 新バナー画像の有無(assets/ にあるか。なければバナー据え置きで進めてよい)

## 手順
1. **バックアップ確認(必須・スキップ禁止)**: ユーザーに「管理者ページで『共有データをバックアップ』を実行済みか」を確認する。未実施なら実施してもらうまで進めない。
2. dry-runで差分提示:
   ```
   node ops/scripts/switch-season.mjs --id <ID> --name "<名前>" [--banner assets/<画像>]
   ```
3. ユーザー(または明確な事前指示)の承認後、`--apply` を付けて適用。
4. スモークテスト: `node ops/scripts/smoke-test.mjs` — NGならリリース中止して修正。
5. `git diff` を確認し、`season: <ID>へ切替` の形式でコミットして指定ブランチにpush。
6. 残タスクをユーザーに提示: GAS/スプレッドシート側のシーズン設定更新、本番URLでの表示確認(ops/checklists/season-switch-checklist.md 参照)。

## 禁止事項
- バックアップ確認なしでの `--apply`
- CLIENT_DATA_VERSION の手動編集(必ずスクリプト経由。書換漏れは全端末のローカルデータ破壊につながる)
