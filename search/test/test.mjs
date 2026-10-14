import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { crawl } from '../crawler/crawl.mjs';
import { buildIndex, search } from '../lib/index.mjs';
import { parseRobots } from '../lib/robots.mjs';
import { extract } from '../lib/extract.mjs';
import { answer } from '../api/search.js';

const page = (title, body, head = '') =>
  `<!doctype html><html><head><title>${title}</title>${head}</head><body>${body}</body></html>`;

const routes = {
  '/robots.txt': ['text/plain', 'User-agent: *\nDisallow: /private\n'],
  '/': ['text/html', page('Home of gardening', '<p>Welcome to our gardening guides about tomatoes and compost for beginners.</p><a href="/tomatoes">t</a> <a href="/private/secret">s</a> <a href="/hidden">h</a> <a href="/file.pdf">p</a> <a href="http://other.invalid/x">o</a>')],
  '/tomatoes': ['text/html', page('Growing tomatoes', '<p>Tomatoes need sun, water and regular feeding. Growing tomatoes in pots works well on a balcony.</p>', '<meta name="description" content="How to grow tomatoes">')],
  '/private/secret': ['text/html', page('Secret', '<p>This private page must never be indexed by any crawler at all.</p>')],
  '/hidden': ['text/html', page('Hidden', '<p>This page asks not to be indexed by search engines at all.</p>', '<meta name="robots" content="noindex">')],
  '/file.pdf': ['application/pdf', '%PDF-1.4 not really']
};

let server, base, host;
before(async () => {
  server = http.createServer((req, res) => {
    const r = routes[req.url.split('?')[0]];
    if (!r) { res.writeHead(404); return res.end('no'); }
    res.writeHead(200, { 'content-type': r[0] });
    res.end(r[1]);
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  host = `127.0.0.1:${server.address().port}`;
  base = `http://${host}`;
});
after(() => server.close());

test('crawler obeys robots.txt, noindex, host limits and content type', async () => {
  const pages = await crawl({ seeds: [base + '/'], allowedHosts: [host], delayMs: 0, maxDepth: 2 });
  const urls = pages.map((p) => new URL(p.url).pathname).sort();
  assert.deepEqual(urls, ['/', '/tomatoes']);
});

test('search finds and ranks pages, and stems words', async () => {
  const pages = await crawl({ seeds: [base + '/'], allowedHosts: [host], delayMs: 0 });
  const index = buildIndex(pages);
  const r = search(index, 'growing tomato');
  assert.ok(r.results.length >= 1);
  assert.equal(new URL(r.results[0].url).pathname, '/tomatoes');
  assert.ok(r.results[0].snippet.length > 0);
});

test('hostile queries are safe', () => {
  const index = buildIndex([{ url: 'https://a.test/', title: 'A', text: 'some words here that are long enough' }]);
  for (const q of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    assert.deepEqual(search(index, q).results, []);
  }
});

test('empty query and empty index', () => {
  const index = buildIndex([]);
  assert.deepEqual(search(index, 'anything').results, []);
  assert.equal(answer('   ').status, 400);
});

test('robots parser: longest rule wins, allow wins ties', () => {
  const r = parseRobots('User-agent: *\nDisallow: /a\nAllow: /a/b\nCrawl-delay: 2\n', 'CirkleSearchBot');
  assert.equal(r.allowed('/a/x'), false);
  assert.equal(r.allowed('/a/b/c'), true);
  assert.equal(r.allowed('/z'), true);
  assert.equal(r.delay, 2);
});

test('extract reads title, canonical and nofollow', () => {
  const p = extract(page('T', '<p>Hello there world, this is text.</p><a href="/x">x</a>', '<link rel="canonical" href="/c"><meta name="robots" content="nofollow">'), 'https://a.test/p');
  assert.equal(p.title, 'T');
  assert.equal(p.nofollow, true);
  assert.equal(p.canonical, 'https://a.test/c');
});
