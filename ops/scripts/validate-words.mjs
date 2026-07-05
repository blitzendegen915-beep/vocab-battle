#!/usr/bin/env node
/**
 * validate-words.mjs — 単語データ検証・整形ツール
 *
 * Wordsシートに貼る前のTSV/CSVを、app.js の normalizeWord と同じ基準で検証し、
 * クリーンなTSV(word / meaning / difficulty / unit / enabled)に整形する。
 *
 * 使い方:
 *   node ops/scripts/validate-words.mjs input.tsv
 *   node ops/scripts/validate-words.mjs input.csv --out clean.tsv
 *   node ops/scripts/validate-words.mjs input.tsv --unit "ターゲット1900" --difficulty 10
 *
 * オプション:
 *   --out <file>        整形済みTSVの出力先(省略時は標準出力)
 *   --unit <name>       unit列が空の行に入れる教材名(既定: General)
 *   --difficulty <n>    difficulty列が空の行に入れる難易度(既定: 1)
 *
 * 終了コード: 0=OK(警告のみ含む) / 1=エラーあり(出力しない) / 2=使い方エラー
 */
import { readFileSync, writeFileSync } from "node:fs";

const HEADER_WORDS = ["word", "単語", "meaning", "意味", "難易度", "difficulty", "unit", "教材", "enabled", "有効"];

function fail(message) {
  console.error(`エラー: ${message}`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { input: null, out: null, unit: "General", difficulty: 1 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") args.out = argv[++i];
    else if (arg === "--unit") args.unit = argv[++i];
    else if (arg === "--difficulty") args.difficulty = Number(argv[++i]);
    else if (arg.startsWith("--")) fail(`不明なオプション: ${arg}`);
    else if (!args.input) args.input = arg;
    else fail(`入力ファイルは1つだけ指定してください: ${arg}`);
  }
  if (!args.input) fail("入力ファイルを指定してください。例: node ops/scripts/validate-words.mjs words.tsv");
  if (!Number.isFinite(args.difficulty) || args.difficulty <= 0) fail("--difficulty は1以上の数値で指定してください。");
  return args;
}

// クォート対応の簡易CSVパーサ(タブ区切りならタブで分割)
function parseTable(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell); cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((cells) => cells.some((value) => String(value).trim() !== ""));
}

function looksLikeHeader(cells) {
  return cells.some((cell) => HEADER_WORDS.includes(String(cell).trim().toLowerCase()));
}

// app.js normalizeWord と同じ判定
function parseEnabled(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return true;
  return raw === true || String(raw).trim().toUpperCase() === "TRUE" || String(raw).trim() === "1";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let text;
  try {
    text = readFileSync(args.input, "utf8");
  } catch {
    fail(`ファイルを読めません: ${args.input}`);
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM除去

  const delimiter = args.input.toLowerCase().endsWith(".csv") && !text.includes("\t") ? "," : "\t";
  let rows = parseTable(text, delimiter);
  if (!rows.length) fail("データ行がありません。");
  if (looksLikeHeader(rows[0])) rows = rows.slice(1);
  if (!rows.length) fail("ヘッダーだけでデータ行がありません。");

  const errors = [];
  const warnings = [];
  const clean = [];
  const seen = new Map(); // "word|unit" -> 行番号

  rows.forEach((cells, index) => {
    const line = index + 1;
    const word = String(cells[0] ?? "").trim();
    const meaning = String(cells[1] ?? "").trim();
    const difficultyRaw = String(cells[2] ?? "").trim();
    const unit = String(cells[3] ?? "").trim() || args.unit;
    const enabledRaw = cells[4];

    if (!word) { errors.push(`${line}行目: word(単語)が空です`); return; }
    if (!meaning) { errors.push(`${line}行目: "${word}" の meaning(意味)が空です`); return; }
    if (/[　-鿿！-｠]/.test(word)) warnings.push(`${line}行目: word "${word}" に全角/日本語文字が含まれています(列ずれの可能性)`);
    if (/^[a-zA-Z\s'/-]+$/.test(meaning)) warnings.push(`${line}行目: meaning "${meaning}" が英字のみです(列ずれの可能性)`);

    let difficulty = Number(difficultyRaw);
    if (difficultyRaw === "") {
      difficulty = args.difficulty;
      warnings.push(`${line}行目: "${word}" の難易度が空のため ${args.difficulty} を設定しました`);
    } else if (!Number.isFinite(difficulty) || difficulty <= 0) {
      warnings.push(`${line}行目: "${word}" の難易度 "${difficultyRaw}" は無効です(アプリ側で1扱い)。1に置き換えました`);
      difficulty = 1;
    }

    const enabled = parseEnabled(enabledRaw);
    if (!enabled) warnings.push(`${line}行目: "${word}" は enabled=FALSE のため出題対象外になります`);

    const key = `${word.toLowerCase()}|${unit}`;
    if (seen.has(key)) {
      errors.push(`${line}行目: "${word}"(教材: ${unit})が ${seen.get(key)}行目 と重複しています`);
      return;
    }
    seen.set(key, line);

    clean.push([word, meaning, difficulty, unit, enabled ? "TRUE" : "FALSE"]);
  });

  warnings.forEach((message) => console.error(`警告: ${message}`));
  errors.forEach((message) => console.error(`エラー: ${message}`));
  console.error(`---\n入力 ${rows.length}行 / 有効 ${clean.length}語 / 警告 ${warnings.length}件 / エラー ${errors.length}件`);

  if (errors.length) {
    console.error("エラーを修正してから再実行してください。整形結果は出力していません。");
    process.exit(1);
  }

  const tsv = ["word\tmeaning\tdifficulty\tunit\tenabled", ...clean.map((cells) => cells.join("\t"))].join("\n") + "\n";
  if (args.out) {
    writeFileSync(args.out, tsv, "utf8");
    console.error(`整形済みTSVを書き出しました: ${args.out}(Wordsシートまたは管理者ページの貼り付け欄へコピーして使用)`);
  } else {
    process.stdout.write(tsv);
  }
}

main();
