// Builds and searches the index. Ranking is BM25, the standard method for keyword search:
// rarer words count for more, and long pages are not favoured over short ones.
import { tokenize, queryWords } from './text.mjs';

const K1 = 1.4;
const B = 0.75;
const KEEP_TEXT = 2000; // characters of each page kept for snippets

export function buildIndex(pages, builtAt = new Date()) {
  const docs = [];
  const terms = Object.create(null);
  let total = 0;

  pages.forEach((page, id) => {
    const title = tokenize(page.title);
    const desc = tokenize(page.description || '');
    // Words in the title count three times and in the description twice, so they rank higher.
    const tokens = [...tokenize(page.text), ...title, ...title, ...title, ...desc, ...desc];
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [term, count] of tf) (terms[term] ||= []).push([id, count]);
    docs.push({
      url: page.url,
      title: page.title || page.url,
      description: page.description || '',
      text: String(page.text || '').slice(0, KEEP_TEXT),
      len: tokens.length || 1,
    });
    total += tokens.length || 1;
  });

  return { version: 1, builtAt: builtAt.toISOString(), avgLen: docs.length ? total / docs.length : 1, docs, terms };
}

export function snippet(doc, words, size = 170) {
  const text = doc.text || doc.description || '';
  const lower = text.toLowerCase();
  let at = -1;
  for (const w of words) {
    const i = lower.indexOf(w);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return (doc.description || text).slice(0, size);
  const start = Math.max(0, at - 50);
  const piece = text.slice(start, start + size).trim();
  return (start > 0 ? '…' : '') + piece + (start + size < text.length ? '…' : '');
}

export function search(index, query, { limit = 10 } = {}) {
  const words = queryWords(query);
  const wanted = [...new Set(tokenize(query))];
  if (!wanted.length || !index.docs.length) return { words, results: [] };

  const n = index.docs.length;
  const score = new Map();
  const matched = new Map();
  for (const term of wanted) {
    // Own-property check so a query such as "__proto__" can never reach inherited properties.
    if (!Object.hasOwn(index.terms, term)) continue;
    const postings = index.terms[term];
    const idf = Math.log(1 + (n - postings.length + 0.5) / (postings.length + 0.5));
    for (const [id, tf] of postings) {
      const len = index.docs[id].len;
      const part = idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (len / index.avgLen))));
      score.set(id, (score.get(id) || 0) + part);
      matched.set(id, (matched.get(id) || 0) + 1);
    }
  }

  const ranked = [...score.entries()]
    .map(([id, s]) => [id, matched.get(id) === wanted.length ? s * 1.25 : s]) // pages with every word go first
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return {
    words,
    results: ranked.map(([id, s]) => {
      const d = index.docs[id];
      return { url: d.url, title: d.title, snippet: snippet(d, words), score: Math.round(s * 100) / 100 };
    }),
  };
}
