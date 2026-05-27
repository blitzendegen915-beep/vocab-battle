const DEFAULT_SETTINGS = {
  quizLength: 10,
  timeLimitSec: 8,
  dailyAttemptLimitEnabled: true,
  dailyAttemptLimit: 5,
  seasonAttemptLimitEnabled: false,
  seasonAttemptLimit: 5
};
const STORAGE = {
  gasUrl: "gasWebAppUrl",
  currentPlayer: "currentPlayer",
  cachedWords: "cachedWords",
  cachedSettings: "cachedSettings",
  cachedRanking: "cachedRanking",
  cachedWordSets: "cachedWordSets",
  selectedWordSet: "selectedWordSet",
  selectedUnit: "selectedUnit",
  battleMode: "battleMode",
  rangeStart: "rangeStart",
  rangeEnd: "rangeEnd",
  localHistory: "vocabBattleHistory",
  clientVersion: "vocabBattleClientVersion"
};
const ADMIN_SESSION_KEY = "vocabBattleAdminUnlocked";
const ADMIN_PIN_SESSION_KEY = "vocabBattleAdminPin";
const ADMIN_PASSWORD_HASH = "75ae5d65da5fbbbcaf62828269c71b049d88755196f6fab97dd3a04a6720fd92";
const CURRENT_SEASON_ID = "drizzle_season";
const CURRENT_SEASON_NAME = "Drizzle Season";
const CLIENT_DATA_VERSION = "drizzle_season_attempts_v2";
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbxEQvr8axjvFfIwQSOOd_rIYy-cyt92BZ62eAxjuY1XdojQsYYDV1Ne7svW3_UkS4Rt/exec";
const OLD_GAS_URLS = [
  "https://script.google.com/macros/s/AKfycbytVz4FsKrCy1160KkpnvksFiluhOW8EtQQtppF1SW1S3X_9-Ki05AjSaoylhro06ti/exec",
  "https://script.google.com/macros/s/AKfycbw4wucQB8S-zT530pAJk1ogBWfHBQ4XBb86lebV8yuLCIRghx88Wt4IunD07fAEcgeE/exec"
];

const sampleWords = [
  { word: "important", meaning: "重要な", difficulty: 6, unit: "Sample", enabled: true },
  { word: "accurate", meaning: "正確な", difficulty: 12, unit: "Sample", enabled: true },
  { word: "reluctant", meaning: "気が進まない", difficulty: 19, unit: "Sample", enabled: true },
  { word: "dog", meaning: "犬", difficulty: 1, unit: "Sample", enabled: true },
  { word: "implicitly", meaning: "暗黙のうちに", difficulty: 30, unit: "Sample", enabled: true },
  { word: "ambiguous", meaning: "曖昧な", difficulty: 24, unit: "Sample", enabled: true }
];

let words = [];
let activeWords = [];
let wordSets = [{ setId: "default", label: "標準" }];
let settings = { ...DEFAULT_SETTINGS };
let currentPlayer = null;
let currentQuiz = [];
let currentIndex = 0;
let correctCount = 0;
let earnedWeight = 0;
let totalWeight = 0;
let answerLogs = [];
let questionStartedAt = 0;
let timerId = null;
let locked = false;
let powerBeforeBattle = 1000;
let activeAttemptId = "";

const $ = (id) => document.getElementById(id);

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", async () => {
    if (tab.dataset.adminTab && !(await confirmAdminAccess())) return;
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    tab.classList.add("active");
    $(tab.dataset.view).classList.add("active");
    if (tab.dataset.view === "adminView") refreshAdmin();
  });
});

async function confirmAdminAccess() {
  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "true") return true;
  if (!crypto.subtle) {
    alert("このブラウザでは管理者確認ができません。別のブラウザで開いてください。");
    return false;
  }
  const password = prompt("管理者パスワードを入力してください。");
  if (password === null) return false;
  const isValid = (await sha256(password)) === ADMIN_PASSWORD_HASH;
  if (isValid) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    sessionStorage.setItem(ADMIN_PIN_SESSION_KEY, password);
    return true;
  }
  alert("パスワードが違います。");
  return false;
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function applyGasUrlFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const gasUrl = params.get("gas");
  if (!gasUrl) return;
  localStorage.setItem(STORAGE.gasUrl, normalizeGasUrl(gasUrl));
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("gas");
  window.history.replaceState({}, "", cleanUrl.toString());
}

function normalizeGasUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed || OLD_GAS_URLS.includes(trimmed)) return DEFAULT_GAS_URL;
  return trimmed === DEFAULT_GAS_URL ? trimmed : DEFAULT_GAS_URL;
}

function migrateOldGasUrl() {
  const saved = localStorage.getItem(STORAGE.gasUrl);
  if (normalizeGasUrl(saved) !== saved) {
    localStorage.setItem(STORAGE.gasUrl, DEFAULT_GAS_URL);
  }
}

function getGasUrl() {
  const saved = localStorage.getItem(STORAGE.gasUrl);
  return normalizeGasUrl(saved);
}

function setGasUrl(url) {
  localStorage.setItem(STORAGE.gasUrl, normalizeGasUrl(url));
  updateCloudStatus();
}

function migrateClientData() {
  if (localStorage.getItem(STORAGE.clientVersion) === CLIENT_DATA_VERSION) return;
  [
    STORAGE.currentPlayer,
    STORAGE.cachedWords,
    STORAGE.cachedSettings,
    STORAGE.cachedRanking,
    STORAGE.cachedWordSets
  ].forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(STORAGE.gasUrl, DEFAULT_GAS_URL);
  localStorage.setItem(STORAGE.clientVersion, CLIENT_DATA_VERSION);
}

function updateCloudStatus(message = "") {
  const url = getGasUrl();
  $("gasUrlInput").value = url;
  $("cloudStatus").textContent = message || (url ? "共有保存が有効です。" : "GAS URLが設定されていません。");
  $("syncStatus").textContent = url ? "共有保存が有効です。" : "共有保存は未設定です。";
  $("adminSaveStatus").textContent = url ? "有効" : "未設定";
}

function jsonp(action, params = {}) {
  const url = getGasUrl();
  if (!url) return Promise.reject(new Error("GAS URLが設定されていません。"));

  return new Promise((resolve, reject) => {
    const callback = `vocabBattleCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const query = new URLSearchParams({ action, callback, ...params });
    const separator = url.includes("?") ? "&" : "?";
    const timeoutId = window.setTimeout(() => {
      delete window[callback];
      script.remove();
      reject(new Error("通信失敗"));
    }, 12000);

    window[callback] = (data) => {
      window.clearTimeout(timeoutId);
      delete window[callback];
      script.remove();
      resolve(data);
    };

    script.onerror = () => {
      window.clearTimeout(timeoutId);
      delete window[callback];
      script.remove();
      reject(new Error("通信失敗"));
    };

    script.src = `${url}${separator}${query.toString()}`;
    document.body.appendChild(script);
  });
}

async function postToCloud(payload) {
  const url = getGasUrl();
  if (!url) throw new Error("GAS URLが設定されていません。");
  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
}

function getPlayerForm() {
  return {
    className: $("className").value.trim(),
    studentNo: $("studentNo").value.trim(),
    nickname: $("nickname").value.trim(),
    pin: $("pin").value.trim()
  };
}

function buildPlayerId({ className, studentNo, nickname }) {
  return className && studentNo ? `${className}-${studentNo}-${nickname}` : nickname;
}

function validatePlayerForm(form) {
  if (!form.className) return "クラスを入力してください。";
  if (!form.studentNo) return "出席番号を入力してください。";
  if (!form.nickname) return "ニックネームを入力してください。";
  if (!form.pin) return "暗証番号を入力してください。";
  if (!/^\d{4,}$/.test(form.pin)) return "暗証番号は4桁以上の数字です。";
  return "";
}

function saveCurrentPlayer(player) {
  currentPlayer = player;
  localStorage.setItem(STORAGE.currentPlayer, JSON.stringify(player));
  updatePlayerStatus();
  updateScorePanel();
  updateStartState();
  refreshAttemptStatus();
}

function restoreCurrentPlayer() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.currentPlayer) || "null");
    if (!saved) return;
    if (!saved.seasonId || saved.seasonId !== CURRENT_SEASON_ID) {
      localStorage.removeItem(STORAGE.currentPlayer);
      currentPlayer = null;
      return;
    }
    currentPlayer = saved;
    $("className").value = saved.className || "";
    $("studentNo").value = saved.studentNo || "";
    $("nickname").value = saved.nickname || "";
    updatePlayerStatus();
  } catch {
    localStorage.removeItem(STORAGE.currentPlayer);
  }
}

function updatePlayerStatus(message = "") {
  if (!currentPlayer) {
    $("playerStatus").textContent = message || "クラス、出席番号、ニックネーム、暗証番号を入力してください。";
    $("powerDisplay").textContent = "1000";
    return;
  }
  $("playerStatus").textContent = message || `${currentPlayer.nickname} / 戦闘力 ${currentPlayer.power}`;
  $("powerDisplay").textContent = currentPlayer.power;
}

async function registerPlayer() {
  const form = getPlayerForm();
  const error = validatePlayerForm(form);
  if (error) {
    updatePlayerStatus(error);
    return;
  }
  if (!getGasUrl()) {
    updatePlayerStatus("GAS URLが設定されていません。");
    return;
  }

  const playerId = buildPlayerId(form);
  $("registerButton").disabled = true;
  updatePlayerStatus("確認しています。");
  try {
    const data = await jsonp("registerPlayer", {
      playerId,
      className: form.className,
      studentNo: form.studentNo,
      nickname: form.nickname,
      pin: form.pin
    });
    if (!data.ok) {
      updatePlayerStatus(data.message || "プレイヤー登録に失敗しました。");
      return;
    }
    saveCurrentPlayer(data.player);
    $("pin").value = "";
    loadRanking();
  } catch {
    updatePlayerStatus("通信に失敗しました。");
  } finally {
    $("registerButton").disabled = false;
  }
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase();
}

function pickColumn(row, names, fallbackIndex) {
  for (const name of names) {
    const found = Object.keys(row).find((key) => normalizeHeader(key) === normalizeHeader(name));
    if (found) return row[found];
  }
  return Object.values(row)[fallbackIndex];
}

function normalizeWord(item) {
  const difficulty = Number(item.difficulty || item["難易度"] || 1);
  const enabledRaw = item.enabled ?? item["有効"] ?? true;
  const enabled = enabledRaw === true || String(enabledRaw).toUpperCase() === "TRUE" || String(enabledRaw) === "1";
  return {
    word: String(item.word || item["英単語"] || item["単語"] || "").trim(),
    meaning: String(item.meaning || item["意味"] || item["日本語"] || "").trim(),
    difficulty: Number.isFinite(difficulty) && difficulty > 0 ? difficulty : 1,
    unit: String(item.unit || item["単元"] || "").trim(),
    enabled,
    sourceNumber: Number(item.sourceNumber || item["番号"] || item["No"] || 0)
  };
}

function withSourceNumbers(list) {
  const unitCounts = {};
  return list.map((word, index) => {
    const unit = getUnitValue(word);
    unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    return {
      ...word,
      sourceNumber: Number(word.sourceNumber || index + 1),
      unitNumber: unitCounts[unit]
    };
  });
}

function parseRows(rows) {
  return rows.map((row) => normalizeWord({
    word: pickColumn(row, ["word", "英単語", "単語", "english"], 0),
    meaning: pickColumn(row, ["meaning", "意味", "日本語", "ja"], 1),
    difficulty: pickColumn(row, ["difficulty", "難易度", "level"], 2),
    unit: pickColumn(row, ["unit", "単元"], 3),
    enabled: pickColumn(row, ["enabled", "有効"], 4) || true
  })).filter((item) => item.word && item.meaning && item.enabled);
}

function parsePastedWords(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const rows = lines.map((line) => line.split(/\t|,/).map((cell) => cell.trim()));
  const first = rows[0].map((cell) => normalizeHeader(cell));
  const hasHeader = first.some((cell) => ["word", "英単語", "単語"].includes(cell));
  return (hasHeader ? rows.slice(1) : rows).map((cells) => normalizeWord({
    word: cells[0],
    meaning: cells[1],
    difficulty: cells[2],
    unit: cells[3],
    enabled: cells[4] ?? true
  })).filter((item) => item.word && item.meaning && item.enabled);
}

function setWords(nextWords, source = "local") {
  words = withSourceNumbers(nextWords);
  localStorage.setItem(STORAGE.cachedWords, JSON.stringify(words));
  renderUnitOptions();
  updateActiveWords();
  $("wordStatus").textContent = activeWords.length >= 4
    ? `${words.length}語を読み込みました。教材: ${getSelectedRangeLabel()}（${activeWords.length}語）${source === "cloud" ? "（共有）" : ""}`
    : `${words.length}語を読み込みました。選んだ範囲には単語が4語以上必要です。`;
  $("adminWordStatus").textContent = `${words.length}語の端末内単語データがあります。`;
  $("adminWordsCount").textContent = words.length;
  updateStartState();
}

function getUnitValue(word) {
  return String(word.unit || "").trim() || "ターゲット1900";
}

function getSelectedUnit() {
  return localStorage.getItem(STORAGE.selectedUnit) || "ターゲット1900";
}

function getSelectedWordSet() {
  return localStorage.getItem(STORAGE.selectedWordSet) || "default";
}

function getBattleMode() {
  return localStorage.getItem(STORAGE.battleMode) || "rating";
}

function isCasualMode() {
  return getBattleMode() === "casual";
}

function getSelectedUnitLabel() {
  return getSelectedUnit();
}

function getNumberRange() {
  const startRaw = Number($("rangeStart").value || localStorage.getItem(STORAGE.rangeStart) || 1);
  const start = Number.isFinite(startRaw) && startRaw > 0 ? Math.floor(startRaw) : 1;
  const endRaw = Number($("rangeEnd").value || localStorage.getItem(STORAGE.rangeEnd) || 0);
  const end = Number.isFinite(endRaw) && endRaw > 0 ? Math.floor(endRaw) : 0;
  return { start, end };
}

function isNumberRangeSpecified() {
  return isCasualMode();
}

function getSelectedRangeLabel() {
  if (!isCasualMode()) return `${getSelectedUnitLabel()} / 全範囲`;
  const { start, end } = getNumberRange();
  const unitLabel = getSelectedUnitLabel();
  const numberLabel = end ? `${start}〜${end}` : `${start}〜最後`;
  return `${unitLabel} / ${numberLabel}`;
}

function getSelectedUnitWords() {
  const selected = getSelectedUnit();
  return words.filter((word) => getUnitValue(word) === selected);
}

function getSelectedUnitMaxNumber(unitWords = getSelectedUnitWords()) {
  return unitWords.reduce((max, word, index) => {
    const number = Number(word.unitNumber || index + 1);
    return Number.isFinite(number) && number > max ? number : max;
  }, unitWords.length);
}

function updateRangeGuide(unitWords = getSelectedUnitWords()) {
  const maxNumber = getSelectedUnitMaxNumber(unitWords);
  if (!words.length) {
    $("rangeGuide").textContent = "単語データを読み込むと範囲が表示されます。";
    return;
  }
  $("rangeGuide").textContent = `${getSelectedUnitLabel()}で指定できる範囲: 1〜${maxNumber}`;
}

function renderWordSetOptions() {
  const input = $("wordSetSelect");
  const selected = getSelectedWordSet();
  input.value = wordSets.some((set) => set.setId === selected) ? selected : wordSets[0].setId;
  localStorage.setItem(STORAGE.selectedWordSet, input.value);
}

function loadCachedWordSets() {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE.cachedWordSets) || "[]");
    if (Array.isArray(cached) && cached.length) {
      wordSets = cached;
      renderWordSetOptions();
    }
  } catch {
    localStorage.removeItem(STORAGE.cachedWordSets);
  }
}

async function loadCloudWordSets() {
  if (!getGasUrl()) return;
  try {
    const data = await jsonp("wordSets");
    if (data.ok && Array.isArray(data.wordSets) && data.wordSets.length) {
      wordSets = data.wordSets;
      localStorage.setItem(STORAGE.cachedWordSets, JSON.stringify(wordSets));
      renderWordSetOptions();
    }
  } catch {
    renderWordSetOptions();
  }
}

function renderUnitOptions() {
  const select = $("unitSelect");
  const selected = getSelectedUnit();
  const units = [...new Set(words.map(getUnitValue))].sort((a, b) => a.localeCompare(b, "ja"));
  const options = units.length ? units : ["ターゲット1900"];
  select.innerHTML = options.map((unit) => `<option value="${escapeHtml(unit)}">${escapeHtml(unit)}</option>`).join("");
  select.value = options.includes(selected) ? selected : options[0];
  localStorage.setItem(STORAGE.selectedUnit, select.value);
}

function updateActiveWords() {
  const { start, end } = getNumberRange();
  const unitWords = getSelectedUnitWords();
  updateRangeGuide(unitWords);
  activeWords = isCasualMode()
    ? unitWords.filter((word) => {
      const number = Number(word.unitNumber || 0);
      return number >= start && (!end || number <= end);
    })
    : unitWords;
  $("unitStatus").textContent = words.length
    ? `${isCasualMode() ? "お気軽モード" : "ガチモード"}: ${getSelectedRangeLabel()}（${activeWords.length}語）`
    : "単語データを読み込むと選べます。";
  updateStartState();
}

function updateModeUI() {
  const mode = getBattleMode();
  document.querySelectorAll('input[name="battleMode"]').forEach((input) => {
    input.checked = input.value === mode;
  });
  const casual = isCasualMode();
  $("rangeInputs").classList.toggle("disabled", !casual);
  $("rangeGuide").classList.toggle("hidden", !casual);
  $("rangeStart").disabled = !casual;
  $("rangeEnd").disabled = !casual;
  updateActiveWords();
}

function saveNumberRange() {
  const start = $("rangeStart").value.trim();
  const end = $("rangeEnd").value.trim();
  if (start) localStorage.setItem(STORAGE.rangeStart, start);
  else localStorage.removeItem(STORAGE.rangeStart);
  if (end) localStorage.setItem(STORAGE.rangeEnd, end);
  else localStorage.removeItem(STORAGE.rangeEnd);
}

function restoreNumberRange() {
  $("rangeStart").value = localStorage.getItem(STORAGE.rangeStart) || "";
  $("rangeEnd").value = localStorage.getItem(STORAGE.rangeEnd) || "";
}

function loadCachedWords() {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE.cachedWords) || "[]");
    if (Array.isArray(cached) && cached.length) setWords(cached, "cache");
  } catch {
    localStorage.removeItem(STORAGE.cachedWords);
  }
}

async function loadCloudWords() {
  if (!getGasUrl()) {
    $("wordStatus").textContent = "GAS URLが設定されていません。";
    return;
  }
  $("wordStatus").textContent = "共有単語を読み込んでいます。";
  try {
    const data = await jsonp("words", { setId: getSelectedWordSet() });
    if (!data.ok || !Array.isArray(data.words)) {
      $("wordStatus").textContent = "共有単語を読み込めませんでした。";
      return;
    }
    setWords(data.words.map(normalizeWord).filter((item) => item.word && item.meaning && item.enabled), "cloud");
  } catch {
    $("wordStatus").textContent = "共有単語を読み込めませんでした。";
  }
}

function setSettings(nextSettings, source = "local") {
  settings = {
    quizLength: Number(nextSettings.quizLength || DEFAULT_SETTINGS.quizLength),
    timeLimitSec: Number(nextSettings.timeLimitSec || DEFAULT_SETTINGS.timeLimitSec),
    dailyAttemptLimitEnabled: nextSettings.dailyAttemptLimitEnabled === true || String(nextSettings.dailyAttemptLimitEnabled).toUpperCase() === "TRUE",
    dailyAttemptLimit: Number(nextSettings.dailyAttemptLimit || DEFAULT_SETTINGS.dailyAttemptLimit),
    seasonAttemptLimitEnabled: nextSettings.seasonAttemptLimitEnabled === true || String(nextSettings.seasonAttemptLimitEnabled).toUpperCase() === "TRUE",
    seasonAttemptLimit: Number(nextSettings.seasonAttemptLimit || DEFAULT_SETTINGS.seasonAttemptLimit)
  };
  settings.currentSeason = nextSettings.currentSeason || CURRENT_SEASON_ID;
  settings.dailyAttemptLimitEnabled = true;
  settings.dailyAttemptLimit = 5;
  settings.seasonAttemptLimitEnabled = false;
  if (!Number.isFinite(settings.quizLength) || settings.quizLength < 1) settings.quizLength = DEFAULT_SETTINGS.quizLength;
  if (!Number.isFinite(settings.timeLimitSec) || settings.timeLimitSec < 1) settings.timeLimitSec = DEFAULT_SETTINGS.timeLimitSec;
  if (!Number.isFinite(settings.dailyAttemptLimit) || settings.dailyAttemptLimit < 1) settings.dailyAttemptLimit = DEFAULT_SETTINGS.dailyAttemptLimit;
  if (!Number.isFinite(settings.seasonAttemptLimit) || settings.seasonAttemptLimit < 1) settings.seasonAttemptLimit = DEFAULT_SETTINGS.seasonAttemptLimit;
  localStorage.setItem(STORAGE.cachedSettings, JSON.stringify(settings));
  $("timeLimitDisplay").textContent = `${settings.timeLimitSec}秒`;
  $("adminQuizLength").textContent = settings.quizLength;
  $("adminTimeLimit").textContent = `${settings.timeLimitSec}秒`;
  updateScorePanel();
}

function loadCachedSettings() {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE.cachedSettings) || "null");
    if (cached && cached.currentSeason && cached.currentSeason !== CURRENT_SEASON_ID) {
      localStorage.removeItem(STORAGE.cachedSettings);
      setSettings(DEFAULT_SETTINGS);
      return;
    }
    setSettings(cached || DEFAULT_SETTINGS, "cache");
  } catch {
    setSettings(DEFAULT_SETTINGS);
  }
}

async function loadCloudSettings() {
  if (!getGasUrl()) return;
  try {
    const data = await jsonp("settings");
    if (data.ok && data.settings) setSettings(data.settings, "cloud");
  } catch {
    setSettings(settings);
  }
}

function updateStartState() {
  $("startButton").disabled = !(currentPlayer && (activeWords.length >= 4 || words.length >= 4));
}

function updateScorePanel() {
  $("powerDisplay").textContent = currentPlayer ? currentPlayer.power : "1000";
  $("seasonBestDisplay").textContent = currentPlayer ? (currentPlayer.seasonBestPower || currentPlayer.power || 1000) : "1000";
  $("allTimeBestDisplay").textContent = currentPlayer ? (currentPlayer.allTimeBestPower || currentPlayer.bestPower || currentPlayer.power || 1000) : "1000";
  $("accuracyDisplay").textContent = `${Math.round((correctCount / Math.max(1, currentIndex)) * 100)}%`;
  $("progressDisplay").textContent = `${Math.min(currentIndex, currentQuiz.length || settings.quizLength)} / ${currentQuiz.length || settings.quizLength}`;
  $("timeLimitDisplay").textContent = `${settings.timeLimitSec}秒`;
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuiz() {
  const count = Math.min(settings.quizLength, activeWords.length);
  return shuffle(activeWords).slice(0, count).map((question) => {
    const distractors = shuffle(activeWords.filter((item) => item.meaning !== question.meaning))
      .slice(0, 3)
      .map((item) => item.meaning);
    return { ...question, choices: shuffle([question.meaning, ...distractors]) };
  });
}

async function reserveRatingAttempt() {
  activeAttemptId = "";
  return true;
}

async function startQuiz() {
  if (!currentPlayer) {
    updatePlayerStatus("クラス、出席番号、ニックネーム、暗証番号を入力してください。");
    return;
  }
  if (activeWords.length < 4) {
    if (words.length >= 4) {
      activeWords = [...words];
      $("wordStatus").textContent = "選んだ範囲の単語が不足していたため、読み込み済み単語から開始します。";
    } else {
      $("wordStatus").textContent = "単語が4語以上必要です。共有単語を読み込んでください。";
      return;
    }
  }
  activeAttemptId = "";
  if (!(await reserveRatingAttempt())) return;
  currentQuiz = buildQuiz();
  currentIndex = 0;
  correctCount = 0;
  earnedWeight = 0;
  answerLogs = [];
  totalWeight = currentQuiz.reduce((sum, item) => sum + item.difficulty, 0);
  powerBeforeBattle = Number(currentPlayer.power || 1000);
  $("startBox").classList.add("hidden");
  $("resultBox").classList.add("hidden");
  $("questionBox").classList.remove("hidden");
  updateScorePanel();
  showQuestion();
}

function showQuestion() {
  locked = false;
  const question = currentQuiz[currentIndex];
  questionStartedAt = Date.now();
  $("questionNumber").textContent = `第${currentIndex + 1}問`;
  $("difficultyLabel").textContent = `難易度 ${question.difficulty}`;
  $("wordPrompt").textContent = question.word;
  $("feedback").textContent = "";
  $("choices").innerHTML = "";
  question.choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.textContent = choice;
    button.addEventListener("click", () => answer(choice, false, button));
    $("choices").appendChild(button);
  });
  startTimer();
}

function startTimer() {
  window.clearInterval(timerId);
  const limitMs = settings.timeLimitSec * 1000;
  updateTimer(limitMs);
  timerId = window.setInterval(() => {
    const remaining = Math.max(0, limitMs - (Date.now() - questionStartedAt));
    updateTimer(remaining);
    if (remaining <= 0) {
      window.clearInterval(timerId);
      answer("", true, null);
    }
  }, 100);
}

function updateTimer(remainingMs) {
  const ratio = Math.max(0, Math.min(1, remainingMs / (settings.timeLimitSec * 1000)));
  $("timerDisplay").textContent = Math.ceil(remainingMs / 1000);
  $("timerBar").style.width = `${ratio * 100}%`;
  $("timerBar").classList.toggle("danger", ratio <= 0.3);
}

function answer(choice, timedOut, selectedButton) {
  if (locked) return;
  locked = true;
  window.clearInterval(timerId);

  const question = currentQuiz[currentIndex];
  const responseTimeMs = Math.min(Date.now() - questionStartedAt, settings.timeLimitSec * 1000);
  const isCorrect = !timedOut && choice === question.meaning;

  document.querySelectorAll(".choice").forEach((button) => {
    button.disabled = true;
    if (button.textContent === question.meaning) button.classList.add("correct");
  });

  if (isCorrect) {
    correctCount += 1;
    earnedWeight += question.difficulty;
    $("feedback").textContent = "正解！";
  } else if (timedOut) {
    $("feedback").textContent = `時間切れ。正解は「${question.meaning}」`;
  } else {
    if (selectedButton) selectedButton.classList.add("wrong");
    $("feedback").textContent = `不正解。正解は「${question.meaning}」`;
  }

  answerLogs.push({
    word: question.word,
    correctMeaning: question.meaning,
    selectedMeaning: timedOut ? "" : choice,
    isCorrect,
    responseTimeMs,
    timedOut
  });

  currentIndex += 1;
  updateScorePanel();
  window.setTimeout(() => {
    if (currentIndex >= currentQuiz.length) finishQuiz();
    else showQuestion();
  }, 850);
}

function calculateDelta(avgTime) {
  const total = currentQuiz.length;
  const wrong = total - correctCount;
  const baseDelta = (correctCount - wrong) * 12;
  const speedBonus = avgTime <= (settings.timeLimitSec * 1000) / 2 ? 10 : 0;
  const timeoutPenalty = answerLogs.filter((log) => log.timedOut).length * -5;
  return baseDelta + speedBonus + timeoutPenalty;
}

async function finishQuiz() {
  const avgTime = Math.round(answerLogs.reduce((sum, log) => sum + log.responseTimeMs, 0) / Math.max(1, answerLogs.length));
  const scoreMode = isNumberRangeSpecified();
  const score = correctCount * 10;
  const delta = calculateDelta(avgTime);
  const powerAfter = Math.max(0, powerBeforeBattle + delta);
  if (!scoreMode) {
    const seasonBestPower = Math.max(Number(currentPlayer.seasonBestPower || 1000), powerAfter);
    currentPlayer = {
      ...currentPlayer,
      seasonId: CURRENT_SEASON_ID,
      seasonName: CURRENT_SEASON_NAME,
      power: powerAfter,
      seasonBestPower,
      bestPower: seasonBestPower,
      allTimeBestPower: seasonBestPower,
      lastPlayed: new Date().toISOString()
    };
    saveCurrentPlayer(currentPlayer);
  }

  $("questionBox").classList.add("hidden");
  $("resultBox").classList.remove("hidden");
  $("correctDisplay").textContent = `${correctCount} / ${currentQuiz.length}`;
  $("deltaDisplay").textContent = scoreMode ? `${score}点` : (delta >= 0 ? `+${delta}` : String(delta));
  $("avgTimeDisplay").textContent = `${(avgTime / 1000).toFixed(1)}秒`;
  $("resultSummary").textContent = scoreMode
    ? `お気軽モードです。1問10点で ${score}点 / ${currentQuiz.length * 10}点。戦闘力とランキングには反映されません。`
    : `正答率 ${Math.round((correctCount / currentQuiz.length) * 100)}%。戦闘力は ${powerBeforeBattle} から ${powerAfter} になりました。`;
  renderAnswerReview();

  const record = {
    date: new Date().toLocaleString("ja-JP"),
    playerId: currentPlayer.playerId,
    className: currentPlayer.className || "",
    studentNo: currentPlayer.studentNo || "",
    nickname: currentPlayer.nickname,
    correct: correctCount,
    total: currentQuiz.length,
    accuracy: Math.round((correctCount / currentQuiz.length) * 100),
    powerBefore: powerBeforeBattle,
    powerAfter: scoreMode ? powerBeforeBattle : powerAfter,
    delta: scoreMode ? 0 : delta,
    avgTime,
    answerLogs,
    mode: scoreMode ? "score" : "rating",
    score,
    attemptId: activeAttemptId
  };
  saveLocalHistory(record);

  if (scoreMode) {
    $("syncStatus").textContent = "お気軽モードのため、戦闘力は保存しません。";
    return;
  }

  if (getGasUrl()) {
    $("syncStatus").textContent = "結果を保存しています。";
    try {
      await postToCloud({ action: "result", record });
      $("syncStatus").textContent = "結果を保存しました。";
      activeAttemptId = "";
      loadRanking();
    } catch {
      $("syncStatus").textContent = "結果の保存に失敗しました。先生に伝えてください。";
    }
  }
}

function renderAnswerReview() {
  $("answerReviewList").innerHTML = answerLogs.map((log, index) => {
    const selected = log.timedOut ? "時間切れ" : log.selectedMeaning || "未回答";
    const resultClass = log.isCorrect ? "correct" : "wrong";
    const resultLabel = log.isCorrect ? "正解" : "不正解";
    return `
      <article class="answer-review-item ${resultClass}">
        <div class="answer-review-head">
          <span>第${index + 1}問</span>
          <strong>${escapeHtml(log.word)}</strong>
          <em>${resultLabel}</em>
        </div>
        <dl>
          <div><dt>正しい答え</dt><dd>${escapeHtml(log.correctMeaning)}</dd></div>
          <div><dt>あなたの回答</dt><dd>${escapeHtml(selected)}</dd></div>
          <div><dt>回答時間</dt><dd>${(Number(log.responseTimeMs || 0) / 1000).toFixed(1)}秒</dd></div>
        </dl>
      </article>
    `;
  }).join("");
}

async function copyAnswerReview() {
  const lines = answerLogs.map((log, index) => {
    const selected = log.timedOut ? "時間切れ" : (log.selectedMeaning || "未回答");
    const mark = log.isCorrect ? "○" : "×";
    return `${index + 1}. ${mark} ${log.word} / 正解: ${log.correctMeaning} / 回答: ${selected}`;
  });
  if (!lines.length) {
    alert("コピーする答え合わせがありません。");
    return;
  }
  await navigator.clipboard.writeText(lines.join("\n"));
  $("syncStatus").textContent = "答え一覧をコピーしました。";
}

async function retryWrongWords() {
  const wrongWords = answerLogs
    .filter((log) => !log.isCorrect)
    .map((log) => currentQuiz.find((word) => word.word === log.word))
    .filter(Boolean);
  if (wrongWords.length < 1) {
    alert("間違えた単語がありません。");
    return;
  }
  const distractorPool = words.length ? words : currentQuiz;
  currentQuiz = wrongWords.map((question) => {
    const distractors = shuffle(distractorPool.filter((item) => item.meaning !== question.meaning))
      .map((item) => item.meaning)
      .filter((meaning, index, array) => meaning && array.indexOf(meaning) === index)
      .slice(0, 3);
    return { ...question, choices: shuffle([question.meaning, ...distractors]) };
  });
  localStorage.setItem(STORAGE.battleMode, "casual");
  document.querySelectorAll('input[name="battleMode"]').forEach((input) => {
    input.checked = input.value === "casual";
  });
  $("rangeInputs").classList.add("disabled");
  $("rangeGuide").classList.add("hidden");
  $("rangeStart").disabled = true;
  $("rangeEnd").disabled = true;
  activeWords = wrongWords;
  $("resultBox").classList.add("hidden");
  $("startBox").classList.add("hidden");
  $("questionBox").classList.remove("hidden");
  currentIndex = 0;
  correctCount = 0;
  earnedWeight = 0;
  answerLogs = [];
  totalWeight = currentQuiz.reduce((sum, item) => sum + item.difficulty, 0);
  powerBeforeBattle = Number(currentPlayer?.power || 1000);
  $("wordStatus").textContent = `間違えた単語${wrongWords.length}語だけ再挑戦中です。お気軽モードなので戦闘力には反映しません。`;
  updateScorePanel();
  showQuestion();
}
async function refreshAttemptStatus() {
  if (!currentPlayer || !getGasUrl()) return;
  try {
    const data = await jsonp("attemptStatus", { playerId: currentPlayer.playerId });
    if (!data.ok || !data.enabled) return;
    const used = Number(data.countToday ?? data.countSeason ?? 0);
    const limit = Number(data.limit || settings.dailyAttemptLimit || 5);
    const left = Math.max(0, limit - used);
    $("syncStatus").textContent = `今日のガチモード残り ${left} / ${limit} 回`;
  } catch {
    // keep the normal status message when attempt status cannot be loaded
  }
}

function readLocalHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE.localHistory) || "[]");
  } catch {
    return [];
  }
}

function saveLocalHistory(record) {
  const history = readLocalHistory();
  history.unshift(record);
  localStorage.setItem(STORAGE.localHistory, JSON.stringify(history.slice(0, 200)));
}

async function loadCloudHistory() {
  if (!getGasUrl()) return null;
  const adminPin = sessionStorage.getItem(ADMIN_PIN_SESSION_KEY) || "";
  if (!adminPin) return null;
  try {
    const data = await jsonp("history", { adminPin });
    if (!data.ok) {
      $("adminSaveStatus").textContent = data.message || "履歴取得失敗";
      return null;
    }
    return Array.isArray(data.history) ? data.history : null;
  } catch {
    $("adminSaveStatus").textContent = "履歴取得失敗";
    return null;
  }
}

function renderRanking(data) {
  if (!data) return;
  const season = data.season || {};
  const top10 = Array.isArray(data.top10) ? data.top10 : [];
  const me = data.me || null;

  if (season.seasonId && season.seasonId !== CURRENT_SEASON_ID) {
    localStorage.removeItem(STORAGE.cachedRanking);
    $("seasonLabel").textContent = CURRENT_SEASON_NAME;
    $("rankingList").innerHTML = '<article class="ranking-card wide">Drizzle Seasonの順位はまだありません。</article>';
    $("myRankStatus").textContent = "古いシーズンの記録は表示しません。";
    return;
  }

  $("seasonLabel").textContent = season.seasonName || CURRENT_SEASON_NAME;
  $("adminSeasonName").textContent = season.seasonName || CURRENT_SEASON_NAME;

  if (me && me.rank) {
    const topPowers = top10.map((item) => Number(item.power || 0)).filter((power) => power > 0);
    const upperAverage = topPowers.length
      ? Math.round(topPowers.reduce((sum, power) => sum + power, 0) / topPowers.length)
      : Number(me.power || 0);
    const gapToUpper = Math.max(0, upperAverage - Number(me.power || 0));
    const playersAbove = Math.max(0, Number(me.rank || 1) - 1);
    $("rankingList").innerHTML = `
      <article class="ranking-card">
        <span>あなたの順位</span>
        <strong>${me.rank}位</strong>
      </article>
      <article class="ranking-card">
        <span>今期戦闘力</span>
        <strong>${me.power}</strong>
      </article>
      <article class="ranking-card">
        <span>上位平均との差</span>
        <strong>${gapToUpper === 0 ? "上位平均以上" : `${gapToUpper}差`}</strong>
      </article>
      <article class="ranking-card">
        <span>自分より上</span>
        <strong>${playersAbove}人</strong>
      </article>
    `;
    $("myRankStatus").textContent = `今期最高 ${me.seasonBestPower} / 歴代最高 ${me.allTimeBestPower}。他のプレイヤー名は表示されません。`;
    if (currentPlayer && me.playerId === currentPlayer.playerId) {
      saveCurrentPlayer({
        ...currentPlayer,
        power: me.power,
        seasonBestPower: me.seasonBestPower,
        bestPower: me.allTimeBestPower,
        allTimeBestPower: me.allTimeBestPower,
        seasonId: season.seasonId,
        seasonName: season.seasonName
      });
    }
  } else {
    $("rankingList").innerHTML = `<article class="ranking-card wide">${currentPlayer
      ? "あなたの順位はまだありません。1回受験すると表示されます。"
      : "プレイヤー登録後に自分の順位が表示されます。"
    }</article>`;
    $("myRankStatus").textContent = currentPlayer
      ? "あなたの順位はまだありません。1回受験すると表示されます。"
      : "他のプレイヤー名は表示されません。";
  }
}

async function loadRanking() {
  if (!getGasUrl()) {
    $("myRankStatus").textContent = "GAS URLが設定されていません。";
    return;
  }
  try {
    const params = currentPlayer ? { playerId: currentPlayer.playerId } : {};
    const data = await jsonp("ranking", params);
    if (!data.ok) {
      $("myRankStatus").textContent = data.message || "ランキングを読み込めませんでした。";
      return;
    }
    localStorage.setItem(STORAGE.cachedRanking, JSON.stringify(data));
    renderRanking(data);
  } catch {
    $("myRankStatus").textContent = "ランキングを読み込めませんでした。";
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE.cachedRanking) || "null");
      if (cached && cached.season && cached.season.seasonId === CURRENT_SEASON_ID) renderRanking(cached);
      else {
        localStorage.removeItem(STORAGE.cachedRanking);
        $("seasonLabel").textContent = CURRENT_SEASON_NAME;
      }
    } catch {
      // no cached ranking
    }
  }
}

async function renderHistory() {
  $("historyBody").innerHTML = '<tr><td colspan="9">履歴を読み込んでいます。</td></tr>';
  const cloudHistory = await loadCloudHistory();
  const history = cloudHistory || readLocalHistory();
  $("adminHistoryCount").textContent = history.length;
  if (cloudHistory) $("adminSaveStatus").textContent = "共有履歴を表示中";
  if (!history.length) {
    $("historyBody").innerHTML = '<tr><td colspan="9">履歴はまだありません。</td></tr>';
    return;
  }
  $("historyBody").innerHTML = history.map((item) => `
    <tr data-player-id="${escapeHtml(item.playerId || "")}" data-nickname="${escapeHtml(item.nickname || "")}">
      <td>${escapeHtml(item.date)}</td>
      <td>${escapeHtml(item.nickname || item.playerId || "")}</td>
      <td>${escapeHtml(item.className || "")}</td>
      <td>${escapeHtml(item.studentNo || "")}</td>
      <td>${item.correct} / ${item.total}</td>
      <td>${item.accuracy}%</td>
      <td>${item.powerAfter}</td>
      <td>${Number(item.delta) >= 0 ? `+${item.delta}` : item.delta}</td>
      <td>${item.avgTime ? `${(Number(item.avgTime) / 1000).toFixed(1)}秒` : ""}</td>
    </tr>
  `).join("");
}

function getAdminPin() {
  return sessionStorage.getItem(ADMIN_PIN_SESSION_KEY) || "";
}

async function runAdminPlayerAction(action) {
  const playerId = $("adminTargetPlayerId").value.trim();
  const nickname = $("adminNewNickname").value.trim();
  if (!playerId) {
    $("adminToolStatus").textContent = "対象プレイヤーIDを入力してください。";
    return;
  }
  const labels = {
    reset: "戦闘力を1000に戻します",
    rename: "名前を変更します",
    hide: "ランキングから除外します",
    show: "ランキングに戻します"
  };
  if (action === "rename" && !nickname) {
    $("adminToolStatus").textContent = "新しい表示名を入力してください。";
    return;
  }
  if (!confirm(`${labels[action] || "操作します"}。よろしいですか？`)) return;

  $("adminToolStatus").textContent = "処理しています。";
  try {
    const data = await jsonp("adminPlayerAction", {
      adminPin: getAdminPin(),
      playerId,
      action,
      nickname
    });
    $("adminToolStatus").textContent = data.ok ? "完了しました。" : (data.message || "処理できませんでした。");
    await loadRanking();
    renderHistory();
  } catch {
    $("adminToolStatus").textContent = "通信に失敗しました。";
  }
}

function downloadCsv(filename, header, rows) {
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportCloudBackup() {
  $("adminSaveStatus").textContent = "バックアップを作成しています。";
  try {
    const data = await jsonp("backup", { adminPin: getAdminPin() });
    if (!data.ok) {
      $("adminSaveStatus").textContent = data.message || "バックアップに失敗しました。";
      return;
    }
    const rows = [];
    Object.entries(data.sheets || {}).forEach(([sheetName, sheetRows]) => {
      rows.push([`--- ${sheetName} ---`]);
      sheetRows.forEach((row) => rows.push(row));
      rows.push([]);
    });
    downloadCsv(`vocab-battle-backup-${new Date().toISOString().slice(0, 10)}.csv`, ["backup"], rows);
    $("adminSaveStatus").textContent = "バックアップを保存しました。";
  } catch {
    $("adminSaveStatus").textContent = "バックアップに失敗しました。";
  }
}

function refreshAdmin() {
  updateCloudStatus();
  $("adminWordsCount").textContent = words.length;
  $("adminQuizLength").textContent = settings.quizLength;
  $("adminTimeLimit").textContent = `${settings.timeLimitSec}秒`;
  renderHistory();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("registerButton").addEventListener("click", registerPlayer);
$("loadCloudWordsButton").addEventListener("click", async () => {
  await loadCloudSettings();
  await loadCloudWordSets();
  await loadCloudWords();
  loadRanking();
});
$("loadRankingButton").addEventListener("click", loadRanking);
$("sampleButton").addEventListener("click", () => setWords(sampleWords));
document.querySelectorAll('input[name="battleMode"]').forEach((input) => {
  input.addEventListener("change", () => {
    localStorage.setItem(STORAGE.battleMode, input.value);
    updateModeUI();
    $("wordStatus").textContent = activeWords.length >= 4
      ? `${input.value === "casual" ? "お気軽モード" : "ガチモード"}: ${getSelectedRangeLabel()}（${activeWords.length}語）`
      : "選んだ教材には単語が4語以上必要です。";
  });
});
$("unitSelect").addEventListener("change", () => {
  localStorage.setItem(STORAGE.selectedUnit, $("unitSelect").value);
  updateActiveWords();
  $("wordStatus").textContent = activeWords.length >= 4
    ? `${isCasualMode() ? "お気軽モード" : "ガチモード"}: ${getSelectedRangeLabel()}（${activeWords.length}語）`
    : "選んだ範囲には単語が4語以上必要です。";
});
["rangeStart", "rangeEnd"].forEach((id) => {
  $(id).addEventListener("input", () => {
    saveNumberRange();
    updateActiveWords();
    $("wordStatus").textContent = activeWords.length >= 4
      ? `${isCasualMode() ? "お気軽モード" : "ガチモード"}: ${getSelectedRangeLabel()}（${activeWords.length}語）`
      : "選んだ範囲には単語が4語以上必要です。";
  });
});
$("startButton").addEventListener("click", startQuiz);
$("retryWrongButton").addEventListener("click", retryWrongWords);
$("copyAnswersButton").addEventListener("click", copyAnswerReview);
$("restartButton").addEventListener("click", () => {
  $("resultBox").classList.add("hidden");
  $("startBox").classList.remove("hidden");
  currentIndex = 0;
  correctCount = 0;
  updateScorePanel();
});

$("fileInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const parsed = parseRows(XLSX.utils.sheet_to_json(firstSheet, { defval: "" }));
  setWords(parsed);
});

$("applyWordsButton").addEventListener("click", () => {
  const parsed = parsePastedWords($("wordPasteArea").value);
  setWords(parsed);
  $("wordPasteArea").value = "";
});

$("clearWordsButton").addEventListener("click", () => {
  if (!confirm("この端末に保存した単語データを消去しますか？")) return;
  localStorage.removeItem(STORAGE.cachedWords);
  words = [];
  activeWords = [];
  renderUnitOptions();
  updateActiveWords();
  $("wordStatus").textContent = "まだ単語データがありません。";
  $("adminWordStatus").textContent = "端末内単語データはまだ保存されていません。";
  updateStartState();
});

$("saveGasUrlButton").addEventListener("click", async () => {
  setGasUrl($("gasUrlInput").value);
  updateCloudStatus("共有保存URLを保存しました。");
  await loadCloudSettings();
  await loadCloudWords();
});

$("clearGasUrlButton").addEventListener("click", () => {
  localStorage.removeItem(STORAGE.gasUrl);
  updateCloudStatus("共有保存URLを消去しました。");
});

$("refreshAdminButton").addEventListener("click", refreshAdmin);
$("historyBody").addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-player-id]");
  if (!row) return;
  $("adminTargetPlayerId").value = row.dataset.playerId || "";
  $("adminNewNickname").value = row.dataset.nickname || "";
  $("adminToolStatus").textContent = "履歴から対象プレイヤーを選びました。";
});
$("adminResetPowerButton").addEventListener("click", () => runAdminPlayerAction("reset"));
$("adminRenameButton").addEventListener("click", () => runAdminPlayerAction("rename"));
$("adminHideRankingButton").addEventListener("click", () => runAdminPlayerAction("hide"));
$("adminShowRankingButton").addEventListener("click", () => runAdminPlayerAction("show"));
$("cloudBackupButton").addEventListener("click", exportCloudBackup);
$("localBackupButton").addEventListener("click", () => {
  const history = readLocalHistory();
  if (!history.length) {
    alert("この端末に保存する履歴がありません。");
    return;
  }
  const header = ["date", "playerId", "className", "studentNo", "nickname", "correct", "total", "accuracy", "powerBefore", "powerAfter", "delta", "avgTime"];
  const rows = history.map((item) => header.map((key) => item[key] ?? ""));
  downloadCsv("vocab-battle-local-history.csv", header, rows);
});
$("clearButton").addEventListener("click", () => {
  if (!confirm("この端末の履歴を消去しますか？")) return;
  localStorage.removeItem(STORAGE.localHistory);
  renderHistory();
});

$("exportButton").addEventListener("click", () => {
  const history = readLocalHistory();
  if (!history.length) {
    alert("この端末に出力する履歴がありません。");
    return;
  }
  const header = ["date", "playerId", "className", "studentNo", "nickname", "correct", "total", "accuracy", "powerBefore", "powerAfter", "delta", "avgTime"];
  const rows = history.map((item) => header.map((key) => item[key] ?? ""));
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vocab-battle-history.csv";
  link.click();
  URL.revokeObjectURL(url);
});

["className", "studentNo", "nickname"].forEach((id) => {
  $(id).addEventListener("input", () => {
    if (!currentPlayer) return;
    const form = getPlayerForm();
    const playerId = buildPlayerId({ ...form, pin: "" });
    if (playerId !== currentPlayer.playerId) {
      currentPlayer = null;
      localStorage.removeItem(STORAGE.currentPlayer);
      updatePlayerStatus();
      updateStartState();
    }
  });
});

async function boot() {
  applyGasUrlFromQuery();
  migrateClientData();
  migrateOldGasUrl();
  localStorage.removeItem(STORAGE.cachedRanking);
  updateCloudStatus();
  loadCachedSettings();
  restoreNumberRange();
  loadCachedWordSets();
  renderWordSetOptions();
  loadCachedWords();
  updateModeUI();
  restoreCurrentPlayer();
  updatePlayerStatus();
  updateStartState();
  if (getGasUrl()) {
    await loadCloudSettings();
    await loadCloudWordSets();
    await loadCloudWords();
    await loadRanking();
  }
  refreshAdmin();
}

boot();

