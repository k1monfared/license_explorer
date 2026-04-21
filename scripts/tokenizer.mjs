const ABBREVS = new Set([
  'Mr', 'Mrs', 'Ms', 'Dr', 'Jr', 'Sr', 'St',
  'Inc', 'Ltd', 'Co', 'Corp',
  'vs', 'etc', 'e.g', 'i.e', 'cf', 'al',
  'U.S', 'U.K', 'U.N'
]);

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function splitSentences(text) {
  if (!text || !text.trim()) return [];
  const out = [];
  let buf = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    buf += ch;
    if (ch === '.' || ch === '!' || ch === '?') {
      const tail = buf.trimEnd();
      const prevWord = tail.slice(0, -1).split(/\s/).pop() || '';
      const next = text[i + 1];
      const isEnd = !next || /[\s\n]/.test(next);
      if (ch === '.' && ABBREVS.has(prevWord)) { i++; continue; }
      if (isEnd) {
        const trimmed = buf.trim();
        if (trimmed) out.push(trimmed);
        buf = '';
      }
    }
    i++;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

export function tokenizeToHtml(text) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return { html: '', sentences: [] };
  const paragraphSplit = /\n\s*\n/.test(text);
  const spans = sentences.map((s, idx) =>
    `<span id="s-${idx}" class="sentence">${escapeHtml(s)}</span>`);
  const html = paragraphSplit ? spans.join('<br><br>') : spans.join(' ');
  return { html, sentences };
}

export function extractSentences(html) {
  return [...html.matchAll(/<span[^>]*id="s-\d+"[^>]*>([\s\S]*?)<\/span>/g)]
    .map(m => m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
}
