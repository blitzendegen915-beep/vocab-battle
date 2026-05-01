const DEFAULT_SETTINGS = { quizLength: 10, timeLimitSec: 8 };
const STORAGE = {
  gasUrl: "gasWebAppUrl",
  currentPlayer: "currentPlayer",
  cachedWords: "cachedWords",
  cachedSettings: "cachedSettings",
  cachedRanking: "cachedRanking",
  localHistory: "vocabBattleHistory"
};
const ADMIN_SESSION_KEY = "vocabBattleAdminUnlocked";
const ADMIN_PIN_SESSION_KEY = "vocabBattleAdminPin";
const ADMIN_PASSWORD_FALLBACK = "cwbtavog";
const ADMIN_PASSWORD_HASH = "75ae5d65da5fbbbcaf62828269c71b049d88755196f6fab97dd3a04a6720fd92";
const DEFAULT_GAS_URL = "";

const sampleWords = [
  { word: "important", meaning: "重要な", difficulty: 6, unit: "Sample", enabled: true },
  { word: "accurate", meaning: "正確な", difficulty: 12, unit: "Sample", enabled: true },
  { word: "reluctant", meaning: "気が進まない", difficulty: 19, unit: "Sample", enabled: true },
  { word: "dog", meaning: "犬", difficulty: 1, unit: "Sample", enabled: true },
  { word: "implicitly", meaning: "暗黙のうちに", difficulty: 30, unit: "Sample", enabled: true },
  { word: "ambiguous", meaning: "曖昧な", difficulty: 24, unit: "Sample", enabled: true }
];

let words = [];
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
  const password = prompt("管理者パスワードを入力してください。");
  if (password === null) return false;
  const isValid = crypto.subtle ? (await sha256(password)) === ADMIN_PASSWORD_HASH : password === ADMIN_PASSWORD_FALLBACK;
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
  localStorage.setItem(STORAGE.gasUrl, gasUrl);
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("gas");
  window.history.replaceState({}, "", cleanUrl.toString());
}

function getGasUrl() {
  return localStorage.getItem(STORAGE.gasUrl) || DEFAULT_GAS_URL;
}

function setGasUrl(url) {
  localStorage.setItem(STORAGE.gasUrl, url.trim());
  updateCloudStatus();
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
}

function restoreCurrentPlayer() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.currentPlayer) || "null");
    if (!saved) return;
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
    $("playerStatus").textContent = message || "ニックネームと暗証番号を入力してください。";
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
    enabled
  };
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
  words = nextWords;
  localStorage.setItem(STORAGE.cachedWords, JSON.stringify(nextWords));
  $("wordStatus").textContent = words.length >= 4
    ? `${words.length}語を読み込みました。${source === "cloud" ? "（共有）" : ""}`
    : "単語が4語以上必要です。";
  $("adminWordStatus").textContent = `${words.length}語の端末内単語データがあります。`;
  $("adminWordsCount").textContent = words.length;
  updateStartState();
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
    const data = await jsonp("words");
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
    timeLimitSec: Number(nextSettings.timeLimitSec || DEFAULT_SETTINGS.timeLimitSec)
  };
  if (!Number.isFinite(settings.quizLength) || settings.quizLength < 1) settings.quizLength = DEFAULT_SETTINGS.quizLength;
  if (!Number.isFinite(settings.timeLimitSec) || settings.timeLimitSec < 1) settings.timeLimitSec = DEFAULT_SETTINGS.timeLimitSec;
  localStorage.setItem(STORAGE.cachedSettings, JSON.stringify(settings));
  $("timeLimitDisplay").textContent = `${settings.timeLimitSec}秒`;
  $("adminQuizLength").textContent = settings.quizLength;
  $("adminTimeLimit").textContent = `${settings.timeLimitSec}秒`;
  updateScorePanel();
}

function loadCachedSettings() {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE.cachedSettings) || "null");
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
  $("startButton").disabled = !(currentPlayer && words.length >= 4);
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
  const count = Math.min(settings.quizLength, words.length);
  return shuffle(words).slice(0, count).map((question) => {
    const distractors = shuffle(words.filter((item) => item.meaning !== question.meaning))
      .slice(0, 3)
      .map((item) => item.meaning);
    return { ...question, choices: shuffle([question.meaning, ...distractors]) };
  });
}

function startQuiz() {
  if (!currentPlayer) {
    updatePlayerStatus("ニックネームと暗証番号を入力してください。");
    return;
  }
  if (words.length < 4) {
    $("wordStatus").textContent = "単語が4語以上必要です。";
    return;
  }
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
  const delta = calculateDelta(avgTime);
  const powerAfter = Math.max(0, powerBeforeBattle + delta);
  const bestPower = Math.max(Number(currentPlayer.bestPower || 1000), powerAfter);
  currentPlayer = { ...currentPlayer, power: powerAfter, bestPower, lastPlayed: new Date().toISOString() };
  saveCurrentPlayer(currentPlayer);

  $("questionBox").classList.add("hidden");
  $("resultBox").classList.remove("hidden");
  $("correctDisplay").textContent = `${correctCount} / ${currentQuiz.length}`;
  $("deltaDisplay").textContent = delta >= 0 ? `+${delta}` : String(delta);
  $("avgTimeDisplay").textContent = `${(avgTime / 1000).toFixed(1)}秒`;
  $("resultSummary").textContent = `正答率 ${Math.round((correctCount / currentQuiz.length) * 100)}%。戦闘力は ${powerBeforeBattle} から ${powerAfter} になりました。`;
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
    powerAfter,
    delta,
    avgTime,
    answerLogs
  };
  saveLocalHistory(record);

  if (getGasUrl()) {
    $("syncStatus").textContent = "結果を保存しています。";
    try {
      await postToCloud({ action: "result", record });
      $("syncStatus").textContent = "結果を保存しました。";
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

  $("seasonLabel").textContent = season.seasonName || season.seasonId || "現在のシーズン";
  $("adminSeasonName").textContent = season.seasonName || season.seasonId || "-";

  if (!top10.length) {
    $("rankingList").innerHTML = "<li>ランキングはまだありません。</li>";
  } else {
    $("rankingList").innerHTML = top10.map((item) => `
      <li>
        <span class="ranking-rank">${item.rank}位</span>
        <span class="ranking-name">${escapeHtml(item.nickname || "no name")}</span>
        <span class="ranking-power">${item.power}</span>
      </li>
    `).join("");
  }

  if (me && me.rank) {
    $("myRankStatus").textContent = `あなた: ${me.rank}位 / 今期戦闘力 ${me.power} / 今期最高 ${me.seasonBestPower} / 歴代最高 ${me.allTimeBestPower}`;
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
    $("myRankStatus").textContent = currentPlayer
      ? "あなたの順位はまだありません。1回受験すると表示されます。"
      : "プレイヤー登録後に自分の順位が表示されます。";
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
      renderRanking(JSON.parse(localStorage.getItem(STORAGE.cachedRanking) || "null"));
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
    <tr>
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
  await loadCloudWords();
  loadRanking();
});
$("loadRankingButton").addEventListener("click", loadRanking);
$("sampleButton").addEventListener("click", () => setWords(sampleWords));
$("startButton").addEventListener("click", startQuiz);
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
  updateCloudStatus();
  loadCachedSettings();
  loadCachedWords();
  restoreCurrentPlayer();
  updatePlayerStatus();
  updateStartState();
  if (getGasUrl()) {
    await loadCloudSettings();
    await loadCloudWords();
    await loadRanking();
  }
  refreshAdmin();
}

boot();
