#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = String(process.env.OZARK_SITE_URL || 'https://ozarks.cgnnews.net').replace(/\/+$/, '');
const API_URL = String(process.env.OZARK_API_URL || '').replace(/\?+$/, '').replace(/\/+$/, '');
const PUBLICATION_NAME = String(process.env.OZARK_PUBLICATION_NAME || 'The Ozark Gazette');
const INCLUDE_ARCHIVES = String(process.env.OZARK_INCLUDE_ARCHIVES || 'true').toLowerCase() !== 'false';
const MAX_ARTICLES = Math.max(1, Number(process.env.OZARK_MAX_ARTICLES || 2000));
const NEWS_SITEMAP_HOURS = Math.max(1, Number(process.env.OZARK_NEWS_SITEMAP_HOURS || 48));
const DEFAULT_IMAGE = `${SITE_URL}/OzarkGazetteBanner.png`;
const GENERATED_YEAR_RE = /^20\d{2}$/;
const ROUTE_FAMILIES = ['news', 'weather', 'sports', 'traffic', 'obituaries'];

if (!API_URL) throw new Error('Missing OZARK_API_URL. Set the OZARK_API_URL secret or pass api_url in workflow_dispatch.');

function escapeHtml(value = '') {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeXml(value = '') {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slugify(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'article';
}

function normalizeCategory(category = '') {
  const raw = String(category || '').trim();
  const key = raw.toLowerCase().replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const map = new Map([
    ['local', 'Local'],
    ['news', 'Local'],
    ['community', 'Local'],
    ['courts', 'Courts'],
    ['court', 'Courts'],
    ['records', 'Courts'],
    ['public records', 'Courts'],
    ['crime', 'Courts'],
    ['us', 'US'],
    ['u.s.', 'US'],
    ['u.s', 'US'],
    ['united states', 'US'],
    ['world', 'World'],
    ['politics', 'Politics'],
    ['investigation', 'Investigations'],
    ['investigations', 'Investigations'],
    ['markets', 'Markets'],
    ['market', 'Markets'],
    ['business', 'Markets'],
    ['economy', 'Markets'],
    ['technology', 'Technology'],
    ['tech', 'Technology'],
    ['opinion', 'Opinion'],
    ['environment', 'Environment'],
    ['entertainment', 'Entertainment'],
    ['obituary', 'Obituaries'],
    ['obituaries', 'Obituaries'],
    ['weather', 'Weather'],
    ['traffic', 'Traffic'],
    ['road', 'Traffic'],
    ['roads', 'Traffic'],
    ['sports', 'Sports'],
    ['sport', 'Sports']
  ]);
  return map.get(key) || raw || 'Local';
}

function routeFamilyForCategory(category = '') {
  const clean = normalizeCategory(category);
  if (clean === 'Weather') return 'weather';
  if (clean === 'Sports') return 'sports';
  if (clean === 'Traffic') return 'traffic';
  if (clean === 'Obituaries') return 'obituaries';
  return 'news';
}

function categoryHref(category = '') {
  const clean = normalizeCategory(category);
  if (clean === 'Weather') return '/weather/';
  if (clean === 'Sports') return '/sports/';
  if (clean === 'Traffic') return '/traffic/';
  if (clean === 'Obituaries') return '/obituaries/';
  if (clean === 'Markets') return '/markets/';
  if (clean === 'Courts') return '/local/';
  if (clean === 'US') return '/us/';
  if (clean === 'Local') return '/local/';
  return `/${slugify(clean)}/`;
}

function safeDate(value, fallback = new Date()) {
  const d = new Date(value || fallback);
  return Number.isFinite(d.getTime()) ? d : fallback;
}

function articlePublishedDate(article) {
  return safeDate(article.published_at || article.publishedAt || article.date_published || article.updated_at || article.updatedAt || new Date());
}

function articleUpdatedDate(article) {
  return safeDate(article.updated_at || article.updatedAt || article.modified_at || article.published_at || article.publishedAt || new Date());
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function articleSlug(article) {
  return slugify(article.slug || article.url_slug || article.title || article.article_id || article.id || 'article');
}

function articlePath(article) {
  const d = articlePublishedDate(article);
  const family = routeFamilyForCategory(article.category);
  return `${family}/${d.getUTCFullYear()}/${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}/${articleSlug(article)}/index.html`;
}

function publicUrlFromPath(filePath) {
  return `${SITE_URL}/${filePath.replace(/index\.html$/i, '').replace(/^\/+/, '')}`;
}

function absoluteAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_IMAGE;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${SITE_URL}/${raw.replace(/^\/+/, '')}`;
}

function visibleDate(value) {
  const d = safeDate(value, null);
  if (!d) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  }).formatToParts(d);
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return `${map.weekday}, ${map.day} ${map.month} ${map.year} at ${map.hour}:${map.minute}:${map.second} ${String(map.dayPeriod || '').toUpperCase()} ${map.timeZoneName}`.trim();
}

function isoDate(value) {
  return safeDate(value).toISOString();
}

function normalizeArticle(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const article = { ...raw };
  article.article_id = article.article_id || article.id || article.uuid || article.key || '';
  article.title = article.title || article.headline || article.name || '';
  article.subtitle = article.subtitle || article.deck || article.description || '';
  article.summary = article.summary || article.excerpt || article.subtitle || article.seo_description || '';
  article.slug = article.slug || article.url_slug || slugify(article.title || article.article_id || 'article');
  article.category = normalizeCategory(article.category || article.section || article.type || 'Local');
  article.author = article.author || article.byline || article.reporter || PUBLICATION_NAME;
  article.published_at = article.published_at || article.publishedAt || article.date_published || article.date || article.created_at || new Date().toISOString();
  article.updated_at = article.updated_at || article.updatedAt || article.modified_at || article.published_at;
  article.status = article.status || 'published';
  article.body_html = article.body_html || article.body || article.content_html || article.html || '';
  article.what_this_means = article.what_this_means || article.whatThisMeans || article.analysis || '';
  article.hero_image_url = article.hero_image_url || article.heroImageUrl || article.image_url || article.image || article.thumbnail || '';
  article.image_credit = article.image_credit || article.imageCredit || '';
  article.seo_title = article.seo_title || article.seoTitle || article.title;
  article.seo_description = article.seo_description || article.seoDescription || article.summary || article.subtitle || '';
  if (!article.title) return null;
  return article;
}

function extractArticles(json) {
  const candidates = [
    json,
    json?.articles,
    json?.items,
    json?.data,
    json?.data?.articles,
    json?.data?.items,
    json?.data?.rows,
    json?.rows,
    json?.results,
    json?.archive,
    json?.archives
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.map(normalizeArticle).filter(Boolean);
  }
  return [];
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} failed: HTTP ${res.status} ${text.slice(0, 400)}`);
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 400)}`);
  }
}

async function fetchAction(action) {
  const out = [];
  let offset = 0;
  const limit = Math.min(250, MAX_ARTICLES);
  const seenPageKeys = new Set();

  while (out.length < MAX_ARTICLES) {
    const url = new URL(API_URL);
    url.searchParams.set('site', 'ozark');
    url.searchParams.set('action', action);
    url.searchParams.set('limit', String(Math.min(limit, MAX_ARTICLES - out.length)));
    url.searchParams.set('offset', String(offset));

    const json = await fetchJson(url);
    const list = extractArticles(json);
    out.push(...list);

    const next = json?.next_offset ?? json?.nextOffset ?? json?.offset_next ?? json?.pagination?.next_offset;
    const nextOffset = Number(next);
    const pageKey = `${offset}:${list.length}:${next ?? ''}`;
    if (seenPageKeys.has(pageKey)) break;
    seenPageKeys.add(pageKey);
    if (!list.length || !Number.isFinite(nextOffset) || nextOffset === offset) break;
    offset = nextOffset;
  }

  return out;
}

async function fetchAllArticles() {
  const actionGroups = [
    String(process.env.OZARK_PRIMARY_ACTION || '').trim(),
    'ozark_articles',
    'articles_paged',
    'articles'
  ].filter(Boolean);

  const archiveActions = [
    String(process.env.OZARK_ARCHIVE_ACTION || '').trim(),
    'ozark_archives',
    'archives_paged'
  ].filter(Boolean);

  const all = [];
  const errors = [];
  let anyPrimaryWorked = false;

  for (const action of [...new Set(actionGroups)]) {
    try {
      const rows = await fetchAction(action);
      if (rows.length) {
        anyPrimaryWorked = true;
        all.push(...rows);
        console.log(`Fetched ${rows.length} rows using action=${action}`);
        break;
      }
      console.log(`Action ${action} returned 0 rows; trying next action if available.`);
    } catch (err) {
      errors.push(`${action}: ${err.message}`);
      console.warn(`Action ${action} failed: ${err.message}`);
    }
  }

  if (INCLUDE_ARCHIVES) {
    for (const action of [...new Set(archiveActions)]) {
      try {
        const rows = await fetchAction(action);
        if (rows.length) {
          all.push(...rows);
          console.log(`Fetched ${rows.length} archive rows using action=${action}`);
          break;
        }
      } catch (err) {
        console.warn(`Archive action ${action} failed: ${err.message}`);
      }
    }
  }

  if (!anyPrimaryWorked && all.length === 0) {
    throw new Error(`No Ozark article API action returned articles. Tried: ${[...new Set(actionGroups)].join(', ')}. Errors: ${errors.join(' | ')}`);
  }

  return all;
}

function isPublishable(article) {
  const status = String(article.status || 'published').trim().toLowerCase();
  return ['', 'published', 'publish', 'active', 'archive', 'archived'].includes(status);
}

function uniqueArticles(articles) {
  const seen = new Set();
  const out = [];
  for (const article of articles) {
    if (!isPublishable(article)) continue;
    const key = String(article.article_id || '').trim() || `${articleSlug(article)}:${isoDate(article.published_at).slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(article);
  }
  return out
    .sort((a, b) => articlePublishedDate(b).getTime() - articlePublishedDate(a).getTime())
    .slice(0, MAX_ARTICLES);
}

let articleTemplateCache = null;

function articleTemplate() {
  if (articleTemplateCache !== null) return articleTemplateCache;
  const templatePath = path.join(process.cwd(), 'article.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error('Missing article.html. Static article pages must be generated from article.html because it is the Ozark source of truth.');
  }
  articleTemplateCache = fs.readFileSync(templatePath, 'utf8');
  return articleTemplateCache;
}

function replaceRequired(html, search, replacement, label) {
  if (!html.includes(search)) {
    throw new Error(`article.html template changed; could not replace ${label}.`);
  }
  return html.replace(search, replacement);
}

function makeMetaRows(article, category, categoryPath) {
  return `<div class="meta-row"><div class="meta-label">Category:</div><div class="meta-value"><a href="${escapeHtml(categoryPath)}">${escapeHtml(category)}</a></div></div><div class="meta-row"><div class="meta-label">By:</div><div class="meta-value"><a href="/reporters/">${escapeHtml(article.author || PUBLICATION_NAME)}</a></div></div><div class="meta-row"><div class="meta-label">Published:</div><div class="meta-value">${escapeHtml(visibleDate(article.published_at))}</div></div><div class="meta-row"><div class="meta-label">Updated:</div><div class="meta-value">${escapeHtml(visibleDate(article.updated_at || article.published_at))}</div></div>`;
}

function reporterEmailFromName(name) {
  return String(name || '').trim().toLowerCase() === 'michael a. cook' ? 'editor@cgnnews.net' : 'tips@cgnnews.net';
}

function emailReporterHref(article, canonical) {
  const author = article.author || PUBLICATION_NAME;
  const body = `Hello ${author},\n\nI read your article in The Ozark Gazette and wanted to contact you regarding:\n\n${article.title || 'Article'}\n${canonical}\n\n`;
  return `mailto:${encodeURIComponent(reporterEmailFromName(author))}?subject=${encodeURIComponent('RE: ' + (article.title || 'The Ozark Gazette article'))}&body=${encodeURIComponent(body)}`;
}

function patchArticleLoaderForStaticTemplate(html) {
  const marker = 'async function loadOzarkArticle(){if(!OZARK_SLUG){';
  const replacement = 'async function loadOzarkArticle(){if(window.OZARK_STATIC_ARTICLE){renderArticle(window.OZARK_STATIC_ARTICLE);return;}if(!OZARK_SLUG){';
  return replaceRequired(html, marker, replacement, 'static article loader hook');
}

function renderArticleHtml(article, filePath) {
  const canonical = publicUrlFromPath(filePath);
  const title = article.title || PUBLICATION_NAME;
  const subtitle = article.subtitle || '';
  const summary = article.summary || subtitle || '';
  const category = normalizeCategory(article.category);
  const categoryPath = categoryHref(category);
  const image = absoluteAssetUrl(article.hero_image_url);
  const body = article.body_html || `<p>${escapeHtml(summary || 'This article is available from The Ozark Gazette.')}</p>`;
  const what = article.what_this_means || '';
  const metaRows = makeMetaRows(article, category, categoryPath);
  const clientArticle = {
    ...article,
    title,
    subtitle,
    summary,
    category,
    slug: articleSlug(article),
    canonical_url: canonical,
    hero_image_url: image,
    image_url: image,
    body_html: body,
    what_this_means: what,
    seo_title: article.seo_title || title,
    seo_description: article.seo_description || summary,
    published_at: isoDate(article.published_at),
    updated_at: isoDate(article.updated_at || article.published_at)
  };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${canonical}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    headline: title,
    description: summary,
    image: [image],
    datePublished: isoDate(article.published_at),
    dateModified: isoDate(article.updated_at || article.published_at),
    author: {
      '@type': 'Person',
      name: article.author || PUBLICATION_NAME,
      url: `${SITE_URL}/reporters/`
    },
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: PUBLICATION_NAME,
      legalName: PUBLICATION_NAME,
      url: `${SITE_URL}/`,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/OzarkGazetteLogo.png` }
    },
    isAccessibleForFree: true
  };

  let html = articleTemplate();

  html = replaceRequired(html, '<title id="page-title">Article | The Ozark Gazette</title>', `<title id="page-title">${escapeHtml(article.seo_title || title)} | ${escapeHtml(PUBLICATION_NAME)}</title>`, 'title');
  html = replaceRequired(html, '<meta name="description" id="meta-description" content="Read the latest article from The Ozark Gazette.">', `<meta name="description" id="meta-description" content="${escapeHtml(article.seo_description || summary)}">`, 'description');
  html = replaceRequired(html, '<link rel="canonical" id="canonical-link" href="https://ozarks.cgnnews.net/article.html">', `<link rel="canonical" id="canonical-link" href="${escapeHtml(canonical)}">`, 'canonical');
  html = replaceRequired(html, '<meta property="og:title" id="og-title" content="Article | The Ozark Gazette">', `<meta property="og:title" id="og-title" content="${escapeHtml(title)} | ${escapeHtml(PUBLICATION_NAME)}">`, 'og:title');
  html = replaceRequired(html, '<meta property="og:description" id="og-description" content="Read the latest article from The Ozark Gazette.">', `<meta property="og:description" id="og-description" content="${escapeHtml(summary)}">`, 'og:description');
  html = replaceRequired(html, '<meta property="og:url" id="og-url" content="https://ozarks.cgnnews.net/article.html">', `<meta property="og:url" id="og-url" content="${escapeHtml(canonical)}">`, 'og:url');
  html = replaceRequired(html, '<meta property="og:image" id="og-image" content="https://ozarks.cgnnews.net/OzarkGazetteBanner.png">', `<meta property="og:image" id="og-image" content="${escapeHtml(image)}">`, 'og:image');
  html = replaceRequired(html, '<meta name="twitter:title" id="twitter-title" content="Article | The Ozark Gazette">', `<meta name="twitter:title" id="twitter-title" content="${escapeHtml(title)} | ${escapeHtml(PUBLICATION_NAME)}">`, 'twitter:title');
  html = replaceRequired(html, '<meta name="twitter:description" id="twitter-description" content="Read the latest article from The Ozark Gazette.">', `<meta name="twitter:description" id="twitter-description" content="${escapeHtml(summary)}">`, 'twitter:description');
  html = replaceRequired(html, '<meta name="twitter:image" id="twitter-image" content="https://ozarks.cgnnews.net/OzarkGazetteBanner.png">', `<meta name="twitter:image" id="twitter-image" content="${escapeHtml(image)}">`, 'twitter:image');
  html = replaceRequired(html, '<script type="application/ld+json" id="article-jsonld">{}</script>', `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`, 'jsonld');

  html = replaceRequired(html, '<div id="category" class="article-kicker">The Ozark Gazette</div>', `<div id="category" class="article-kicker"><a href="${escapeHtml(categoryPath)}">${escapeHtml(category)}</a></div>`, 'category');
  html = replaceRequired(html, '<h1 id="title" itemprop="headline">Loading article...</h1>', `<h1 id="title" itemprop="headline">${escapeHtml(title)}</h1>`, 'headline');
  html = replaceRequired(html, '<h2 id="subtitle"></h2>', `<h2 id="subtitle">${escapeHtml(subtitle)}</h2>`, 'subtitle');
  html = replaceRequired(html, '<div id="meta" class="meta"><div class="loading-note">Loading article details...</div></div>', `<div id="meta" class="meta">${metaRows}</div>`, 'meta');
  html = replaceRequired(html, '<div class="article-actions" aria-label="Article actions" style="display:none">', '<div class="article-actions" aria-label="Article actions">', 'article actions');
  html = replaceRequired(html, '<a id="email-reporter-btn" class="article-action-btn" href="mailto:tips@cgnnews.net?subject=RE%3A%20The%20Ozark%20Gazette">Email Reporter</a>', `<a id="email-reporter-btn" class="article-action-btn" href="${escapeHtml(emailReporterHref(article, canonical))}">Email Reporter</a>`, 'email reporter button');
  html = replaceRequired(html, '<img id="hero" class="hero" itemprop="image" alt="" style="display:none">', `<img id="hero" class="hero" itemprop="image" src="${escapeHtml(image)}" alt="${escapeHtml(title)}" style="display:block">`, 'hero image');
  html = replaceRequired(html, '<div id="image-credit" class="image-credit"></div>', `<div id="image-credit" class="image-credit">${article.image_credit ? `Image: ${escapeHtml(article.image_credit)}` : ''}</div>`, 'image credit');
  html = replaceRequired(html, '<div id="body" class="article-content"></div>', `<div id="body" class="article-content">${body}</div>`, 'article body');
  html = replaceRequired(html, '<div class="analysis-box" style="display:none">', `<div class="analysis-box"${what ? '' : ' style="display:none"'}>`, 'analysis box visibility');
  html = replaceRequired(html, '<div id="analysis"></div>', `<div id="analysis">${what}</div>`, 'analysis');

  const staticScript = `<script>window.OZARK_STATIC_ARTICLE=${JSON.stringify(clientArticle).replace(/</g, '\\u003c')};</script>\n`;
  html = replaceRequired(html, '<script>\nconst OZARK_API_FALLBACK=', `${staticScript}<script>\nconst OZARK_API_FALLBACK=`, 'static article data');
  html = patchArticleLoaderForStaticTemplate(html);

  return html;
}

function cleanGeneratedDateDirs() {
  for (const base of ROUTE_FAMILIES) {
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory() && GENERATED_YEAR_RE.test(entry.name)) {
        fs.rmSync(path.join(base, entry.name), { recursive: true, force: true });
      }
    }
  }
}

function writeFileSafe(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

function writeRootFile(filePath, contents) {
  fs.writeFileSync(filePath, contents, 'utf8');
}

function writeArticleSitemap(records) {
  const rows = records
    .slice()
    .sort((a, b) => a.url.localeCompare(b.url))
    .map(item => [
      '  <url>',
      `    <loc>${escapeXml(item.url)}</loc>`,
      `    <lastmod>${escapeXml(isoDate(item.article.updated_at || item.article.published_at))}</lastmod>`,
      '    <changefreq>daily</changefreq>',
      '    <priority>0.8</priority>',
      '  </url>'
    ].join('\n'));
  writeRootFile('article-sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`);
}

function writeGeneralSitemap(records) {
  const baseUrls = [
    `${SITE_URL}/`,
    `${SITE_URL}/news/`,
    `${SITE_URL}/local/`,
    `${SITE_URL}/obituaries/`,
    `${SITE_URL}/weather/`,
    `${SITE_URL}/sports/`,
    `${SITE_URL}/traffic/`,
    `${SITE_URL}/markets/`,
    `${SITE_URL}/markets/center/`
  ];
  const today = new Date().toISOString();
  const urls = [...new Set([...baseUrls, ...records.map(r => r.url)])];
  const rows = urls.map(url => [
    '  <url>',
    `    <loc>${escapeXml(url)}</loc>`,
    `    <lastmod>${escapeXml(today)}</lastmod>`,
    '  </url>'
  ].join('\n'));
  writeRootFile('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`);
}

function writeGoogleNewsSitemap(records) {
  const cutoff = Date.now() - NEWS_SITEMAP_HOURS * 60 * 60 * 1000;
  const recent = records
    .filter(item => articlePublishedDate(item.article).getTime() >= cutoff)
    .sort((a, b) => articlePublishedDate(b.article).getTime() - articlePublishedDate(a.article).getTime())
    .slice(0, 1000);

  const rows = recent.map(item => [
    '  <url>',
    `    <loc>${escapeXml(item.url)}</loc>`,
    '    <news:news>',
    '      <news:publication>',
    `        <news:name>${escapeXml(PUBLICATION_NAME)}</news:name>`,
    '        <news:language>en</news:language>',
    '      </news:publication>',
    `      <news:publication_date>${escapeXml(isoDate(item.article.published_at || item.article.updated_at))}</news:publication_date>`,
    `      <news:title>${escapeXml(item.article.title || PUBLICATION_NAME)}</news:title>`,
    '    </news:news>',
    `    <lastmod>${escapeXml(isoDate(item.article.updated_at || item.article.published_at))}</lastmod>`,
    '  </url>'
  ].join('\n'));

  writeRootFile('news-sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${rows.join('\n')}\n</urlset>\n`);
  return recent.length;
}

function ensureRobotsSitemapHints() {
  const robotsPath = 'robots.txt';
  let robots = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, 'utf8') : 'User-agent: *\nAllow: /\n';
  const required = [
    `${SITE_URL}/sitemap.xml`,
    `${SITE_URL}/article-sitemap.xml`,
    `${SITE_URL}/news-sitemap.xml`
  ];
  for (const sitemapUrl of required) {
    if (!robots.includes(sitemapUrl)) {
      if (!robots.endsWith('\n')) robots += '\n';
      robots += `Sitemap: ${sitemapUrl}\n`;
    }
  }
  writeRootFile(robotsPath, robots);
}

function validateRecords(records) {
  for (const record of records) {
    if (!record.filePath.endsWith('/index.html')) throw new Error(`Generated path is not an index.html page: ${record.filePath}`);
    if (!ROUTE_FAMILIES.some(base => record.filePath.startsWith(`${base}/`))) throw new Error(`Generated path has unsupported route family: ${record.filePath}`);
    if (!fs.existsSync(record.filePath)) throw new Error(`Generated page missing on disk: ${record.filePath}`);
    if (!record.url.startsWith(`${SITE_URL}/`)) throw new Error(`Generated URL outside site origin: ${record.url}`);
  }
}

async function main() {
  console.log(`Ozark static build for ${SITE_URL}`);
  console.log(`News sitemap window: ${NEWS_SITEMAP_HOURS} hours`);

  const articles = uniqueArticles(await fetchAllArticles());
  if (!articles.length) throw new Error('No publishable Ozark articles were returned. Refusing to replace sitemaps with empty output.');

  cleanGeneratedDateDirs();

  const records = [];
  for (const article of articles) {
    const filePath = articlePath(article);
    writeFileSafe(filePath, renderArticleHtml(article, filePath));
    records.push({ article, filePath, url: publicUrlFromPath(filePath) });
  }

  validateRecords(records);
  writeArticleSitemap(records);
  writeGeneralSitemap(records);
  const newsCount = writeGoogleNewsSitemap(records);
  ensureRobotsSitemapHints();

  const counts = records.reduce((acc, item) => {
    const family = item.filePath.split('/')[0];
    acc[family] = (acc[family] || 0) + 1;
    return acc;
  }, {});

  console.log(`Generated ${records.length} static Ozark article pages.`);
  console.log(`Route counts: ${JSON.stringify(counts)}`);
  console.log(`Generated article-sitemap.xml with ${records.length} URLs.`);
  console.log(`Generated news-sitemap.xml with ${newsCount} URLs from the last ${NEWS_SITEMAP_HOURS} hours.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
