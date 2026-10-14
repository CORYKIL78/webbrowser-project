// Polite crawler. Reads sources.json, visits only the sites you list, obeys robots.txt and
// noindex, waits between requests, and writes data/index.json.
//
//   node search/crawler/crawl.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract, normaliseUrl } from '../lib/extract.mjs';
import { parseRobots } from '../lib/robots.mjs';
import { buildIndex } from '../lib/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_BYTES = 1_500_000;

export async function crawl(config, log = () => {}) {
  const ua = config.userAgent || 'CirkleSearchBot/0.1';
  const botName = ua.split('/')[0];
  const allowedHosts = new Set((config.allowedHosts || []).map((h) => h.toLowerCase()));
  const maxPages = config.maxPages ?? 200;
  const maxDepth = config.maxDepth ?? 3;
  const timeoutMs = config.timeoutMs ?? 10000;
  const baseDelay = config.delayMs ?? 1000;

  const robotsByHost = new Map();
  const lastHit = new Map();
  const seen = new Set();
  const pages = [];
  const queue = [];

  const enqueue = (url, depth) => {
    if (!url || seen.has(url)) return;
    let host;
    try { host = new URL(url).host.toLowerCase(); } catch { return; }
    if (!allowedHosts.has(host)) return;
    seen.add(url);
    queue.push({ url, depth });
  };
  for (const seed of config.seeds || []) enqueue(normaliseUrl(seed, seed), 0);

  async function robotsFor(url) {
    const u = new URL(url);
    if (!robotsByHost.has(u.host)) {
      let parsed = parseRobots('', botName);
      try {
        const res = await fetch(`${u.origin}/robots.txt`, { headers: { 'user-agent': ua }, signal: AbortSignal.timeout(timeoutMs) });
        if (res.ok) parsed = parseRobots(await res.text(), botName);
        else if (res.status >= 500) parsed = parseRobots('User-agent: *\nDisallow: /', botName); // be careful if the site is struggling
      } catch { /* no robots.txt reachable: treat as allowed */ }
      robotsByHost.set(u.host, parsed);
    }
    return robotsByHost.get(u.host);
  }

  while (queue.length && pages.length < maxPages) {
    const { url, depth } = queue.shift();
    const robots = await robotsFor(url);
    const u = new URL(url);
    if (!robots.allowed(u.pathname + u.search)) { log(`skip (robots) ${url}`); continue; }

    const delay = Math.max(baseDelay, Math.min((robots.delay ?? 0) * 1000, 10000));
    const wait = (lastHit.get(u.host) || 0) + delay - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit.set(u.host, Date.now());

    let res;
    try {
      res = await fetch(url, { headers: { 'user-agent': ua, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) { log(`skip (error) ${url}: ${e.message}`); continue; }

    const finalHost = new URL(res.url).host.toLowerCase();
    if (!res.ok || !allowedHosts.has(finalHost)) { log(`skip (${res.status} or left allowed hosts) ${url}`); continue; }
    if (!(res.headers.get('content-type') || '').includes('text/html')) continue;
    if (/noindex|none/i.test(res.headers.get('x-robots-tag') || '')) { log(`skip (noindex header) ${url}`); continue; }
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) continue;
    const body = await res.text();
    if (body.length > MAX_BYTES) continue;

    const page = extract(body, res.url);
    if (!page.noindex) {
      const pageUrl = page.canonical && allowedHosts.has(new URL(page.canonical).host.toLowerCase()) ? page.canonical : res.url;
      if (!pages.some((p) => p.url === pageUrl) && page.text.length > 20) {
        pages.push({ url: pageUrl, title: page.title, description: page.description, text: page.text });
        log(`indexed ${pageUrl}`);
      }
    }
    if (!page.nofollow && depth < maxDepth) for (const link of page.links) enqueue(link, depth + 1);
  }

  // Pages you write in by hand, for sites that cannot be crawled (for example ones drawn by JavaScript).
  for (const m of config.manualPages || []) {
    if (m && m.url && m.title && m.text) pages.push({ url: m.url, title: m.title, description: m.description || '', text: m.text });
  }
  return pages;
}

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'sources.json'), 'utf8'));
  const manualFile = path.join(ROOT, config.manual || 'sources/manual.json');
  config.manualPages = fs.existsSync(manualFile) ? JSON.parse(fs.readFileSync(manualFile, 'utf8')) : [];

  const placeholder = (config.seeds || []).every((s) => /(^|\.)example\.(com|org|net)\b/.test(new URL(s).host));
  if (placeholder && !config.manualPages.length) {
    console.log('No real sites configured in search/sources.json, so nothing was crawled and the index is unchanged.');
    return;
  }
  const pages = await crawl(config, (m) => console.log(m));
  if (!pages.length) { console.error('No pages were indexed. Leaving the existing index in place.'); process.exitCode = 1; return; }
  const index = buildIndex(pages);
  const out = path.join(ROOT, 'data', 'index.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(index));
  console.log(`Indexed ${pages.length} pages, ${Object.keys(index.terms).length} terms.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
