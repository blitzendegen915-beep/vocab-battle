(() => {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function injectStyles() {
    if (document.getElementById("answerReviewStyles")) return;
    const style = document.createElement("style");
    style.id = "answerReviewStyles";
    style.textContent = `
      .answer-review { width: 100%; }
      .answer-review h3 { font-size: 20px; margin: 8px 0 12px; }
      .answer-review-list { display: grid; gap: 10px; max-height: 520px; overflow-y: auto; padding-right: 4px; }
      .answer-review-item { border: 1px solid var(--line); border-left: 6px solid #aab7b4; border-radius: 8px; padding: 12px; }
      .answer-review-item.correct { border-left-color: #55ad77; }
      .answer-review-item.wrong { border-left-color: var(--accent); }
      .answer-review-head { align-items: center; display: flex; flex-wrap: wrap; gap: 8px 12px; margin-bottom: 10px; }
      .answer-review-head span { color: var(--muted); font-size: 13px; font-weight: 800; }
      .answer-review-head strong { font-size: 22px; }
      .answer-review-head em { background: #edf0f1; border-radius: 999px; color: var(--ink); font-style: normal; font-weight: 800; padding: 5px 10px; }
      .answer-review-item.correct .answer-review-head em { background: #dff3e8; color: #166238; }
      .answer-review-item.wrong .answer-review-head em { background: #ffe6df; color: #902d21; }
      .answer-review dl { display: grid; gap: 8px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
      .answer-review dl div { background: #f7f9f8; border-radius: 8px; padding: 10px; }
      .answer-review dt { color: var(--muted); font-size: 12px; font-weight: 800; }
      .answer-review dd { margin: 4px 0 0; }
      @media (max-width: 840px) { .answer-review dl { grid-template-columns: 1fr; width: 100%; } }
    `;
    document.head.appendChild(style);
  }

  function readLatestRecord() {
    try {
      const history = JSON.parse(localStorage.getItem("vocabBattleHistory") || "[]");
      return Array.isArray(history) ? history[0] : null;
    } catch {
      return null;
    }
  }

  function ensureReviewBox() {
    const resultBox = document.getElementById("resultBox");
    if (!resultBox) return null;

    let review = document.getElementById("answerReviewList");
    if (review) return review;

    const section = document.createElement("section");
    section.className = "answer-review";
    section.innerHTML = '<h3>答え合わせ</h3><div id="answerReviewList" class="answer-review-list"></div>';

    const restartButton = document.getElementById("restartButton");
    resultBox.insertBefore(section, restartButton || null);

    return document.getElementById("answerReviewList");
  }

  function renderAnswerReview() {
    injectStyles();

    const list = ensureReviewBox();
    if (!list) return;

    const record = readLatestRecord();
    const logs = record && Array.isArray(record.answerLogs) ? record.answerLogs : [];

    if (!logs.length) {
      list.innerHTML = '<article class="answer-review-item"><div class="answer-review-head"><strong>答え合わせデータがありません</strong></div></article>';
      return;
    }

    list.innerHTML = logs.map((log, index) => {
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

  function watchResultBox() {
    const resultBox = document.getElementById("resultBox");
    if (!resultBox) return;

    const observer = new MutationObserver(() => {
      if (!resultBox.classList.contains("hidden")) {
        renderAnswerReview();
      }
    });

    observer.observe(resultBox, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchResultBox);
  } else {
    watchResultBox();
  }
})();
