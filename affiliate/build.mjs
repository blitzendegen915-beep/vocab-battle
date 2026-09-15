#!/usr/bin/env node
// affiliate/build.mjs
// Zero-dependency static site generator for the affiliate blog.
// Usage: node affiliate/build.mjs
// Reads affiliate/content/*.md, renders them alongside the existing root
// app, and writes everything into dist/.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const AFFILIATE_DIR = __dirname;
const CONTENT_DIR = path.join(AFFILIATE_DIR, "content");
const DIST_DIR = path.join(ROOT, "dist");

// ---------------------------------------------------------------------------
// Config / links
// ---------------------------------------------------------------------------

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[build] Could not read ${filePath}: ${err.message}`);
    return fallback;
  }
}

const CONFIG = readJson(path.join(AFFILIATE_DIR, "site.config.json"), {
  siteName: "AIツールナビ",
  baseUrl: "https://blitzendegen915-beep.github.io/vocab-battle",
  blogPath: "/blog",
  author: "AIツールナビ編集部",
  description: "AIツールの比較・レビュー・活用術を毎日更新",
});

const LINKS = readJson(path.join(AFFILIATE_DIR, "links.json"), {});

const SITE_ROOT_URL = `${CONFIG.baseUrl}/`;
const BLOG_INDEX_URL = `${CONFIG.baseUrl}${CONFIG.blogPath}/`;

function articleUrl(slug) {
  return `${CONFIG.baseUrl}${CONFIG.blogPath}/${slug}/`;
}

const DISCLOSURE_TEXT =
  "※本記事にはプロモーション(アフィリエイト広告)が含まれています。";

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

// ---------------------------------------------------------------------------
// Frontmatter parsing (YAML-lite, hand-rolled)
// ---------------------------------------------------------------------------

function stripQuotes(val) {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseTags(raw) {
  if (raw === undefined || raw === null || raw === "") return [];
  const trimmed = String(raw).trim();
  if (trimmed.startsWith("[")) {
    try {
      const jsonish = trimmed.replace(/'/g, '"');
      const parsed = JSON.parse(jsonish);
      if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean);
    } catch (err) {
      // fall through to comma-list handling below
    }
    return trimmed
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")
      .map((s) => stripQuotes(s.trim()))
      .filter(Boolean);
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: raw };
  }
  const [, yamlBlock, body] = match;
  const data = {};
  for (const line of yamlBlock.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    data[key] = val;
  }
  data.tags = parseTags(data.tags);
  return { data, body };
}

// ---------------------------------------------------------------------------
// Affiliate CTA rendering
// ---------------------------------------------------------------------------

function renderCta(id, standalone) {
  const link = LINKS[id];
  if (!link) {
    console.warn(`[build] Unknown affiliate id in {{aff:${id}}} — skipping.`);
    return "";
  }
  const href = link.url && link.url.trim() ? link.url : link.official;
  if (!href) {
    console.warn(`[build] Affiliate id "${id}" has no url or official fallback — skipping.`);
    return "";
  }
  const label = escapeHtml(link.label || id);
  const btn = `<a class="aff-btn" href="${escapeHtml(href)}" rel="sponsored nofollow noopener" target="_blank">${label}</a>`;
  return standalone ? `<div class="aff-cta">${btn}</div>` : btn;
}

const AFF_RE = /\{\{aff:([\w-]+)\}\}/g;
const AFF_STANDALONE_RE = /^\{\{aff:([\w-]+)\}\}$/;

// ---------------------------------------------------------------------------
// Minimal markdown renderer
// ---------------------------------------------------------------------------

function renderInline(escapedText) {
  let out = escapedText;
  // inline code
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  // bold
  out = out.replace(/\*\*([^*]+)\*\*/g, (_m, txt) => `<strong>${txt}</strong>`);
  // links
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
    const external = /^https?:\/\//i.test(url);
    const rel = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${url}"${rel}>${text}</a>`;
  });
  // affiliate placeholders embedded mid-paragraph
  out = out.replace(AFF_RE, (_m, id) => renderCta(id, false));
  return out;
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const htmlParts = [];
  let i = 0;

  function flushParagraph(buf) {
    if (!buf.length) return;
    const joined = buf.join("<br>");
    htmlParts.push(`<p>${renderInline(joined)}</p>`);
  }

  let paragraphBuf = [];

  function flush() {
    flushParagraph(paragraphBuf);
    paragraphBuf = [];
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // fenced code block
    if (trimmed.startsWith("```")) {
      flush();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      htmlParts.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    // standalone affiliate placeholder
    if (AFF_STANDALONE_RE.test(trimmed)) {
      flush();
      const id = trimmed.match(AFF_STANDALONE_RE)[1];
      htmlParts.push(renderCta(id, true));
      i++;
      continue;
    }

    // horizontal rule
    if (/^-{3,}$/.test(trimmed)) {
      flush();
      htmlParts.push("<hr>");
      i++;
      continue;
    }

    // headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flush();
      const level = headingMatch[1].length;
      htmlParts.push(`<h${level}>${renderInline(escapeHtml(headingMatch[2]))}</h${level}>`);
      i++;
      continue;
    }

    // blockquote
    if (trimmed.startsWith("> ")) {
      flush();
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const inner = quoteLines.map((l) => renderInline(escapeHtml(l))).join("<br>");
      htmlParts.push(`<blockquote><p>${inner}</p></blockquote>`);
      continue;
    }

    // unordered list
    if (/^-\s+/.test(trimmed)) {
      flush();
      const items = [];
      while (i < lines.length && /^-\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^-\s+/, ""));
        i++;
      }
      const li = items.map((it) => `<li>${renderInline(escapeHtml(it))}</li>`).join("");
      htmlParts.push(`<ul>${li}</ul>`);
      continue;
    }

    // ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      flush();
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      const li = items.map((it) => `<li>${renderInline(escapeHtml(it))}</li>`).join("");
      htmlParts.push(`<ol>${li}</ol>`);
      continue;
    }

    // blank line -> paragraph separator
    if (trimmed === "") {
      flush();
      i++;
      continue;
    }

    // plain paragraph line
    paragraphBuf.push(escapeHtml(line));
    i++;
  }

  flush();
  return htmlParts.join("\n");
}

// ---------------------------------------------------------------------------
// Content loading
// ---------------------------------------------------------------------------

function loadArticles() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.warn(`[build] Content directory not found (${CONTENT_DIR}); building with 0 articles.`);
    return [];
  }
  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .sort();

  if (files.length === 0) {
    console.warn(`[build] No markdown files found in ${CONTENT_DIR}; building with 0 articles.`);
  }

  const articles = [];
  const seenSlugs = new Set();

  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);
    let raw;
    try {
      raw = fs.readFileSync(fullPath, "utf8");
    } catch (err) {
      console.warn(`[build] Skipping ${file}: could not read file (${err.message})`);
      continue;
    }
    const { data, body } = parseFrontmatter(raw);

    if (!data.title || !data.slug) {
      console.warn(`[build] Skipping ${file}: missing required frontmatter (title/slug).`);
      continue;
    }
    if (seenSlugs.has(data.slug)) {
      console.warn(`[build] Skipping ${file}: duplicate slug "${data.slug}" (already used).`);
      continue;
    }
    seenSlugs.add(data.slug);

    articles.push({
      title: data.title,
      description: data.description || "",
      slug: data.slug,
      date: data.date || "1970-01-01",
      category: data.category || "AIツール",
      tags: data.tags || [],
      bodyHtml: renderMarkdown(body),
      sourceFile: file,
    });
  }

  articles.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return articles;
}

// ---------------------------------------------------------------------------
// HTML page shell (shared CSS, OGP, JSON-LD)
// ---------------------------------------------------------------------------

const SITE_CSS = `
:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --fg: #1a1a1a;
  --muted: #5f6368;
  --accent: #2563eb;
  --accent-fg: #ffffff;
  --border: #e5e7eb;
  --card-bg: #f8fafc;
  --code-bg: #f1f5f9;
  --banner-bg: #fff8e1;
  --banner-fg: #7a5b00;
  --banner-border: #f1d998;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14161a;
    --fg: #eaeaea;
    --muted: #a3a9b2;
    --accent: #60a5fa;
    --accent-fg: #0b1220;
    --border: #2a2e35;
    --card-bg: #1c1f26;
    --code-bg: #20242c;
    --banner-bg: #2a2306;
    --banner-fg: #f0d778;
    --banner-border: #4a3d0f;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--fg);
  font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", "Segoe UI", system-ui, -apple-system, sans-serif;
  line-height: 1.85;
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); }
img { max-width: 100%; height: auto; }
.site-header {
  border-bottom: 1px solid var(--border);
  padding: 1rem 1.25rem;
}
.site-header .inner {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.site-header a.brand {
  font-weight: 700;
  font-size: 1.1rem;
  text-decoration: none;
  color: var(--fg);
}
.site-header nav a {
  text-decoration: none;
  color: var(--muted);
  margin-left: 1rem;
  font-size: 0.9rem;
}
.disclosure-banner {
  max-width: 760px;
  margin: 1rem auto 0;
  padding: 0.75rem 1rem;
  background: var(--banner-bg);
  color: var(--banner-fg);
  border: 1px solid var(--banner-border);
  border-radius: 8px;
  font-size: 0.85rem;
  line-height: 1.6;
}
main {
  max-width: 720px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
}
main.wide { max-width: 760px; }
h1 { font-size: 1.7rem; line-height: 1.4; margin: 0.5rem 0 1rem; }
h2 { font-size: 1.35rem; margin-top: 2.2rem; border-left: 5px solid var(--accent); padding-left: 0.6rem; }
h3 { font-size: 1.1rem; margin-top: 1.6rem; }
p { margin: 0 0 1.1rem; }
ul, ol { margin: 0 0 1.1rem; padding-left: 1.4rem; }
li { margin-bottom: 0.4rem; }
blockquote {
  margin: 1.2rem 0;
  padding: 0.6rem 1rem;
  border-left: 4px solid var(--border);
  color: var(--muted);
  background: var(--card-bg);
  border-radius: 4px;
}
code {
  background: var(--code-bg);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
}
pre {
  background: var(--code-bg);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
}
pre code { background: none; padding: 0; }
hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
.article-meta {
  color: var(--muted);
  font-size: 0.85rem;
  margin-bottom: 1.5rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.article-meta .tag {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.1rem 0.7rem;
}
.aff-cta {
  margin: 1.8rem 0;
  text-align: center;
}
.aff-btn {
  display: inline-block;
  background: var(--accent);
  color: var(--accent-fg) !important;
  font-weight: 700;
  text-decoration: none;
  padding: 0.9rem 2rem;
  border-radius: 999px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.15);
  transition: transform 0.1s ease;
}
.aff-btn:hover { transform: translateY(-1px); }
.article-list { list-style: none; padding: 0; margin: 0; }
.article-list li {
  border-bottom: 1px solid var(--border);
  padding: 1.25rem 0;
}
.article-list h2 { border: none; padding: 0; margin: 0 0 0.4rem; font-size: 1.2rem; }
.article-list a { text-decoration: none; color: var(--fg); }
.article-list a:hover { color: var(--accent); }
.article-list .desc { color: var(--muted); font-size: 0.92rem; margin: 0.3rem 0 0; }
.article-list .meta { color: var(--muted); font-size: 0.8rem; }
.empty-state {
  color: var(--muted);
  padding: 2rem 0;
}
.site-footer {
  border-top: 1px solid var(--border);
  margin-top: 3rem;
  padding: 1.5rem 1.25rem;
  color: var(--muted);
  font-size: 0.8rem;
}
.site-footer .inner { max-width: 760px; margin: 0 auto; }
.site-footer p { margin: 0.3rem 0; }
`;

function pageShell({ title, description, canonical, ogType = "article", bodyHtml, jsonLd }) {
  const fullTitle = `${title} | ${CONFIG.siteName}`;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="${ogType}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="${escapeHtml(CONFIG.siteName)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>${SITE_CSS}</style>
</head>
<body>
<header class="site-header">
  <div class="inner">
    <a class="brand" href="${BLOG_INDEX_URL}">${escapeHtml(CONFIG.siteName)}</a>
    <nav>
      <a href="${BLOG_INDEX_URL}">記事一覧</a>
      <a href="${SITE_ROOT_URL}">アプリを使う</a>
    </nav>
  </div>
</header>
<div class="disclosure-banner">${DISCLOSURE_TEXT}</div>
${bodyHtml}
<footer class="site-footer">
  <div class="inner">
    <p>${DISCLOSURE_TEXT}</p>
    <p>本サイトの情報は正確性に努めていますが、内容を保証するものではありません。掲載の商品・サービスの詳細は必ず公式サイトでご確認ください。</p>
    <p>&copy; ${new Date().getFullYear()} ${escapeHtml(CONFIG.siteName)}</p>
  </div>
</footer>
</body>
</html>
`;
}

function formatDateJa(dateStr) {
  return dateStr;
}

function renderArticlePage(article) {
  const url = articleUrl(article.slug);
  const tagsHtml = article.tags.length
    ? article.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")
    : "";
  const body = `
<main>
  <article>
    <h1>${escapeHtml(article.title)}</h1>
    <div class="article-meta">
      <time datetime="${escapeHtml(article.date)}">${escapeHtml(formatDateJa(article.date))}</time>
      <span class="tag">${escapeHtml(article.category)}</span>
      ${tagsHtml}
    </div>
    ${article.bodyHtml}
  </article>
</main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    author: { "@type": "Organization", name: CONFIG.author },
    publisher: { "@type": "Organization", name: CONFIG.siteName },
    mainEntityOfPage: url,
  };

  return pageShell({
    title: article.title,
    description: article.description,
    canonical: url,
    ogType: "article",
    bodyHtml: body,
    jsonLd,
  });
}

function renderBlogIndex(articles) {
  const items = articles.length
    ? articles
        .map(
          (a) => `<li>
        <h2><a href="${articleUrl(a.slug)}">${escapeHtml(a.title)}</a></h2>
        <p class="desc">${escapeHtml(a.description)}</p>
        <p class="meta"><time datetime="${escapeHtml(a.date)}">${escapeHtml(a.date)}</time> ・ ${escapeHtml(a.category)}</p>
      </li>`
        )
        .join("\n")
    : `<li class="empty-state">まだ記事がありません。近日公開予定です。</li>`;

  const body = `
<main class="wide">
  <h1>記事一覧</h1>
  <ul class="article-list">
    ${items}
  </ul>
</main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: CONFIG.siteName,
    url: BLOG_INDEX_URL,
    description: CONFIG.description,
  };

  return pageShell({
    title: "記事一覧",
    description: CONFIG.description,
    canonical: BLOG_INDEX_URL,
    ogType: "website",
    bodyHtml: body,
    jsonLd,
  });
}

// ---------------------------------------------------------------------------
// RSS / sitemap / robots
// ---------------------------------------------------------------------------

function toRfc822(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderFeed(articles) {
  const items = articles
    .map(
      (a) => `  <item>
    <title>${xmlEscape(a.title)}</title>
    <link>${xmlEscape(articleUrl(a.slug))}</link>
    <guid isPermaLink="true">${xmlEscape(articleUrl(a.slug))}</guid>
    <pubDate>${toRfc822(a.date)}</pubDate>
    <description>${xmlEscape(a.description)}</description>
    <category>${xmlEscape(a.category)}</category>
  </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${xmlEscape(CONFIG.siteName)}</title>
  <link>${xmlEscape(BLOG_INDEX_URL)}</link>
  <description>${xmlEscape(CONFIG.description)}</description>
  <language>ja</language>
${items}
</channel>
</rss>
`;
}

function renderSitemap(articles) {
  const urls = [
    { loc: SITE_ROOT_URL },
    { loc: BLOG_INDEX_URL },
    ...articles.map((a) => ({ loc: articleUrl(a.slug), lastmod: a.date })),
  ];
  const entries = urls
    .map((u) => {
      const lastmod = u.lastmod ? `\n    <lastmod>${xmlEscape(u.lastmod)}</lastmod>` : "";
      return `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>${lastmod}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

function renderRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${CONFIG.baseUrl}/sitemap.xml
`;
}

// ---------------------------------------------------------------------------
// App file copy
// ---------------------------------------------------------------------------

function copyRootApp() {
  const files = ["index.html", "app.js", "review.js", "styles.css"];
  for (const f of files) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST_DIR, f));
    } else {
      console.warn(`[build] Root app file not found, skipping copy: ${f}`);
    }
  }
  const assetsSrc = path.join(ROOT, "assets");
  if (fs.existsSync(assetsSrc)) {
    fs.cpSync(assetsSrc, path.join(DIST_DIR, "assets"), { recursive: true });
  } else {
    console.warn(`[build] assets/ directory not found, skipping copy.`);
  }
}

// ---------------------------------------------------------------------------
// Main build
// ---------------------------------------------------------------------------

function build() {
  rmrf(DIST_DIR);
  ensureDir(DIST_DIR);

  copyRootApp();

  const articles = loadArticles();

  for (const article of articles) {
    const outPath = path.join(DIST_DIR, "blog", article.slug, "index.html");
    writeFile(outPath, renderArticlePage(article));
  }

  writeFile(path.join(DIST_DIR, "blog", "index.html"), renderBlogIndex(articles));
  writeFile(path.join(DIST_DIR, "blog", "feed.xml"), renderFeed(articles));
  writeFile(path.join(DIST_DIR, "sitemap.xml"), renderSitemap(articles));
  writeFile(path.join(DIST_DIR, "robots.txt"), renderRobots());

  console.log(`[build] Done. ${articles.length} article(s) built. Output: ${DIST_DIR}`);
}

build();
