# CLAUDE.md — vocab-battle

## What this project is

**英単語バトルレート** is a browser-only vocabulary quiz app for Japanese classrooms. Students answer multiple-choice English→Japanese flashcard questions under a countdown timer and earn/lose "戦闘力" (battle power) based on their results. A teacher deploys a Google Apps Script web app as the optional cloud backend; the app works fully offline without it.

No build step. No package manager. Open `index.html` in a browser and it runs.

## Classroom-hub integration

This repo is part of the **classroom-hub** ecosystem — a collection of tools for the same teacher.

- **classroom-hub** is the parent repository that acts as the central hub, linking all classroom tools together.
- When making changes that affect how vocab-battle connects to shared infrastructure (GAS URLs, student data formats, ranking schemas), check if classroom-hub needs to be updated too.
- To deploy a coordinated update across all tools, push to vocab-battle first, then push to classroom-hub.
- The GAS URL used by this app may be shared with other classroom-hub tools; avoid changing the response schema without coordinating with classroom-hub.

## File layout

```
index.html   — Single-page app: two tab views (student / admin)
app.js       — All application logic (~800 lines, plain ES2022)
review.js    — IIFE that adds an answer-review panel via MutationObserver
styles.css   — CSS custom-property design system, mobile-responsive
```

`review.js` is intentionally separate so it can be loaded as an optional add-on. It observes `#resultBox` class changes and re-renders from `localStorage` rather than from live quiz state.

## Core data shapes

**Word entry** (stored in `localStorage.cachedWords`):
```js
{ word: "implicit", meaning: "暗黙の", difficulty: 30, unit: "Unit 5", enabled: true }
```
Minimum 4 enabled words required to start a quiz.

**Player** (stored in `localStorage.currentPlayer`):
```js
{ playerId, nickname, className, studentNo, power, seasonBestPower, allTimeBestPower, bestPower, lastPlayed, seasonId, seasonName }
```
`power` starts at 1000 and changes each quiz.

**History record** (stored in `localStorage.vocabBattleHistory`, max 200 entries):
```js
{ date, playerId, className, studentNo, nickname, correct, total, accuracy,
  powerBefore, powerAfter, delta, avgTime, answerLogs }
```

## Score delta formula

```
delta = (correctCount - wrongCount) × 12
      + (avgResponseMs ≤ timeLimitMs/2 ? 10 : 0)   // speed bonus
      + (timedOutCount × -5)                          // timeout penalty
```

`powerAfter = Math.max(0, powerBefore + delta)`

## localStorage keys

All keys are defined in the `STORAGE` constant at the top of `app.js`:

| Key | Contents |
|-----|----------|
| `gasWebAppUrl` | GAS endpoint URL |
| `currentPlayer` | Current player JSON |
| `cachedWords` | Word array JSON |
| `cachedSettings` | `{ quizLength, timeLimitSec }` |
| `cachedRanking` | Last ranking response JSON |
| `vocabBattleHistory` | Array of result records |

## GAS communication

The app communicates with a Google Apps Script web app (CORS-restricted):

- **GET/JSONP** (`jsonp()` function): `words`, `settings`, `ranking`, `registerPlayer`, `history`
- **POST no-cors** (`postToCloud()`): `result` (saves quiz results)

JSONP uses a unique callback name per request and times out after 12 seconds. The GAS URL can also be injected via `?gas=<url>` query param on page load.

## Admin auth

Admin access requires a password checked against SHA-256 hash `75ae5d65...fd92` (via `crypto.subtle`). On plain HTTP where `crypto.subtle` is unavailable, it falls back to the plaintext constant `ADMIN_PASSWORD_FALLBACK`. Auth state is stored in `sessionStorage` for the duration of the tab session.

## Word import formats

Words can be loaded from three sources, all normalised through `normalizeWord()`:

1. **Excel/CSV** via SheetJS (`xlsx@0.18.5` CDN): first sheet → `parseRows()`
2. **Pasted TSV/CSV** in the admin textarea: `parsePastedWords()`
3. **Cloud** via GAS JSON response: `loadCloudWords()`

Column matching is fuzzy — English names (`word`, `meaning`, `difficulty`, `unit`, `enabled`) and Japanese names (`英単語`, `意味`, `難易度`, `単元`, `有効`) are both accepted.

## Boot sequence

```
boot()
  → applyGasUrlFromQuery()      // absorb ?gas= param
  → updateCloudStatus()
  → loadCachedSettings()        // restore from localStorage
  → loadCachedWords()
  → restoreCurrentPlayer()
  → updatePlayerStatus()
  → updateStartState()
  → if (gasUrl) loadCloudSettings() → loadCloudWords() → loadRanking()
  → refreshAdmin()
```

## Development conventions

- **No build tools** — edit the source files directly, reload the browser.
- **No dependencies** (runtime) except `xlsx.full.min.js` loaded from CDN.
- **Language**: UI text is Japanese; code identifiers and comments are English.
- **DOM access**: always via `const $ = (id) => document.getElementById(id)`. Never query by class in `app.js`.
- **HTML escaping**: all user-derived strings rendered into innerHTML must go through `escapeHtml()`.
- **Error handling**: catch blocks should update the relevant status element with a human-readable Japanese message; do not `console.error` silently.
- **Avoid global state sprawl**: module-level variables in `app.js` are intentional; do not introduce new ones without reason.
- `review.js` must remain self-contained (IIFE) and must not depend on any variable from `app.js`. It reads only from `localStorage`.

## Testing

No automated test suite. Manual testing checklist:
1. Open `index.html` via a local HTTP server (e.g. `npx serve .`) — not `file://` (JSONP and `crypto.subtle` require HTTP).
2. Click "サンプルで試す" to load sample words without a GAS URL.
3. Register a player (nickname + 4-digit pin).
4. Complete a quiz and verify score delta math.
5. Open Admin tab (password prompt appears), verify history table and CSV export.
6. Verify mobile layout at ≤840px viewport.

## Deployment

Drop the three files (`index.html`, `app.js`, `styles.css`, optionally `review.js`) on any static host (GitHub Pages, Netlify, school server). Point students to the URL with `?gas=<GAS_URL>` to pre-configure the backend.

When deploying as part of classroom-hub, the hub's index page should link to this app with the shared GAS URL pre-configured via the `?gas=` parameter.
