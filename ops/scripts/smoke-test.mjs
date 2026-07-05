#!/usr/bin/env node
/**
 * smoke-test.mjs — リリース前スモークテスト
 *
 * ローカルで静的サーバーを立ち上げ、実ブラウザ(Chromium)でアプリを開いて
 * 「壊れていないか」を自動チェックする。GitHubへアップロードする前に必ず実行する。
 *
 * 使い方:
 *   node ops/scripts/smoke-test.mjs
 *
 * チェック内容:
 *   1. ページが開き、タイトルが表示される
 *   2. JavaScriptの未捕捉エラー(pageerror)がない
 *   3. 生徒/管理者タブ・プレイヤー登録フォーム・スタートボタンが存在する
 *   4. 「サンプルで試す」で単語が読み込まれる(コアのクイズデータ経路が生きている)
 *   5. モード切替(お気軽モード)が反応する
 *
 * 注意: 外部通信(GAS・CDN)は遮断してテストする=オフライン動作の検証。
 *       GAS連携そのものは本番で手動確認する(release-checklist.md 参照)。
 * 終了コード: 0=全部OK / 1=失敗あり
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);

function loadPlaywright() {
  const candidates = ["playwright", "/opt/node22/lib/node_modules/playwright"];
  for (const name of candidates) {
    try { return require(name); } catch { /* 次の候補へ */ }
  }
  console.error("エラー: playwright が見つかりません。`npm i -g playwright` を実行してください。");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function startServer() {
  return new Promise((resolvePromise) => {
    const server = createServer(async (req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const relative = urlPath === "/" ? "index.html" : urlPath.slice(1);
      const filePath = join(repoRoot, normalize(relative));
      if (!filePath.startsWith(repoRoot)) { res.writeHead(403).end(); return; }
      try {
        const body = await readFile(filePath);
        res.writeHead(200, { "content-type": MIME[extname(filePath)] || "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404).end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolvePromise(server));
  });
}

async function main() {
  const { chromium } = loadPlaywright();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;

  const results = [];
  const check = (name, ok, detail = "") => {
    results.push({ name, ok, detail });
    console.log(`${ok ? "OK " : "NG "} ${name}${detail ? ` — ${detail}` : ""}`);
  };

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    // 外部通信を遮断(GAS/CDNなしでも動くこと=生徒の通信不安定時の動作を検証)
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith(base)) route.continue();
      else route.abort();
    });

    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    check("ページタイトル", (await page.title()).includes("英単語"), await page.title());
    check("タブが2つある(生徒/管理者)", await page.locator(".tab").count() === 2);
    check("プレイヤー登録フォームがある", await page.locator("#playerForm input").count() >= 4);
    check("スタートボタンがある", await page.locator("#startButton").count() === 1);

    await page.click("#sampleButton");
    await page.waitForTimeout(300);
    const wordStatus = await page.locator("#wordStatus").textContent();
    check("サンプル単語が読み込める", /語を読み込みました/.test(wordStatus || ""), (wordStatus || "").trim());

    await page.check('input[name="battleMode"][value="casual"]');
    await page.waitForTimeout(300);
    const rangeDisabled = await page.locator("#rangeInputs.disabled").count();
    check("お気軽モードで範囲指定が有効になる", rangeDisabled === 0);

    check("JSの未捕捉エラーなし", pageErrors.length === 0, pageErrors.slice(0, 3).join(" / "));
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`---\n${results.length}項目中 ${results.length - failed.length}件OK / ${failed.length}件NG`);
  if (failed.length) {
    console.log("NGがあります。リリース(アップロード/push)を中止して原因を直してください。");
    process.exit(1);
  }
  console.log("スモークテスト合格。リリースに進めます(GAS連携は本番で最終確認)。");
}

main().catch((error) => {
  console.error("スモークテスト自体が異常終了:", error);
  process.exit(1);
});
