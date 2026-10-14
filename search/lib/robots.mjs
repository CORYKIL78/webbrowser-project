// Minimal robots.txt reader. Follows the standard rules: the most specific group for our
// bot name wins, otherwise the "*" group; the longest matching rule wins; Allow beats
// Disallow when they are the same length. Supports * and $ in paths and Crawl-delay.

function toRegex(path) {
  const escaped = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped.replace(/\\\$$/, '$'));
}

export function parseRobots(text, botName) {
  const bot = botName.toLowerCase();
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) { current = { agents: [], rules: [], delay: null }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      if (value) current.rules.push({ allow: key === 'allow', len: value.length, re: toRegex(value) });
    } else if (key === 'crawl-delay') {
      const d = Number(value);
      if (Number.isFinite(d) && d >= 0) current.delay = d;
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && bot.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  const rules = chosen.flatMap((g) => g.rules);
  const delay = chosen.map((g) => g.delay).find((d) => d !== null) ?? null;
  return {
    delay,
    allowed(pathAndQuery) {
      let best = null;
      for (const r of rules) {
        if (!r.re.test(pathAndQuery)) continue;
        if (!best || r.len > best.len || (r.len === best.len && r.allow)) best = r;
      }
      return best ? best.allow : true;
    },
  };
}
