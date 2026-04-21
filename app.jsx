import { useState, useEffect } from "react";

function parseRoute(hash) {
  const h = (hash || '').replace(/^#/, '');
  if (!h || h === '/') return { name: 'browse' };
  if (h === '/about')    return { name: 'about' };
  if (h === '/glossary') return { name: 'glossary' };
  const m = h.match(/^\/license\/([a-z0-9][a-z0-9.-]*)(?:\/(text))?(\?.*)?$/);
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
  const toggleBool = (key) => setFilters({ ...filters, [key]: !filters[key] });
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
  const osiCount = catalog.filter(l => l.osi_approved).length;
  const fsfCount = catalog.filter(l => l.fsf_libre).length;
  return (
    <aside className="filter-panel">
      <Group title="Medium"    name="medium"    values={mediums}/>
      <Group title="Archetype" name="archetype" values={archetypes}/>
      <div className="filter-group">
        <div className="filter-h">Approval</div>
        <label className="filter-item">
          <span><input type="checkbox" checked={!!filters.osi_only} onChange={() => toggleBool('osi_only')}/> OSI approved</span>
          <span className="count">{osiCount}</span>
        </label>
        <label className="filter-item">
          <span><input type="checkbox" checked={!!filters.fsf_only} onChange={() => toggleBool('fsf_only')}/> FSF free software</span>
          <span className="count">{fsfCount}</span>
        </label>
      </div>
    </aside>
  );
}

function BrowsePage() {
  const { catalog, err } = useCatalog();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ medium: [], archetype: [], osi_only: false, fsf_only: false });
  const [set, setSet] = useState([]);
  const toggle = (id) => setSet(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  if (err) return <p style={{color:'#f87171'}}>Error: {err}</p>;
  if (!catalog) return <p>Loading...</p>;
  if (catalog.length === 0) return <p>No licenses yet. Add one via <code>/add-license</code>.</p>;

  const rows = catalog.filter(l => {
    if (filters.medium.length    && !filters.medium.includes(l.medium))       return false;
    if (filters.archetype.length && !filters.archetype.includes(l.archetype)) return false;
    if (filters.osi_only && !l.osi_approved) return false;
    if (filters.fsf_only && !l.fsf_libre)    return false;
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
          <thead><tr><th></th><th>Name</th><th>Archetype</th><th>Medium</th><th>Approvals</th><th>Tags</th></tr></thead>
          <tbody>
            {rows.map(l => (
              <tr key={l.id}>
                <td><input type="checkbox" checked={set.includes(l.id)} onChange={() => toggle(l.id)}/></td>
                <td><a href={`#/license/${l.id}`}>{l.name}</a></td>
                <td>{l.archetype}</td>
                <td>{l.medium}</td>
                <td>
                  {l.osi_approved && <span className="approval-badge approval-osi" title="OSI approved">OSI</span>}
                  {l.fsf_libre    && <span className="approval-badge approval-fsf" title="FSF free software">FSF</span>}
                </td>
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

  const ApprovalBadges = () => (
    <div className="approvals-row">
      {(meta.approvals || []).map((a, i) => (
        <a key={i} href={a.url} target="_blank" rel="noopener"
           className={`approval-badge ${a.approved ? `approval-${a.body.toLowerCase()}` : 'approval-denied'}`}
           title={a.note || (a.approved ? `${a.body} approved` : `${a.body} not approved`)}>
          {a.approved ? '' : 'not '}{a.body}
        </a>
      ))}
    </div>
  );

  return (
    <div>
      <p><a href="#/">&larr; All licenses</a></p>
      <h2>{meta.name}</h2>
      <p className="meta">{meta.medium} &middot; {meta.archetype}{meta.spdx && ` · SPDX: ${meta.spdx}`}</p>
      <ApprovalBadges/>
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
              <tr key={`${g}-${key}-exp`} className="cite-row">
                <td></td>
                {order.map(id => {
                  const e = findEntry(id, g, key);
                  const empty = e.citations.length === 0 && e.external_references.length === 0 && !e.commentary;
                  return (
                    <td key={id} className="cite-cell">
                      {empty && <em className="cite-empty">No matching language.</em>}
                      {e.citations.map((c, i) => (
                        <div key={`c-${i}`} className="cite-item">
                          <a href={`#/license/${id}/text?s=${c.sentence_id}`} target="_blank" rel="noopener">&uarr; {c.sentence_id}</a>
                          {c.note && <div className="cite-note">{c.note}</div>}
                        </div>
                      ))}
                      {e.external_references.map((r, i) => (
                        <div key={`e-${i}`} className="cite-item">
                          <a href={r.url} target="_blank" rel="noopener">&uarr; {r.source}</a>
                          {r.excerpt && <blockquote>&ldquo;{r.excerpt}&rdquo;</blockquote>}
                          {r.summary && !r.excerpt && <p className="cite-note">{r.summary}</p>}
                        </div>
                      ))}
                      {e.commentary && <p className="commentary">{e.commentary}</p>}
                    </td>
                  );
                })}
                <td></td>
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
  if (route.name === 'detail')   return <DetailPage   id={route.id}/>;
  if (route.name === 'text')     return <TextPage     id={route.id}/>;
  if (route.name === 'compare')  return <ComparePage  ids={route.ids}/>;
  if (route.name === 'about')    return <AboutPage/>;
  if (route.name === 'glossary') return <GlossaryPage/>;
  return <BrowsePage/>;
}

// ---------- About ----------
function AboutPage() {
  return (
    <article className="prose">
      <h2>About License Explorer</h2>
      <p>License Explorer is an interactive, evidence-backed guide to software and media licenses. For every license it catalogs, every claim in the comparison table is linked to the exact sentence in the license text that justifies it, and grey areas are surfaced rather than hidden.</p>

      <h3>Where the data comes from</h3>
      <p>Each license has its own directory under <code>licenses/&lt;id&gt;/</code> in the repository. Six files per license:</p>
      <ul>
        <li><code>text.raw.txt</code>: the canonical license text, byte-for-byte. Primary sources are SPDX's <a href="https://github.com/spdx/license-list-data" target="_blank" rel="noopener">license-list-data</a>, the <a href="https://opensource.org/licenses/" target="_blank" rel="noopener">Open Source Initiative</a>, <a href="https://www.gnu.org/licenses/license-list.html" target="_blank" rel="noopener">gnu.org</a>, and <a href="https://creativecommons.org" target="_blank" rel="noopener">creativecommons.org</a> depending on the license family.</li>
        <li><code>meta.json</code>: identity, SPDX id, archetype, the source URL with a <code>retrieved_at</code> timestamp, and a sha256 hash of the fetched text so a future refresh can detect drift.</li>
        <li><code>text.html</code>: a tokenized rendering where every sentence is wrapped as <code>&lt;span id="s-N"&gt;</code>. Sentence ids are stable across re-runs.</li>
        <li><code>features.json</code>: the feature table grouped into permissions, conditions, and limitations. Each entry cites one or more sentence ids in <code>text.html</code>.</li>
        <li><code>analysis.json</code> (optional): deep analysis from public sources like <a href="https://www.courtlistener.com" target="_blank" rel="noopener">CourtListener</a> court filings, FSF and Apache legal-discuss archives, and <a href="https://lu.is" target="_blank" rel="noopener">Luis Villa's</a> writing on open source law.</li>
        <li><code>.progress.json</code>: per-license pipeline state, so a failed ingestion run resumes rather than restarts.</li>
      </ul>

      <h3>Feature extraction and sentence linking</h3>
      <p>Claude-authored skills (<code>lookup-license</code>, <code>extract-features</code>, <code>deep-analysis</code>) read each license and populate its data files. Feature extraction walks a controlled vocabulary (see the <a href="#/glossary">Glossary</a>) and for each feature assigns one of six values: <strong>permitted</strong>, <strong>required</strong>, <strong>forbidden</strong>, <strong>silent</strong>, <strong>grey</strong>, or <strong>not_assessed</strong>. Every non-silent assignment is backed by a sentence id citation so you can verify the claim against the original text.</p>
      <p>Clicking any citation link in the comparison table opens the full license text in a new tab, scrolled to the cited sentence with a yellow highlight. The highlight is a CSS <code>:target</code> rule, so links are shareable: paste <code>#s-12</code> into any license's text URL and the sentence is foregrounded.</p>

      <h3>OSI and FSF approval</h3>
      <p>Each license's meta data records its status with two stewardship bodies: the <a href="https://opensource.org/licenses/" target="_blank" rel="noopener">Open Source Initiative</a> and the <a href="https://www.gnu.org/licenses/license-list.html" target="_blank" rel="noopener">Free Software Foundation</a>. OSI approval indicates the license is a recognized open-source license. FSF classifies licenses as "Free Software" (GPL-compatible or GPL-incompatible) or nonfree according to criteria that are generally stricter than OSI's. The two bodies can disagree: OSI has approved licenses the FSF considers nonfree, and vice versa. Both approvals appear as filterable badges on the browse page and as clickable citations on each detail page.</p>

      <h3>Court and legal analysis</h3>
      <p>Where public material exists, the <code>deep-analysis</code> skill collects court cases, enforcement history, and legal commentary and records them in <code>analysis.json</code>. Sources are restricted to publicly-accessible documents, including CourtListener / RECAP filings, publicly-archived legal mailing lists (FSF legal-discuss, Apache legal-discuss), open-access academic writing, and respected commentary like Luis Villa's blog. No paid databases, no private documents. Each analysis entry includes at least one source with a <code>retrieved_at</code> timestamp and either a verbatim excerpt or a paraphrased summary of what the source says.</p>

      <h3>Caveats</h3>
      <p>This is a research tool, not legal advice. Three specific classes of caveats:</p>
      <ul>
        <li><strong>Data freshness.</strong> The license text in this repository is a snapshot from the <code>retrieved_at</code> timestamp in each <code>meta.json</code>. If the canonical source changes (unusual for established licenses, common for CC license versions), the repository can go stale until refreshed. The sha256 checksum is stored so drift is detectable.</li>
        <li><strong>LLM-generated feature assignments.</strong> The skills that read license texts and assign feature values are driven by large language models. Most calls are unambiguous ("does section 4 require source disclosure?"), but some are judgment calls at the margin. A "grey" value plus commentary is the project's way of flagging this honestly; always read the cited sentences before acting on a comparison claim. If you find a mistake, please open an issue.</li>
        <li><strong>Legal interpretation varies by jurisdiction.</strong> Some questions genuinely have different answers in different courts. Where this is known, analysis entries note it. Where it is not known, treat the claim as a jumping-off point, not a holding.</li>
      </ul>

      <h3>Contributing</h3>
      <p>The data and the skills that build it are in a public repo: <a href="https://github.com/k1monfared/license_explorer" target="_blank" rel="noopener">github.com/k1monfared/license_explorer</a>. Pull requests that fix data errors, add licenses, or extend the feature vocabulary are welcome.</p>

      <p className="sponsor-cta">Like this work? <a href="https://k1monfared.github.io/sponsor.html" target="_blank" rel="noopener">Sponsor it here</a>.</p>
    </article>
  );
}

// ---------- Glossary ----------
const EXTRA_TERMS = [
  { key: 'permissive',      group: 'archetype', label: 'Permissive',       description: 'License family that imposes minimal conditions on downstream use (MIT, BSD, Apache). Commonly compatible with proprietary redistribution.' },
  { key: 'weak-copyleft',   group: 'archetype', label: 'Weak copyleft',    description: 'Derivative works must stay under the same license, but at a narrower scope (file-level for MPL, module-level for EPL, library-level for LGPL) so combined works can mix licenses.' },
  { key: 'strong-copyleft', group: 'archetype', label: 'Strong copyleft',  description: 'Derivative works must be released under the same license at the scope of the whole work (GPL, AGPL). AGPL extends the trigger to network interaction.' },
  { key: 'attribution',     group: 'archetype', label: 'Attribution',      description: 'License that permits broad use provided the original author is credited (CC-BY family).' },
  { key: 'share-alike',     group: 'archetype', label: 'Share-alike',      description: 'Derivative works must be licensed under the same license (CC-BY-SA). Creative-works analog to copyleft.' },
  { key: 'public-domain',   group: 'archetype', label: 'Public domain',    description: 'License that waives all rights (CC0, Unlicense, 0BSD). In jurisdictions where a pure dedication is not possible, a fallback license is provided.' },
  { key: 'osi',             group: 'body',      label: 'OSI approved',     description: 'Listed by the Open Source Initiative as meeting the Open Source Definition. A generally-accepted marker that a license is "open source".' },
  { key: 'fsf',             group: 'body',      label: 'FSF free software',description: 'Classified by the Free Software Foundation as a free-software license on gnu.org/licenses/license-list.html. FSF criteria are generally stricter than OSI.' },
  { key: 'spdx',            group: 'body',      label: 'SPDX',             description: 'Software Package Data Exchange — a standardized machine-readable registry of license identifiers. Used as canonical ids throughout this site.' }
];

const VALUE_TERMS = [
  { key: 'permitted',    label: 'permitted',    description: 'The license explicitly allows this action.' },
  { key: 'required',     label: 'required',     description: 'The license requires this of downstream users (a condition).' },
  { key: 'forbidden',    label: 'forbidden',    description: 'The license explicitly disclaims this or prohibits it (a limitation).' },
  { key: 'silent',       label: 'silent',       description: 'The license text does not address this directly. Any downstream behavior is governed by default copyright law or by other licenses.' },
  { key: 'grey',         label: 'grey area',    description: 'The license addresses this but with language that is ambiguous or contested. Citations and commentary explain the ambiguity.' },
  { key: 'not_assessed', label: 'not assessed', description: 'The feature exists in the vocabulary but has not yet been analyzed for this license. Contributions welcome.' }
];

function GlossaryPage() {
  const [vocab, setVocab] = useState(null);
  useEffect(() => {
    fetch('schemas/feature-vocabulary.json').then(r => r.json()).then(setVocab);
  }, []);
  if (!vocab) return <p>Loading...</p>;

  const groupRows = (group, rows) => (
    <>
      <tr><td colSpan={3} className="group-h">{group}</td></tr>
      {rows.map(r => (
        <tr key={`${group}-${r.key}`}>
          <td className="gloss-key">
            <div>{r.label || r.key}</div>
            <code className="gloss-code">{r.key}</code>
          </td>
          <td className="gloss-type">{r.type || ''}</td>
          <td>{r.description}</td>
        </tr>
      ))}
    </>
  );

  return (
    <article className="prose">
      <h2>Glossary</h2>
      <p>Every term used in the comparison table, explained.</p>

      <h3>Feature categories</h3>
      <p>Each row of the comparison table is one <em>feature</em>, drawn from a controlled vocabulary. Features are grouped as <strong>permissions</strong> (what you can do), <strong>conditions</strong> (what you must do in exchange), and <strong>limitations</strong> (what the license does not grant you).</p>

      <table className="glossary">
        <thead><tr><th>Term</th><th>Group</th><th>Meaning</th></tr></thead>
        <tbody>
          {groupRows('Permissions',   vocab.permissions.map(e  => ({ ...e, type: 'permission'  })))}
          {groupRows('Conditions',    vocab.conditions.map(e   => ({ ...e, type: 'condition'   })))}
          {groupRows('Limitations',   vocab.limitations.map(e  => ({ ...e, type: 'limitation'  })))}
        </tbody>
      </table>

      <h3>Cell values</h3>
      <p>Each cell in the comparison table shows one of six values that summarize how a particular license treats a particular feature.</p>
      <table className="glossary">
        <thead><tr><th>Value</th><th></th><th>Meaning</th></tr></thead>
        <tbody>
          {VALUE_TERMS.map(v => (
            <tr key={v.key}>
              <td><ValueBadge v={v.key}/></td>
              <td className="gloss-type">{v.key}</td>
              <td>{v.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>License archetypes and stewardship bodies</h3>
      <table className="glossary">
        <thead><tr><th>Term</th><th>Kind</th><th>Meaning</th></tr></thead>
        <tbody>
          {groupRows('Archetypes',           EXTRA_TERMS.filter(t => t.group === 'archetype').map(t => ({ ...t, type: t.group })))}
          {groupRows('Stewardship bodies',   EXTRA_TERMS.filter(t => t.group === 'body').map(t => ({ ...t, type: t.group })))}
        </tbody>
      </table>

      <p className="subtle">See <a href="#/about">About</a> for how these values are assigned and where the source data comes from.</p>
    </article>
  );
}

export default App;
