// Turns text into search terms. The same function is used when building the index and when
// reading a query, so both sides always agree.
const STOP = new Set(('a an the and or but if then so of to in on at by for with from as is are was were be been being ' +
  'am do does did have has had i me my we our you your he she it its they them their this that these those there here ' +
  'what which who when where why how can could would should will may might must not no yes').split(' '));

export function stem(word) {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function tokenize(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

// Plain words from a query, used to highlight matches. Not stemmed.
export function queryWords(query = '') {
  return [...new Set(String(query).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1))].slice(0, 12);
}
