#!/usr/bin/env node
/**
 * switch-season.mjs — シーズン切替ツール
 *
 * app.js の CURRENT_SEASON_ID / CURRENT_SEASON_NAME / CLIENT_DATA_VERSION と、
 * index.html のキャッシュバスター(app.js?v=...)、必要ならシーズンバナーを一括更新する。
 *
 * 使い方(まずdry-runで差分確認 → 問題なければ --apply):
 *   node ops/scripts/switch-season.mjs --id snow_season --name "Snow Season"
 *   node ops/scripts/switch-season.mjs --id snow_season --name "Snow Season" --banner assets/snow-season.png --apply
 *
 * オプション:
 *   --id <season_id>    半角小文字英数字とアンダースコアのみ(例: snow_season)
 *   --name <名前>       表示用シーズン名(例: "Snow Season")
 *   --banner <path>     新バナー画像のパス(省略時はバナー据え置き)
 *   --apply             実際にファイルを書き換える(省略時はdry-run=確認のみ)
 *
 * 注意: 実行前に必ず管理者ページ「共有データをバックアップ」でCSVを保存すること。
 *       GAS/スプレッドシート側のシーズン設定は別途更新が必要(チェックリスト参照)。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP_JS = resolve(repoRoot, "app.js");
const INDEX_HTML = resolve(repoRoot, "index.html");

function fail(message) {
  console.error(`エラー: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { id: null, name: null, banner: null, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--id") args.id = argv[++i];
    else if (arg === "--name") args.name = argv[++i];
    else if (arg === "--banner") args.banner = argv[++i];
    else if (arg === "--apply") args.apply = true;
    else fail(`不明なオプション: ${arg}`);
  }
  if (!args.id || !args.name) {
    fail('使い方: node ops/scripts/switch-season.mjs --id snow_season --name "Snow Season" [--banner assets/xxx.png] [--apply]');
  }
  if (!/^[a-z][a-z0-9_]*$/.test(args.id)) fail(`--id は半角小文字英数字と_のみ: "${args.id}"`);
  return args;
}

// 定数1つを書き換え、変更前後を記録する。見つからなければエラー。
function replaceConst(source, constName, newValue, changes) {
  const pattern = new RegExp(`^(const ${constName} = ")([^"]*)(";)$`, "m");
  const match = source.match(pattern);
  if (!match) fail(`app.js に const ${constName} が見つかりません。手動で確認してください。`);
  changes.push({ file: "app.js", label: constName, before: match[2], after: newValue });
  return source.replace(pattern, `$1${newValue}$3`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const changes = [];

  let appJs = readFileSync(APP_JS, "utf8");
  let indexHtml = readFileSync(INDEX_HTML, "utf8");

  // --- app.js: シーズン定数3つ ---
  const dataVersion = `${args.id}_attempts_v1`;
  appJs = replaceConst(appJs, "CURRENT_SEASON_ID", args.id, changes);
  appJs = replaceConst(appJs, "CURRENT_SEASON_NAME", args.name, changes);
  appJs = replaceConst(appJs, "CLIENT_DATA_VERSION", dataVersion, changes);

  // --- index.html: キャッシュバスター ---
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const newVersion = `season-${args.id}-${today}`;
  const scriptPattern = /(<script src="app\.js\?v=)([^"]*)("><\/script>)/;
  const scriptMatch = indexHtml.match(scriptPattern);
  if (!scriptMatch) fail("index.html に app.js?v=... のscriptタグが見つかりません。");
  changes.push({ file: "index.html", label: "キャッシュバスター", before: scriptMatch[2], after: newVersion });
  indexHtml = indexHtml.replace(scriptPattern, `$1${newVersion}$3`);

  // --- index.html: シーズンバナー(--banner指定時のみ) ---
  if (args.banner) {
    if (!existsSync(resolve(repoRoot, args.banner))) {
      fail(`バナー画像が存在しません: ${args.banner}(先に assets/ に画像を追加してください)`);
    }
    const bannerPattern = /(<section class="season-banner"[^>]*>\s*<img src=")([^"]*)(" alt=")([^"]*)(")/;
    const bannerMatch = indexHtml.match(bannerPattern);
    if (!bannerMatch) fail("index.html に season-banner の imgタグが見つかりません。");
    const newAlt = `${args.name} new rating season.`;
    changes.push({ file: "index.html", label: "バナー画像", before: bannerMatch[2], after: args.banner });
    changes.push({ file: "index.html", label: "バナーalt", before: bannerMatch[4], after: newAlt });
    indexHtml = indexHtml.replace(bannerPattern, `$1${args.banner}$3${newAlt}$5`);
  }

  // --- 差分表示 ---
  console.log(args.apply ? "=== 適用した変更 ===" : "=== dry-run(まだ書き換えていません)===");
  for (const change of changes) {
    console.log(`[${change.file}] ${change.label}\n  変更前: ${change.before}\n  変更後: ${change.after}`);
  }

  if (!args.apply) {
    console.log("\n内容が正しければ --apply を付けて再実行してください。");
    console.log("★実行前チェック: 管理者ページで「共有データをバックアップ」を済ませましたか?");
    return;
  }

  writeFileSync(APP_JS, appJs, "utf8");
  writeFileSync(INDEX_HTML, indexHtml, "utf8");
  console.log("\napp.js と index.html を更新しました。");
  console.log("次にやること(ops/checklists/season-switch-checklist.md 参照):");
  console.log("  1. GAS/スプレッドシート側のシーズン設定を更新");
  console.log("  2. node ops/scripts/smoke-test.mjs で動作確認");
  console.log("  3. git diff で差分確認 → commit & push でリリース");
}

main();
