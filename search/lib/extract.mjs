// Pulls the title, description, readable text and links out of an HTML page.
// This is a light extractor, enough for ordinary server rendered pages. Sites that build
// their pages with JavaScript need the "manual" source instead (see the README).

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

const SKIP_EXT = /\.(?:pdf|jpe?g|png|gif|webp|svg|ico|zip|gz|mp[34]|mov|avi|css|js|json|xml|woff2?|ttf|exe|dmg|apk)$/i;

export function normaliseUrl(href, base) {
  try {
    const u = new URL(href, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    if (SKIP_EXT.test(u.pathname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

export function extract(html, baseUrl) {
  html = String(html).slice(0, 1_500_000);

  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim());

  let description = '';
  let robots = '';
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const name = (a.name || a.property || '').toLowerCase();
    if ((name === 'description' || name === 'og:description') && !description) description = (a.content || '').trim();
    if (name === 'robots' || name === 'cirklesearchbot') robots += ' ' + (a.content || '').toLowerCase();
  }

  let canonical = null;
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    if ((a.rel || '').toLowerCase() === 'canonical' && a.href) canonical = normaliseUrl(a.href, baseUrl);
  }

  const links = [];
  for (const m of html.matchAll(/<a\b([^>]*)>/gi)) {
    const a = attrs(m[1]);
    if (!a.href || /nofollow/i.test(a.rel || '')) continue;
    const url = normaliseUrl(a.href, baseUrl);
    if (url) links.push(url);
  }

  const text = decode(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/?(p|div|br|li|ul|ol|h[1-6]|section|article|tr|td|th|table|header|footer|nav|main|blockquote|pre)\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();

  return {
    title,
    description,
    text,
    links,
    canonical,
    noindex: /noindex|none/.test(robots),
    nofollow: /nofollow|none/.test(robots),
  };
}
