export function parseRoute(hash) {
  const h = (hash || '').replace(/^#/, '');
  if (!h || h === '/') return { name: 'browse' };
  const m = h.match(/^\/license\/([a-z0-9][a-z0-9-]*)(?:\/(text))?$/);
  if (m) return m[2] ? { name: 'text', id: m[1] } : { name: 'detail', id: m[1] };
  const cm = h.match(/^\/compare(?:\?set=([a-z0-9,.-]+))?$/);
  if (cm) return { name: 'compare', ids: cm[1] ? cm[1].split(',').filter(Boolean) : [] };
  return { name: 'browse' };
}

export function serializeCompare(ids) {
  return '#/compare?set=' + ids.join(',');
}
