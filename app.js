const QUIZ_LENGTH = 10;
const STORAGE_KEY = "vocabBattleHistory";
const POWER_KEY = "vocabBattlePower";
const STUDENT_POWER_KEY = "vocabBattleStudentPowers";
const WORDS_KEY = "vocabBattleWords";
const GAS_URL_KEY = "vocabBattleGasUrl";
const DEFAULT_GAS_URL = "";
const ADMIN_SESSION_KEY = "vocabBattleAdminUnlocked";
const ADMIN_PASSWORD_FALLBACK = "cwbtavog";
const ADMIN_PASSWORD_HASH = "75ae5d65da5fbbbcaf62828269c71b049d88755196f6fab97dd3a04a6720fd92";

const sampleWords = [
  { word: "dog", meaning: "犬", difficulty: 1 },
  { word: "apple", meaning: "りんご", difficulty: 2 },
  { word: "important", meaning: "重要な", difficulty: 6 },
  { word: "increase", meaning: "増加する", difficulty: 8 },
  { word: "accurate", meaning: "正確な", difficulty: 12 },
  { word: "significant", meaning: "重要な、かなりの", difficulty: 16 },
  { word: "elaborate", meaning: "精巧な、詳しく述べる", difficulty: 22 },
  { word: "implicitly", meaning: "暗黙のうちに", difficulty: 30 },
  { word: "ambiguous", meaning: "曖昧な", difficulty: 24 },
  { word: "consequence", meaning: "結果、重要性", difficulty: 18 },
  { word: "substantial", meaning: "かなりの、実質的な", difficulty: 21 },
  { word: "reluctant", meaning: "気が進まない", difficulty: 19 }
];

let words = [];
let currentQuiz = [];
let currentIndex = 0;
let correctCount = 0;
let earnedWeight = 0;
let totalWeight = 0;
let currentPower = 1000;
let locked = false;

const $ = (id) => document.getElementById(id);

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", async () => {
    if (tab.dataset.adminTab && !(await confirmAdminAccess())) return;
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    tab.classList.add("active");
    $(tab.dataset.view).classList.add("active");
    if (tab.dataset.view === "adminView") renderHistory();
  });
});

async function confirmAdminAccess() {
  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "true") return true;
  const password = prompt("管理者パスワードを入力してください。");
  if (password === null) return false;
  const isValid = crypto.subtle ? (await sha256(password)) === ADMIN_PASSWORD_HASH : password === ADMIN_PASSWORD_FALLBACK;
  if (isValid) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
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

function getGasUrl() {
  return localStorage.getItem(GAS_URL_KEY) || DEFAULT_GAS_URL;
}

function applyGasUrlFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const gasUrl = params.get("gas");
  if (!gasUrl) return;
  localStorage.setItem(GAS_URL_KEY, gasUrl);
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("gas");
  window.history.replaceState({}, "", cleanUrl.toString());
}

function setGasUrl(url) {
  localStorage.setItem(GAS_URL_KEY, url.trim());
  updateCloudStatus();
}

function updateCloudStatus(message = "") {
  const url = getGasUrl();
  $("gasUrlInput").value = url;
  const status = url ? "共有保存が有効です。" : "共有保存は未設定です。";
  $("cloudStatus").textContent = message || status;
  $("syncStatus").textContent = url ? "共有保存" : "ローカル保存";
}

function jsonp(action, params = {}) {
  const url = getGasUrl();
  if (!url) return Promise.reject(new Error("GAS URL is not set"));

  return new Promise((resolve, reject) => {
    const callback = `vocabBattleCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const query = new URLSearchParams({ action, callback, ...params });
    const separator = url.includes("?") ? "&" : "?";

    window[callback] = (data) => {
      delete window[callback];
      script.remove();
      resolve(data);
    };

    script.onerror = () => {
      delete window[callback];
      script.remove();
      reject(new Error("共有データを読み込めませんでした。"));
    };

    script.src = `${url}${separator}${query.toString()}`;
    document.body.appendChild(script);
  });
}

async function postToCloud(payload) {
  const url = getGasUrl();
  if (!url) return;
  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
}

function getStudent() {
  return {
    grade: $("grade").value.trim(),
    className: $("className").value.trim(),
    studentNo: $("studentNo").value.trim(),
    lastName: $("lastName").value.trim(),
    firstName: $("firstName").value.trim()
  };
}

function getStudentId() {
  const student = getStudent();
  if (!Object.values(student).every(Boolean)) return "";
  return [student.grade, student.className.toLowerCase(), student.studentNo, student.lastName, student.firstName].join("|");
}

function isStudentReady() {
  return Object.values(getStudent()).every(Boolean);
}

function readStudentPowers() {
  try {
    return JSON.parse(localStorage.getItem(STUDENT_POWER_KEY) || "{}");
  } catch {
    return {};
  }
}

function getLocalPower() {
  const studentId = getStudentId();
  if (!studentId) return Number(localStorage.getItem(POWER_KEY) || 1000);
  const powers = readStudentPowers();
  return Number(powers[studentId] || 1000);
}

function setLocalPower(value) {
  const nextPower = Math.max(100, Math.round(value));
  const studentId = getStudentId();
  if (studentId) {
    const powers = readStudentPowers();
    powers[studentId] = nextPower;
    localStorage.setItem(STUDENT_POWER_KEY, JSON.stringify(powers));
  } else {
    localStorage.setItem(POWER_KEY, String(nextPower));
  }
  currentPower = nextPower;
  updateScorePanel();
}

async function loadStudentPower() {
  currentPower = getLocalPower();
  updateScorePanel();
  if (!getGasUrl() || !isStudentReady()) return;

  try {
    const data = await jsonp("power", { studentId: getStudentId() });
    if (data.ok && Number(data.power)) {
      currentPower = Number(data.power);
      setLocalPower(currentPower);
    }
  } catch {
    $("syncStatus").textContent = "共有読込失敗";
  }
}

function updateScorePanel() {
  $("powerDisplay").textContent = currentPower;
  $("accuracyDisplay").textContent = `${Math.round((correctCount / Math.max(1, currentIndex)) * 100)}%`;
  $("progressDisplay").textContent = `${Math.min(currentIndex, QUIZ_LENGTH)} / ${QUIZ_LENGTH}`;
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

function parseRows(rows) {
  return rows
    .map((row) => {
      const word = pickColumn(row, ["英単語", "単語", "word", "english"], 0);
      const meaning = pickColumn(row, ["意味", "日本語", "meaning", "ja"], 1);
      const difficultyRaw = pickColumn(row, ["難易度", "difficulty", "level"], 2);
      const difficulty = Number(difficultyRaw || 1);
      return {
        word: String(word || "").trim(),
        meaning: String(meaning || "").trim(),
        difficulty: Number.isFinite(difficulty) && difficulty > 0 ? difficulty : 1
      };
    })
    .filter((item) => item.word && item.meaning);
}

function parsePastedWords(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const rows = lines.map((line) => line.split(/\t|,/).map((cell) => cell.trim()));
  const first = rows[0].map((cell) => normalizeHeader(cell));
  const hasHeader = first.some((cell) => ["英単語", "単語", "word", "english"].includes(cell));
  return (hasHeader ? rows.slice(1) : rows)
    .map((cells) => {
      const difficulty = Number(cells[2] || 1);
      return {
        word: String(cells[0] || "").trim(),
        meaning: String(cells[1] || "").trim(),
        difficulty: Number.isFinite(difficulty) && difficulty > 0 ? difficulty : 1
      };
    })
    .filter((item) => item.word && item.meaning);
}

function setWords(nextWords, source = "local") {
  words = nextWords;
  $("wordStatus").textContent = `${words.length}語を読み込みました。${source === "cloud" ? "（共有）" : ""}`;
  $("adminWordStatus").textContent = `${words.length}語の単語データが保存されています。`;
  $("startButton").disabled = words.length < 4;
}

function saveWords(nextWords) {
  localStorage.setItem(WORDS_KEY, JSON.stringify(nextWords));
  setWords(nextWords);
}

function loadSavedWords() {
  try {
    const saved = JSON.parse(localStorage.getItem(WORDS_KEY) || "[]");
    if (Array.isArray(saved) && saved.length) setWords(saved);
  } catch {
    localStorage.removeItem(WORDS_KEY);
  }
}

async function loadCloudWords() {
  if (!getGasUrl()) {
    $("wordStatus").textContent = "共有保存URLが未設定です。";
    return;
  }
  $("wordStatus").textContent = "共有単語を読み込んでいます。";
  try {
    const data = await jsonp("words");
    if (!data.ok || !Array.isArray(data.words) || data.words.length < 4) {
      $("wordStatus").textContent = "共有単語が4語以上ありません。";
      return;
    }
    localStorage.setItem(WORDS_KEY, JSON.stringify(data.words));
    setWords(data.words, "cloud");
  } catch {
    $("wordStatus").textContent = "共有単語を読み込めませんでした。";
  }
}

$("sampleButton").addEventListener("click", () => setWords(sampleWords));
$("loadCloudWordsButton").addEventListener("click", loadCloudWords);

$("fileInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const parsed = parseRows(XLSX.utils.sheet_to_json(firstSheet, { defval: "" }));
  if (parsed.length < 4) {
    $("wordStatus").textContent = "4択を作るには4語以上必要です。";
    $("startButton").disabled = true;
    return;
  }
  saveWords(parsed);
});

$("applyWordsButton").addEventListener("click", () => {
  const parsed = parsePastedWords($("wordPasteArea").value);
  if (parsed.length < 4) {
    $("adminWordStatus").textContent = "4択を作るには4語以上貼り付けてください。";
    return;
  }
  saveWords(parsed);
  $("wordPasteArea").value = "";
});

$("clearWordsButton").addEventListener("click", () => {
  if (!confirm("この端末に保存した単語データを消去しますか？")) return;
  localStorage.removeItem(WORDS_KEY);
  words = [];
  $("wordStatus").textContent = "まだ単語データがありません。";
  $("adminWordStatus").textContent = "単語データはまだ保存されていません。";
  $("startButton").disabled = true;
});

document.querySelectorAll("#studentForm input").forEach((input) => {
  input.addEventListener("input", () => {
    $("startButton").disabled = words.length < 4;
    loadStudentPower();
  });
});

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuiz() {
  const count = Math.min(QUIZ_LENGTH, words.length);
  return shuffle(words).slice(0, count).map((question) => {
    const distractors = shuffle(words.filter((item) => item.meaning !== question.meaning))
      .slice(0, 3)
      .map((item) => item.meaning);
    return { ...question, choices: shuffle([question.meaning, ...distractors]) };
  });
}

$("startButton").addEventListener("click", async () => {
  if (!isStudentReady()) {
    alert("学年・クラス・番号・氏名を入力してください。");
    return;
  }
  await loadStudentPower();
  currentQuiz = buildQuiz();
  currentIndex = 0;
  correctCount = 0;
  earnedWeight = 0;
  totalWeight = currentQuiz.reduce((sum, item) => sum + item.difficulty, 0);
  $("startBox").classList.add("hidden");
  $("resultBox").classList.add("hidden");
  $("questionBox").classList.remove("hidden");
  updateScorePanel();
  showQuestion();
});

function showQuestion() {
  locked = false;
  const question = currentQuiz[currentIndex];
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
    button.addEventListener("click", () => answer(choice, button));
    $("choices").appendChild(button);
  });
}

function answer(choice, selectedButton) {
  if (locked) return;
  locked = true;
  const question = currentQuiz[currentIndex];
  const isCorrect = choice === question.meaning;

  document.querySelectorAll(".choice").forEach((button) => {
    button.disabled = true;
    if (button.textContent === question.meaning) button.classList.add("correct");
  });

  if (isCorrect) {
    correctCount += 1;
    earnedWeight += question.difficulty;
    $("feedback").textContent = "正解！";
  } else {
    selectedButton.classList.add("wrong");
    $("feedback").textContent = `不正解。正解は「${question.meaning}」`;
  }

  currentIndex += 1;
  updateScorePanel();
  window.setTimeout(() => {
    if (currentIndex >= currentQuiz.length) finishQuiz();
    else showQuestion();
  }, 850);
}

function calculateDelta() {
  const accuracy = correctCount / currentQuiz.length;
  const weightedAccuracy = earnedWeight / Math.max(1, totalWeight);
  return Math.round(((accuracy * 0.45 + weightedAccuracy * 0.55) - 0.55) * 180);
}

async function finishQuiz() {
  const before = currentPower;
  const delta = calculateDelta();
  const after = Math.max(100, before + delta);
  currentPower = after;
  setLocalPower(after);

  $("questionBox").classList.add("hidden");
  $("resultBox").classList.remove("hidden");
  $("correctDisplay").textContent = `${correctCount} / ${currentQuiz.length}`;
  $("deltaDisplay").textContent = delta >= 0 ? `+${delta}` : String(delta);
  $("resultSummary").textContent = `正答率 ${Math.round((correctCount / currentQuiz.length) * 100)}%。単語戦闘力は ${before} から ${after} になりました。`;

  const record = {
    date: new Date().toLocaleString("ja-JP"),
    studentId: getStudentId(),
    ...getStudent(),
    correct: correctCount,
    total: currentQuiz.length,
    accuracy: Math.round((correctCount / currentQuiz.length) * 100),
    powerBefore: before,
    powerAfter: after,
    delta
  };
  saveHistory(record);

  if (getGasUrl()) {
    $("syncStatus").textContent = "送信中";
    try {
      await postToCloud({ action: "result", record });
      $("syncStatus").textContent = "送信済み";
    } catch {
      $("syncStatus").textContent = "送信失敗";
    }
  }
}

$("restartButton").addEventListener("click", () => {
  $("resultBox").classList.add("hidden");
  $("startBox").classList.remove("hidden");
  currentIndex = 0;
  correctCount = 0;
  updateScorePanel();
});

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(record) {
  const history = readHistory();
  history.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

async function loadCloudHistory() {
  if (!getGasUrl()) return null;
  try {
    const data = await jsonp("history");
    return data.ok && Array.isArray(data.history) ? data.history : null;
  } catch {
    return null;
  }
}

async function renderHistory() {
  $("historyBody").innerHTML = '<tr><td colspan="9">履歴を読み込んでいます。</td></tr>';
  const cloudHistory = await loadCloudHistory();
  const history = cloudHistory || readHistory();
  if (!history.length) {
    $("historyBody").innerHTML = '<tr><td colspan="9">履歴はまだありません。</td></tr>';
    return;
  }
  $("historyBody").innerHTML = history.map((item) => `
    <tr>
      <td>${escapeHtml(item.date)}</td>
      <td>${escapeHtml(item.grade)}</td>
      <td>${escapeHtml(item.className)}</td>
      <td>${escapeHtml(item.studentNo)}</td>
      <td>${escapeHtml(item.lastName)} ${escapeHtml(item.firstName)}</td>
      <td>${item.correct} / ${item.total}</td>
      <td>${item.accuracy}%</td>
      <td>${item.powerAfter}</td>
      <td>${Number(item.delta) >= 0 ? `+${item.delta}` : item.delta}</td>
    </tr>
  `).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("exportButton").addEventListener("click", () => {
  const history = readHistory();
  if (!history.length) {
    alert("この端末に出力する履歴がありません。共有履歴はスプレッドシートから見られます。");
    return;
  }
  const header = ["日時", "学年", "クラス", "番号", "姓", "名前", "正解数", "問題数", "正答率", "戦闘力", "変動"];
  const rows = history.map((item) => [
    item.date, item.grade, item.className, item.studentNo, item.lastName, item.firstName,
    item.correct, item.total, `${item.accuracy}%`, item.powerAfter, item.delta
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vocab-battle-history.csv";
  link.click();
  URL.revokeObjectURL(url);
});

$("clearButton").addEventListener("click", () => {
  if (!confirm("この端末の履歴を消去しますか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
});

$("saveGasUrlButton").addEventListener("click", () => {
  setGasUrl($("gasUrlInput").value);
  updateCloudStatus("共有保存URLを保存しました。");
  loadCloudWords();
});

$("clearGasUrlButton").addEventListener("click", () => {
  localStorage.removeItem(GAS_URL_KEY);
  updateCloudStatus("共有保存URLを消去しました。");
});

$("refreshHistoryButton").addEventListener("click", renderHistory);

applyGasUrlFromQuery();
updateCloudStatus();
loadSavedWords();
loadStudentPower();
renderHistory();
if (getGasUrl()) loadCloudWords();
