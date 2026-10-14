(() => {
  const form = document.getElementById('form');
  const input = document.getElementById('q');
  const list = document.getElementById('results');
  const status = document.getElementById('status');
  const google = document.getElementById('google');

  // Builds text with highlighted words using DOM nodes only, so page text can never run as HTML.
  function highlight(text, words) {
    const frag = document.createDocumentFragment();
    if (!words.length) { frag.append(text); return frag; }
    const re = new RegExp('(' + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
    text.split(re).forEach((part, i) => {
      if (i % 2) { const m = document.createElement('mark'); m.textContent = part; frag.append(m); } else frag.append(part);
    });
    return frag;
  }

  function show(data) {
    list.replaceChildren();
    if (!data.results.length) {
      status.textContent = 'No results in Cirkle Search.';
    } else {
      status.textContent = data.results.length + (data.results.length === 1 ? ' result' : ' results');
    }
    for (const r of data.results) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = r.url; a.rel = 'noopener'; a.textContent = r.title;
      const url = document.createElement('div'); url.className = 'url'; url.textContent = r.url;
      const p = document.createElement('p'); p.append(highlight(r.snippet, data.words));
      li.append(a, url, p);
      list.append(li);
    }
    google.href = 'https://www.google.com/search?q=' + encodeURIComponent(data.query);
    google.hidden = false;
  }

  async function run(q) {
    status.textContent = 'Searching';
    try {
      const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q }) });
      const data = await res.json();
      if (!res.ok) { status.textContent = data.error || 'Something went wrong.'; return; }
      show(data);
    } catch {
      status.textContent = 'Search is not available right now.';
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) run(q);
  });

  // Opened from a browser's search bar: /?q=...
  const initial = new URLSearchParams(location.search).get('q');
  if (initial) { input.value = initial; run(initial); history.replaceState(null, '', '/'); }
})();
