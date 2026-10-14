// Search API for Vercel.
//   POST /api/search   body {"q": "..."}   (the search page uses this, so queries never appear in URLs)
//   GET  /api/search?q=...                 (for browsers' search bar integration)
// Queries are not stored or logged by this code.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { search } from '../lib/index.mjs';

let cached;
function loadIndex() {
  if (!cached) cached = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../data/index.json', import.meta.url)), 'utf8'));
  return cached;
}

export function answer(q) {
  const query = String(q ?? '').slice(0, 200).trim();
  if (!query) return { status: 400, body: { error: 'Type something to search for.' } };
  const { words, results } = search(loadIndex(), query);
  return { status: 200, body: { query, words, results } };
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  let q = req.method === 'GET' ? req.query?.q : req.body?.q;
  if (req.method === 'POST' && typeof req.body === 'string') {
    try { q = JSON.parse(req.body).q; } catch { q = ''; }
  }
  try {
    const { status, body } = answer(q);
    return res.status(status).json(body);
  } catch {
    return res.status(500).json({ error: 'Search is not available right now.' });
  }
}
