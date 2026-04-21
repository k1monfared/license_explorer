import { useState, useEffect } from "react";

function parseRoute(hash) {
  const h = (hash || '').replace(/^#/, '');
  if (!h || h === '/') return { name: 'browse' };
  const m = h.match(/^\/license\/([a-z0-9][a-z0-9-]*)(?:\/(text))?(\?.*)?$/);
  if (m) return m[2] ? { name: 'text', id: m[1] } : { name: 'detail', id: m[1] };
  const cm = h.match(/^\/compare(?:\?set=([a-z0-9,.-]+))?$/);
  if (cm) return { name: 'compare', ids: cm[1] ? cm[1].split(',').filter(Boolean) : [] };
  return { name: 'browse' };
}

function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

function useCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    fetch('licenses/index.json')
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(setCatalog).catch(e => setErr(String(e)));
  }, []);
  return { catalog, err };
}

function ValueBadge({ v }) {
  const styles = {
    permitted:    { bg: 'rgba(74,222,128,.15)',  color: '#4ade80', label: 'permitted' },
    required:     { bg: 'rgba(250,204,21,.15)',  color: '#facc15', label: 'required' },
    forbidden:    { bg: 'rgba(248,113,113,.15)', color: '#f87171', label: 'forbidden' },
    silent:       { bg: 'transparent',           color: '#6b7280', label: 'silent' },
    grey:         { bg: 'rgba(156,163,175,.18)', color: '#9ca3af', label: 'grey area' },
    not_assessed: { bg: 'transparent',           color: '#4b5563', label: 'not assessed' }
  }[v] || { bg: '', color: '#888', label: v };
  return <span className="val" style={{ background: styles.bg, color: styles.color }} title={v}>{styles.label}</span>;
}

// ---------- Browse ----------
function FilterSidebar({ catalog, filters, setFilters }) {
  const mediums = [...new Set(catalog.map(l => l.medium))];
  const archetypes = [...new Set(catalog.map(l => l.archetype))];
  const toggleSet = (key, v) => {
    const cur = new Set(filters[key]);
    cur.has(v) ? cur.delete(v) : cur.add(v);
    setFilters({ ...filters, [key]: [...cur] });
  };
  const Group = ({ title, name, values }) => (
    <div className="filter-group">
      <div className="filter-h">{title}</div>
      {values.map(v => {
        const on = filters[name].includes(v);
        const count = catalog.filter(l => l[name] === v).length;
        return (
          <label key={v} className="filter-item">
            <span><input type="checkbox" checked={on} onChange={() => toggleSet(name, v)}/> {v}</span>
            <span className="count">{count}</span>
          </label>
        );
      })}
    </div>
  );
  return (
    <aside className="filter-panel">
      <Group title="Medium"    name="medium"    values={mediums}/>
      <Group title="Archetype" name="archetype" values={archetypes}/>
    </aside>
  );
}

function BrowsePage() {
  const { catalog, err } = useCatalog();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ medium: [], archetype: [] });
  const [set, setSet] = useState([]);
  const toggle = (id) => setSet(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  if (err) return <p style={{color:'#f87171'}}>Error: {err}</p>;
  if (!catalog) return <p>Loading...</p>;
  if (catalog.length === 0) return <p>No licenses yet. Add one via <code>/add-license</code>.</p>;

  const rows = catalog.filter(l => {
    if (filters.medium.length    && !filters.medium.includes(l.medium))       return false;
    if (filters.archetype.length && !filters.archetype.includes(l.archetype)) return false;
    if (q) {
      const needle = q.toLowerCase();
      return l.name.toLowerCase().includes(needle)
          || l.blurb.toLowerCase().includes(needle)
          || l.tags.some(t => t.toLowerCase().includes(needle));
    }
    return true;
  });

  return (
    <div className="browse">
      <FilterSidebar catalog={catalog} filters={filters} setFilters={setFilters}/>
      <div className="browse-main">
        <input className="search" placeholder="Search licenses, features, keywords..."
               value={q} onChange={e => setQ(e.target.value)}/>
        <table className="brz">
          <thead><tr><th></th><th>Name</th><th>Archetype</th><th>Medium</th><th>Tags</th></tr></thead>
          <tbody>
            {rows.map(l => (
              <tr key={l.id}>
                <td><input type="checkbox" checked={set.includes(l.id)} onChange={() => toggle(l.id)}/></td>
                <td><a href={`#/license/${l.id}`}>{l.name}</a></td>
                <td>{l.archetype}</td>
                <td>{l.medium}</td>
                <td>{l.tags.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {set.length > 0 && (
          <div className="cmp-tray">
            <span>Comparing ({set.length}): {set.join(', ')}</span>
            <a href={`#/compare?set=${set.join(',')}`} className="cmp-go">Compare &rarr;</a>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Detail ----------
function DetailPage({ id }) {
  const [meta, setMeta]         = useState(null);
  const [feats, setFeats]       = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [err, setErr]           = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`licenses/${id}/meta.json`).then(r => r.ok ? r.json() : Promise.reject(`meta ${r.status}`)),
      fetch(`licenses/${id}/features.json`).then(r => r.ok ? r.json() : Promise.reject(`features ${r.status}`))
    ]).then(([m, f]) => { setMeta(m); setFeats(f); }).catch(e => setErr(String(e)));
    fetch(`licenses/${id}/analysis.json`).then(r => r.ok ? r.json() : null).then(setAnalysis).catch(() => setAnalysis(null));
  }, [id]);

  if (err) return <p style={{color:'#f87171'}}>Error: {err}</p>;
  if (!meta || !feats) return <p>Loading...</p>;

  const Row = ({ e }) => (
    <tr>
      <td className="feat-label">{e.key}</td>
      <td><ValueBadge v={e.value}/></td>
      <td>{e.citations.map((c, i) => (
        <a key={i} href={`#/license/${id}/text?s=${c.sentence_id}`} title={c.note || ''} style={{marginRight:'0.4rem'}}>{c.sentence_id}</a>
      ))}</td>
      <td style={{fontSize:'0.85rem', color:'#9ca3af'}}>{e.commentary || ''}</td>
    </tr>
  );

  const Section = ({ title, entries }) => (
    <>
      <h3>{title}</h3>
      <table className="feat-table"><tbody>
        {entries.map(e => <Row key={e.key} e={e}/>)}
      </tbody></table>
    </>
  );

  return (
    <div>
      <p><a href="#/">&larr; All licenses</a></p>
      <h2>{meta.name}</h2>
      <p className="meta">{meta.medium} &middot; {meta.archetype}{meta.spdx && ` · SPDX: ${meta.spdx}`}</p>
      <p><a href={`#/license/${id}/text`}>View full text &rarr;</a></p>
      <Section title="Permissions" entries={feats.permissions}/>
      <Section title="Conditions"  entries={feats.conditions}/>
      <Section title="Limitations" entries={feats.limitations}/>
      <h3>References</h3>
      <ul>{meta.references.map(r => (
        <li key={r.url}><a href={r.url} target="_blank" rel="noopener">{r.source}</a>{r.note && <span> &mdash; {r.note}</span>}</li>
      ))}</ul>
      {analysis && analysis.entries && analysis.entries.length > 0 && (
        <>
          <h3>Deep analysis</h3>
          {analysis.entries.map((e, i) => (
            <section key={i} className="analysis-entry">
              <h4>{e.topic}</h4>
              <p>{e.summary}</p>
              <ul>{e.sources.map((s, j) => (
                <li key={j}>
                  <a href={s.url} target="_blank" rel="noopener">{s.source}</a>
                  {s.excerpt && <blockquote>&ldquo;{s.excerpt}&rdquo;</blockquote>}
                  {s.summary && !s.excerpt && <p style={{fontSize:'0.85rem', color:'#9ca3af'}}>{s.summary}</p>}
                </li>
              ))}</ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

// ---------- Text viewer ----------
function TextPage({ id }) {
  const [html, setHtml] = useState(null);
  const [err, setErr]   = useState(null);

  useEffect(() => {
    fetch(`licenses/${id}/text.html`)
      .then(r => r.ok ? r.text() : Promise.reject(`HTTP ${r.status}`))
      .then(setHtml).catch(e => setErr(String(e)));
  }, [id]);

  useEffect(() => {
    if (!html) return;
    const m = location.hash.match(/[?&]s=(s-\d+)/);
    if (m) {
      setTimeout(() => {
        const el = document.getElementById(m[1]);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('pulse'); }
      }, 50);
    }
  }, [html]);

  if (err) return <p style={{color:'#f87171'}}>Error: {err}</p>;
  if (!html) return <p>Loading...</p>;

  return (
    <div>
      <p><a href={`#/license/${id}`}>&larr; Back to {id}</a></p>
      <article className="license-text" dangerouslySetInnerHTML={{ __html: html }}/>
    </div>
  );
}

// ---------- Compare ----------
function ComparePage({ ids }) {
  const [catalog, setCatalog] = useState(null);
  const [data, setData]       = useState({});
  const [order, setOrder]     = useState(ids);
  const [expanded, setExpanded] = useState({});

  const orderKey = order.join(',');
  useEffect(() => { setOrder(ids); }, [ids.join(',')]);

  useEffect(() => {
    fetch('licenses/index.json').then(r => r.json()).then(setCatalog).catch(() => {});
  }, []);

  useEffect(() => {
    const missing = order.filter(id => !data[id]);
    if (missing.length === 0) return;
    Promise.all(missing.map(id =>
      Promise.all([
        fetch(`licenses/${id}/meta.json`).then(r => r.json()),
        fetch(`licenses/${id}/features.json`).then(r => r.json())
      ]).then(([meta, feat]) => [id, { meta, feat }])
       .catch(() => [id, null])
    )).then(results => {
      setData(d => { const next = { ...d }; for (const [id, v] of results) if (v) next[id] = v; return next; });
    });
  }, [orderKey]);

  const updateHash = (next) => { location.hash = '#/compare?set=' + next.join(','); };
  const removeCol  = (id)   => { updateHash(order.filter(x => x !== id)); };
  const addCol     = (id)   => { if (!order.includes(id)) updateHash([...order, id]); };
  const moveCol    = (from, to) => {
    if (from === to) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    updateHash(next);
  };

  if (!catalog) return <p>Loading...</p>;
  if (order.length === 0) return <p>No licenses selected. <a href="#/">Go browse &rarr;</a></p>;

  const firstLoaded = order.find(id => data[id]);
  if (!firstLoaded) return <p>Loading licenses...</p>;

  const vocabGroups = ['permissions', 'conditions', 'limitations'];
  const rowsByGroup = {};
  for (const g of vocabGroups) {
    rowsByGroup[g] = data[firstLoaded].feat[g].map(e => e.key);
  }

  const findEntry = (id, g, key) => {
    const f = data[id]?.feat;
    if (!f) return null;
    return f[g].find(e => e.key === key) || { key, value: 'not_assessed', citations: [], external_references: [] };
  };

  const toggleExpand = (g, key) => setExpanded(x => ({ ...x, [`${g}:${key}`]: !x[`${g}:${key}`] }));
  const available = catalog.filter(c => !order.includes(c.id));

  return (
    <div>
      <p><a href="#/">&larr; All licenses</a></p>
      <h2>Compare</h2>
      <table className="cmp-table">
        <thead>
          <tr>
            <th></th>
            {order.map((id, i) => (
              <th key={id} draggable
                  onDragStart={e => e.dataTransfer.setData('from', String(i))}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => moveCol(Number(e.dataTransfer.getData('from')), i)}>
                <span style={{cursor:'grab', marginRight:'0.3rem'}}>&equiv;</span>
                <a href={`#/license/${id}`}>{data[id]?.meta?.name || id}</a>
                <button onClick={() => removeCol(id)} aria-label={`remove ${id}`} style={{marginLeft:'0.5rem'}}>&times;</button>
              </th>
            ))}
            <th>
              {available.length > 0 && (
                <select onChange={e => { if (e.target.value) { addCol(e.target.value); e.target.value = ''; }}} defaultValue="">
                  <option value="">+ add</option>
                  {available.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {vocabGroups.map(g => (
            <GroupRows key={g} g={g} order={order} rows={rowsByGroup[g]}
                       data={data} expanded={expanded} toggleExpand={toggleExpand} findEntry={findEntry}/>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({ g, order, rows, data, expanded, toggleExpand, findEntry }) {
  return (
    <>
      <tr><td colSpan={order.length + 2} className="group-h">{g}</td></tr>
      {rows.map(key => {
        const isOpen = expanded[`${g}:${key}`];
        return (
          <>
            <tr key={`${g}-${key}`}>
              <td className="feat-label">
                {key}
                <button className="cite-btn" onClick={() => toggleExpand(g, key)} title="show citations">&para;</button>
              </td>
              {order.map(id => {
                const e = findEntry(id, g, key);
                return <td key={id}><ValueBadge v={e.value}/></td>;
              })}
              <td></td>
            </tr>
            {isOpen && (
              <tr key={`${g}-${key}-exp`}>
                <td colSpan={order.length + 2}>
                  <div className="cite-expanded">
                    {order.map(id => {
                      const e = findEntry(id, g, key);
                      return (
                        <div key={id} className="cite-entry">
                          <strong>{id}</strong>
                          <div>
                            {e.citations.length === 0 && e.external_references.length === 0 && (
                              <em style={{color:'#6b7280'}}>No matching language in text.</em>
                            )}
                            {e.citations.map((c, i) => (
                              <div key={`c-${i}`}>
                                <a href={`#/license/${id}/text?s=${c.sentence_id}`} target="_blank" rel="noopener">&uarr; {c.sentence_id}</a>
                                {c.note && <span> &mdash; {c.note}</span>}
                              </div>
                            ))}
                            {e.external_references.map((r, i) => (
                              <div key={`e-${i}`}>
                                <a href={r.url} target="_blank" rel="noopener">&uarr; {r.source}</a>
                                {r.excerpt && <blockquote>&ldquo;{r.excerpt}&rdquo;</blockquote>}
                                {r.summary && !r.excerpt && <p style={{fontSize:'0.85rem'}}>{r.summary}</p>}
                              </div>
                            ))}
                            {e.commentary && <p className="commentary">{e.commentary}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            )}
          </>
        );
      })}
    </>
  );
}

function App() {
  const route = useRoute();
  if (route.name === 'detail')  return <DetailPage  id={route.id}/>;
  if (route.name === 'text')    return <TextPage    id={route.id}/>;
  if (route.name === 'compare') return <ComparePage ids={route.ids}/>;
  return <BrowsePage/>;
}

export default App;
