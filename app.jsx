import { useState, useEffect } from "react";

// Inline SVG icons, mirroring site_kit/icons/ (same style: 18x18, currentColor,
// stroke-width 2, rounded caps + joins). Also published in site_kit/js/icons.js.
const ICONS = {
  'sidebar-open':  'M3 4h18a2 2 0 012 2v12a2 2 0 01-2 2H3a2 2 0 01-2-2V6a2 2 0 012-2z M9 4v16 M13 10l3 2-3 2',
  'sidebar-close': 'M3 4h18a2 2 0 012 2v12a2 2 0 01-2 2H3a2 2 0 01-2-2V6a2 2 0 012-2z M9 4v16 M16 10l-3 2 3 2',
  'menu':          'M3 6h18 M3 12h18 M3 18h18',
  'x':             'M18 6L6 18 M6 6l12 12'
};
function Icon({ name, size = 18 }) {
  // Split the compound path on " M " to allow multiple subpaths.
  const d = ICONS[name];
  if (!d) return null;
  if (name === 'sidebar-open' || name === 'sidebar-close') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2"/>
        <line x1="9" y1="4" x2="9" y2="20"/>
        {name === 'sidebar-open'
          ? <polyline points="13 10 16 12 13 14"/>
          : <polyline points="16 10 13 12 16 14"/>}
      </svg>
    );
  }
  if (name === 'menu') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    );
  }
  if (name === 'x') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    );
  }
  return null;
}

function parseRoute(hash) {
  const h = (hash || '').replace(/^#/, '');
  if (!h || h === '/') return { name: 'browse' };
  if (h === '/about')    return { name: 'about' };
  if (h === '/glossary') return { name: 'glossary' };
  if (h === '/roadmap')  return { name: 'roadmap' };
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

const NOCACHE = { cache: 'no-cache' };

const FSF_STANCE_LABEL = {
  'endorsed':     'Endorsed (free, GPL-compatible)',
  'accepted':     'Accepted (free, GPL-incompatible or with reservations)',
  'non-software': 'Approved for non-software works (media, docs, fonts)',
  'discouraged':  'Free but FSF recommends against',
  'nonfree':      'Not a free-software license per FSF',
  'unclassified': 'Not listed on FSF\'s license page'
};
const FSF_STANCE_SHORT = {
  'endorsed':     '✓',
  'accepted':     '~',
  'non-software': 'media',
  'discouraged':  '!',
  'nonfree':      '✗',
  'unclassified': '?'
};

function useCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    fetch('licenses/index.json', NOCACHE)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(setCatalog).catch(e => setErr(String(e)));
  }, []);
  return { catalog, err };
}

function useFeatureIndex() {
  const [index, setIndex] = useState(null);
  const [vocab, setVocab] = useState(null);
  const [analysisIndex, setAnalysisIndex] = useState(null);
  useEffect(() => {
    fetch('licenses/feature-index.json', NOCACHE).then(r => r.ok ? r.json() : {}).then(setIndex).catch(() => setIndex({}));
    fetch('schemas/feature-vocabulary.json', NOCACHE).then(r => r.ok ? r.json() : null).then(setVocab).catch(() => setVocab(null));
    fetch('licenses/analysis-index.json', NOCACHE).then(r => r.ok ? r.json() : {}).then(setAnalysisIndex).catch(() => setAnalysisIndex({}));
  }, []);
  return { index, vocab, analysisIndex };
}

const FEATURE_VALUES = ['permitted', 'required', 'forbidden', 'silent', 'grey', 'not_assessed'];

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
function FeatureFilterSection({ featureKey, label, vocabDesc, catalog, featureIndex, filters, setFilters }) {
  const [open, setOpen] = useState(false);
  const selected = (filters.features && filters.features[featureKey]) || [];
  const toggle = (v) => {
    const cur = new Set(selected);
    cur.has(v) ? cur.delete(v) : cur.add(v);
    const next = { ...(filters.features || {}) };
    if (cur.size === 0) delete next[featureKey]; else next[featureKey] = [...cur];
    setFilters({ ...filters, features: next });
  };
  const clear = (e) => {
    e.stopPropagation();
    const next = { ...(filters.features || {}) };
    delete next[featureKey];
    setFilters({ ...filters, features: next });
  };
  const valueCount = (v) => {
    if (!featureIndex) return 0;
    let n = 0;
    for (const l of catalog) {
      const iv = featureIndex[l.id]?.[featureKey];
      if (v === 'not_assessed' ? !iv : iv === v) n++;
    }
    return n;
  };
  const activeCount = selected.length;
  return (
    <div className={`feat-section ${activeCount > 0 ? 'active' : ''}`}>
      <button type="button" className="feat-section-head" onClick={() => setOpen(o => !o)} title={vocabDesc}>
        <span className="feat-section-label">
          {label}
          {activeCount > 0 && <span className="feat-active-badge">{activeCount}</span>}
        </span>
        <span className="feat-section-right">
          {activeCount > 0 && <span className="feat-clear" onClick={clear}>clear</span>}
          <span className="feat-chevron">{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open && (
        <div className="feat-section-body">
          {FEATURE_VALUES.map(v => {
            const on = selected.includes(v);
            const count = valueCount(v);
            const disabled = count === 0 && !on;
            return (
              <label key={v} className={`feat-value-row ${on ? 'on' : ''} ${disabled ? 'disabled' : ''}`}>
                <input type="checkbox" checked={on} disabled={disabled} onChange={() => !disabled && toggle(v)}/>
                <ValueBadge v={v}/>
                <span className="feat-value-count">{count}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterSidebar({ catalog, featureIndex, vocab, filters, setFilters }) {
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
  const fsfStanceCounts = {};
  for (const l of catalog) if (l.fsf_stance) fsfStanceCounts[l.fsf_stance] = (fsfStanceCounts[l.fsf_stance] || 0) + 1;
  const totalFeatureFilters = filters.features ? Object.values(filters.features).reduce((n, arr) => n + arr.length, 0) : 0;
  const clearAllFeatures = () => setFilters({ ...filters, features: {} });
  return (
    <aside className="filter-panel">
      <Group title="Medium"    name="medium"    values={mediums}/>
      <Group title="Archetype" name="archetype" values={archetypes}/>
      <div className="filter-group">
        <div className="filter-h">OSI</div>
        <label className="filter-item">
          <span><input type="checkbox" checked={!!filters.osi_only} onChange={() => toggleBool('osi_only')}/> OSI approved</span>
          <span className="count">{osiCount}</span>
        </label>
      </div>
      <div className="filter-group">
        <div className="filter-h">FSF stance</div>
        {Object.keys(FSF_STANCE_LABEL).map(s => {
          const count = fsfStanceCounts[s] || 0;
          if (count === 0) return null;
          const on = (filters.fsf_stance || []).includes(s);
          return (
            <label key={s} className="filter-item" title={FSF_STANCE_LABEL[s]}>
              <span><input type="checkbox" checked={on} onChange={() => toggleSet('fsf_stance', s)}/> {s.replace('-', ' ')}</span>
              <span className="count">{count}</span>
            </label>
          );
        })}
      </div>
      {vocab && featureIndex && (
        <div className="filter-group feat-filters">
          <div className="filter-h feat-filters-h">
            <span>Features{totalFeatureFilters > 0 && <span className="feat-active-badge">{totalFeatureFilters}</span>}</span>
            {totalFeatureFilters > 0 && <span className="feat-clear" onClick={clearAllFeatures}>clear all</span>}
          </div>
          {['permissions', 'conditions', 'limitations'].map(group => (
            <div key={group} className="feat-group">
              <div className="feat-group-h">{group}</div>
              {vocab[group].map(entry => (
                <FeatureFilterSection
                  key={entry.key}
                  featureKey={entry.key}
                  label={entry.label}
                  vocabDesc={entry.description}
                  catalog={catalog}
                  featureIndex={featureIndex}
                  filters={filters}
                  setFilters={setFilters}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function BrowsePage() {
  const { catalog, err } = useCatalog();
  const { index: featureIndex, vocab, analysisIndex } = useFeatureIndex();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ medium: [], archetype: [], osi_only: false, fsf_stance: [], features: {} });
  const [set, setSet] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 860px)').matches);
  const toggle = (id) => setSet(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  if (err) return <p style={{color:'#f87171'}}>Error: {err}</p>;
  if (!catalog) return <p>Loading...</p>;
  if (catalog.length === 0) return <p>No licenses yet. Add one via <code>/add-license</code>.</p>;

  const rows = catalog.filter(l => {
    if (filters.medium.length    && !filters.medium.includes(l.medium))       return false;
    if (filters.archetype.length && !filters.archetype.includes(l.archetype)) return false;
    if (filters.osi_only && !l.osi_approved) return false;
    if (filters.fsf_stance && filters.fsf_stance.length > 0 && !filters.fsf_stance.includes(l.fsf_stance)) return false;
    if (filters.features && featureIndex) {
      for (const [key, allowed] of Object.entries(filters.features)) {
        if (!allowed.length) continue;
        const val = featureIndex[l.id]?.[key] || 'not_assessed';
        if (!allowed.includes(val)) return false;
      }
    }
    if (q) {
      const needle = q.toLowerCase();
      return l.name.toLowerCase().includes(needle)
          || l.blurb.toLowerCase().includes(needle)
          || l.tags.some(t => t.toLowerCase().includes(needle));
    }
    return true;
  });

  return (
    <div className={`browse ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {sidebarOpen && <FilterSidebar catalog={catalog} featureIndex={featureIndex} vocab={vocab} filters={filters} setFilters={setFilters}/>}
      <div className="browse-main">
        <div className="browse-toolbar">
          <button
            type="button"
            className="icon-btn"
            aria-label={sidebarOpen ? 'Hide filter sidebar' : 'Show filter sidebar'}
            title={sidebarOpen ? 'Hide filters' : 'Show filters'}
            onClick={() => setSidebarOpen(v => !v)}
          >
            <Icon name={sidebarOpen ? 'sidebar-close' : 'sidebar-open'}/>
          </button>
          <input className="search" placeholder="Search licenses, features, keywords..."
                 value={q} onChange={e => setQ(e.target.value)}/>
        </div>
        <div className="table-scroll">
          <table className="brz">
            <thead><tr><th></th><th>Name</th><th>Archetype</th><th>Medium</th><th>Approvals</th><th>Tags</th></tr></thead>
            <tbody>
              {rows.map(l => {
                const topics = analysisIndex?.[l.id]?.topics || 0;
                return (
                  <tr key={l.id}>
                    <td><input type="checkbox" checked={set.includes(l.id)} onChange={() => toggle(l.id)}/></td>
                    <td className="brz-name">
                      <a href={`#/license/${l.id}`}>{l.name}</a>
                      {topics > 0 && (
                        <a href={`#/license/${l.id}#analysis`} className="analysis-badge" title={`${topics} deep-analysis topic${topics === 1 ? '' : 's'}`}>
                          ¶ {topics}
                        </a>
                      )}
                    </td>
                    <td className="brz-arch">{l.archetype}</td>
                    <td className="brz-med">{l.medium}</td>
                    <td className="brz-approvals">
                      {l.osi_approved && <span className="approval-badge approval-osi" title="OSI approved">OSI</span>}
                      {l.fsf_libre    && <span className="approval-badge approval-fsf" title="FSF free software">FSF</span>}
                    </td>
                    <td className="brz-tags">{l.tags.join(', ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
      fetch(`licenses/${id}/meta.json`, NOCACHE).then(r => r.ok ? r.json() : Promise.reject(`meta ${r.status}`)),
      fetch(`licenses/${id}/features.json`, NOCACHE).then(r => r.ok ? r.json() : Promise.reject(`features ${r.status}`))
    ]).then(([m, f]) => { setMeta(m); setFeats(f); }).catch(e => setErr(String(e)));
    fetch(`licenses/${id}/analysis.json`, NOCACHE).then(r => r.ok ? r.json() : null).then(setAnalysis).catch(() => setAnalysis(null));
  }, [id]);

  // If URL has #analysis anchor, scroll to it after render.
  useEffect(() => {
    if (!analysis) return;
    const h = location.hash;
    const m = h.match(/#analysis(?:-([a-z0-9-]+))?$/);
    if (m) {
      setTimeout(() => {
        const target = m[1] ? document.getElementById(`analysis-${m[1]}`) : document.getElementById('analysis');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }, [analysis]);

  const analysisByTopic = (() => {
    const m = {};
    if (analysis?.entries) for (const e of analysis.entries) m[e.topic] = e;
    return m;
  })();

  if (err) return <p style={{color:'#f87171'}}>Error: {err}</p>;
  if (!meta || !feats) return <p>Loading...</p>;

  const Row = ({ e }) => {
    const analysisEntry = analysisByTopic[e.key];
    return (
      <tr>
        <td className="feat-label">
          {e.key}
          {analysisEntry && (
            <a href={`#/license/${id}#analysis-${e.key}`} className="feat-analysis-link" title="Jump to deep analysis for this feature">&para;</a>
          )}
        </td>
        <td><ValueBadge v={e.value}/></td>
        <td>{e.citations.map((c, i) => (
          <a key={i} href={`#/license/${id}/text?s=${c.sentence_id}`} title={c.note || ''} style={{marginRight:'0.4rem'}}>{c.sentence_id}</a>
        ))}</td>
        <td className="feat-commentary">{e.commentary || ''}</td>
      </tr>
    );
  };

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
      {(meta.approvals || []).map((a, i) => {
        const isFsf = a.body === 'FSF';
        const cls = isFsf && a.stance
          ? `approval-badge approval-fsf-${a.stance}`
          : `approval-badge ${a.approved ? `approval-${a.body.toLowerCase()}` : 'approval-denied'}`;
        const label = isFsf && a.stance
          ? `FSF: ${a.stance.replace('-', ' ')}`
          : `${a.approved ? '' : 'not '}${a.body}`;
        const tooltip = isFsf && a.stance
          ? `${FSF_STANCE_LABEL[a.stance]}${a.note ? ' — ' + a.note : ''}`
          : (a.note || (a.approved ? `${a.body} approved` : `${a.body} not approved`));
        return (
          <a key={i} href={a.url} target="_blank" rel="noopener" className={cls} title={tooltip}>
            {label}
          </a>
        );
      })}
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
          <h3 id="analysis">Deep analysis <span className="analysis-count">{analysis.entries.length} topic{analysis.entries.length === 1 ? '' : 's'}</span></h3>
          {analysis.entries.map((e, i) => (
            <section key={i} className="analysis-entry" id={`analysis-${e.topic}`}>
              <h4><code>{e.topic}</code></h4>
              <p>{e.summary}</p>
              <ul>{e.sources.map((s, j) => (
                <li key={j}>
                  <a href={s.url} target="_blank" rel="noopener">{s.source}</a>
                  {s.archive_path && (
                    <>
                      {' · '}
                      <a href={s.archive_path} target="_blank" rel="noopener" className="archive-link" title={`Archived ${s.retrieved_at} (sha256: ${s.archive_sha256?.slice(0,12)}…)`}>archived copy</a>
                    </>
                  )}
                  {s.excerpt && <blockquote>&ldquo;{s.excerpt}&rdquo;</blockquote>}
                  {s.summary && !s.excerpt && <p className="source-summary">{s.summary}</p>}
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
// Fixed per-note height; used for collision-avoidance layout. Keep in sync
// with .margin-note / .margin-group CSS.
const MARGIN_NOTE_HEIGHT = 30;
const MARGIN_GROUP_GAP = 6;
const MARGIN_NOTE_GAP = 4;

function TextPage({ id }) {
  const [html, setHtml]   = useState(null);
  const [feats, setFeats] = useState(null);
  const [err, setErr]     = useState(null);
  const [placements, setPlacements] = useState([]);
  const [activeSentId, setActiveSentId] = useState(null);
  const spacerElsRef = { current: null };

  useEffect(() => {
    fetch(`licenses/${id}/text.html`, NOCACHE)
      .then(r => r.ok ? r.text() : Promise.reject(`HTTP ${r.status}`))
      .then(setHtml).catch(e => setErr(String(e)));
    fetch(`licenses/${id}/features.json`, NOCACHE)
      .then(r => r.ok ? r.json() : null).then(setFeats).catch(() => setFeats(null));
  }, [id]);

  // Track the ?s=s-N anchor in the URL hash so clicking a citation or a
  // margin note highlights both the sentence and its margin note.
  useEffect(() => {
    const update = () => {
      const m = location.hash.match(/[?&]s=(s-\d+)/);
      setActiveSentId(m ? m[1] : null);
    };
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  // Scroll to the active sentence + pulse it
  useEffect(() => {
    if (!html || !activeSentId) return;
    const t = setTimeout(() => {
      const el = document.getElementById(activeSentId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Restart the pulse animation by removing and re-adding the class.
        el.classList.remove('pulse');
        void el.offsetWidth;
        el.classList.add('pulse');
      }
    }, 60);
    return () => clearTimeout(t);
  }, [html, activeSentId]);

  // Build sentence-id → [{featureKey, value, group}, ...] from features.json
  const annotations = (() => {
    if (!feats) return {};
    const map = {};
    for (const group of ['permissions', 'conditions', 'limitations']) {
      for (const entry of feats[group] || []) {
        for (const cite of entry.citations || []) {
          (map[cite.sentence_id] ||= []).push({ featureKey: entry.key, value: entry.value, group });
        }
      }
    }
    return map;
  })();

  // After render: measure sentence positions; if stacking the margin groups
  // one-after-another would overlap neighbors, push the later sentence down
  // by inserting a spacer element before it in the DOM.
  useEffect(() => {
    if (!html || !feats) return;
    const measure = () => {
      const container = document.querySelector('.text-viewer');
      if (!container) return;

      // Clean up any previously-inserted spacers so a resize/re-layout
      // starts from the natural text positions, not a cascaded offset.
      container.querySelectorAll('.text-spacer').forEach(s => s.remove());

      const contTop = container.getBoundingClientRect().top;
      const groups = [];
      for (const [sentId, anns] of Object.entries(annotations)) {
        const el = document.getElementById(sentId);
        if (!el) continue;
        groups.push({ sentId, el, top: el.getBoundingClientRect().top - contTop, annotations: anns });
      }
      groups.sort((a, b) => a.top - b.top);

      const groupHeight = (g) => g.annotations.length * MARGIN_NOTE_HEIGHT + (g.annotations.length - 1) * MARGIN_NOTE_GAP;

      // Walk groups in order; if the next group's natural top is above
      // (previous.top + previous.height + gap), push it down by inserting
      // a block-level spacer in the text before that sentence. All later
      // sentences pick up the cumulative offset automatically via the
      // natural reflow.
      let offset = 0;
      for (const g of groups) {
        const natural = g.top + offset;
        const lowerBound = groups.indexOf(g) === 0 ? natural : (groups[groups.indexOf(g) - 1].top + groupHeight(groups[groups.indexOf(g) - 1]) + MARGIN_GROUP_GAP);
        const required = Math.max(natural, lowerBound);
        const extra = required - natural;
        if (extra > 0 && g.el && g.el.parentNode) {
          const spacer = document.createElement('span');
          spacer.className = 'text-spacer';
          spacer.style.display = 'block';
          spacer.style.height = extra + 'px';
          g.el.parentNode.insertBefore(spacer, g.el);
          offset += extra;
        }
        g.top = required;
      }

      setPlacements(groups.map(({ sentId, top, annotations }) => ({ sentId, top, annotations })));
    };
    // Run in a microtask so the newly-rendered <article> is in the DOM.
    const t = setTimeout(measure, 0);
    const ro = new ResizeObserver(() => { setTimeout(measure, 0); });
    const container = document.querySelector('.text-viewer');
    if (container) ro.observe(container);
    window.addEventListener('resize', () => { setTimeout(measure, 0); });
    return () => {
      clearTimeout(t);
      ro.disconnect();
      // Clean up spacers on unmount so SPA route changes don't leave them behind.
      if (container) container.querySelectorAll('.text-spacer').forEach(s => s.remove());
    };
  }, [html, feats]);

  const highlightSentence = (sentId) => {
    location.hash = `#/license/${id}/text?s=${sentId}`;
  };

  if (err) return <p style={{color:'#f87171'}}>Error: {err}</p>;
  if (!html) return <p>Loading...</p>;

  return (
    <div>
      <p><a href={`#/license/${id}`}>&larr; Back to {id}</a></p>
      <div className={`text-viewer ${feats ? 'has-margins' : ''}`}>
        <article className="license-text" dangerouslySetInnerHTML={{ __html: html }}/>
        {feats && (
          <aside className="text-margin">
            {placements.map(p => (
              <div key={p.sentId} className={`margin-group ${activeSentId === p.sentId ? 'active' : ''}`} style={{top: `${p.top}px`}}>
                {p.annotations.map((ann, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`margin-note margin-note-${ann.value}`}
                    onClick={() => highlightSentence(p.sentId)}
                    title={`${ann.featureKey}: ${ann.value} — click to highlight the sentence`}
                  >
                    <span className="margin-note-key">{ann.featureKey}</span>
                    <ValueBadge v={ann.value}/>
                  </button>
                ))}
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}

// ---------- Compare ----------
function ComparePage({ ids }) {
  const [catalog, setCatalog] = useState(null);
  const [data, setData]       = useState({});
  const [order, setOrder]     = useState(ids);
  const [expanded, setExpanded] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Keep order in sync with URL ids (for back button, shared links).
  useEffect(() => { setOrder(ids); }, [ids.join(',')]);

  useEffect(() => {
    fetch('licenses/index.json', NOCACHE).then(r => r.json()).then(setCatalog).catch(() => {});
  }, []);

  // Fetch whatever's missing whenever order changes.
  useEffect(() => {
    const missing = order.filter(id => !data[id]);
    if (missing.length === 0) return;
    Promise.all(missing.map(id =>
      Promise.all([
        fetch(`licenses/${id}/meta.json`, NOCACHE).then(r => r.json()),
        fetch(`licenses/${id}/features.json`, NOCACHE).then(r => r.json())
      ]).then(([meta, feat]) => [id, { meta, feat }])
       .catch(() => [id, null])
    )).then(results => {
      setData(d => { const next = { ...d }; for (const [id, v] of results) if (v) next[id] = v; return next; });
    });
  }, [order.join(',')]);

  // Update order AND URL at the same time so the UI re-renders immediately
  // (not waiting for the hashchange round-trip).
  const updateSet = (next) => {
    setOrder(next);
    location.hash = '#/compare?set=' + next.join(',');
  };
  const removeCol = (id)       => updateSet(order.filter(x => x !== id));
  const addCol    = (id)       => { if (!order.includes(id)) updateSet([...order, id]); };
  const moveCol   = (from, to) => {
    if (from === to || from == null || to == null) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    const target = to > from ? to - 1 : to;
    next.splice(target, 0, x);
    updateSet(next);
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
    const placeholder = { key, value: 'not_assessed', citations: [], external_references: [] };
    const f = data[id]?.feat;
    if (!f) return placeholder;
    return f[g].find(e => e.key === key) || placeholder;
  };

  const toggleExpand = (g, key) => setExpanded(x => ({ ...x, [`${g}:${key}`]: !x[`${g}:${key}`] }));
  const available = catalog.filter(c => !order.includes(c.id));

  return (
    <div>
      <p><a href="#/">&larr; All licenses</a></p>
      <h2>Compare</h2>
      <div className="cmp-table-scroll">
      <table className="cmp-table">
        <thead>
          <tr>
            <th className="cmp-row-label"></th>
            {order.map((id, i) => (
              <th key={id}
                  className={`cmp-col-head ${dragOverIdx === i ? 'drop-before' : ''}`}
                  draggable
                  onDragStart={e => e.dataTransfer.setData('from', String(i))}
                  onDragOver={e => { e.preventDefault(); if (dragOverIdx !== i) setDragOverIdx(i); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverIdx(v => v === i ? null : v); }}
                  onDragEnd={() => setDragOverIdx(null)}
                  onDrop={e => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData('from'));
                    moveCol(from, dragOverIdx != null ? dragOverIdx : i);
                    setDragOverIdx(null);
                  }}>
                <div className="cmp-col-inner">
                  <span className="drag-handle" aria-hidden="true">&equiv;</span>
                  <a href={`#/license/${id}`} className="cmp-col-name">{data[id]?.meta?.name || id}</a>
                  <button type="button" className="col-close" onClick={() => removeCol(id)} aria-label={`remove ${id}`}>&times;</button>
                </div>
              </th>
            ))}
            <th className="cmp-add-col"
                onDragOver={e => { e.preventDefault(); if (dragOverIdx !== order.length) setDragOverIdx(order.length); }}
                onDrop={e => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData('from'));
                  moveCol(from, order.length);
                  setDragOverIdx(null);
                }}>
              {available.length > 0 && !addOpen && (
                <button type="button" className="cmp-add-btn" onClick={() => setAddOpen(true)} title="Add license to comparison" aria-label="Add license">+</button>
              )}
              {addOpen && (
                <AddColumnPicker
                  available={available}
                  onAdd={(id) => { addCol(id); setAddOpen(false); }}
                  onCancel={() => setAddOpen(false)}
                />
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
    </div>
  );
}

// ---------- Roadmap ----------
function RoadmapPage() {
  const [roadmap, setRoadmap] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    fetch('docs/roadmap.json', NOCACHE).then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)).then(setRoadmap).catch(e => setErr(String(e)));
  }, []);
  if (err) return <p style={{color:'#f87171'}}>Error: {err}</p>;
  if (!roadmap) return <p>Loading...</p>;

  const CATEGORY_LABEL = {
    'data': 'Data licenses',
    'older-cc': 'Older Creative Commons versions',
    'older-docs': 'Older GNU Free Documentation License versions',
    'government': 'Government licenses',
    'fonts': 'Font licenses',
    'software': 'Software licenses',
    'hardware': 'Hardware licenses',
    'other': 'Other'
  };
  const groups = {};
  for (const p of roadmap.planned) {
    const cat = p.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  }
  const orderedCats = ['data', 'older-cc', 'older-docs', 'government', 'fonts', 'software', 'hardware', 'other'];

  return (
    <article className="prose">
      <h2>Roadmap <span className="roadmap-count">{roadmap.planned.length} planned</span></h2>
      <p>{roadmap.description}</p>
      <p className="subtle">When a planned license is added to the catalog, it automatically drops off this list.</p>

      {roadmap.planned.length === 0 ? (
        <p><em>No licenses currently planned. Everything on the roadmap has been added.</em></p>
      ) : orderedCats.filter(c => groups[c]).map(cat => (
        <section key={cat}>
          <h3>{CATEGORY_LABEL[cat] || cat} <span className="roadmap-group-count">{groups[cat].length}</span></h3>
          <table className="glossary">
            <thead>
              <tr><th>License</th><th>Medium / archetype</th><th>Why add it</th></tr>
            </thead>
            <tbody>
              {groups[cat].map(p => (
                <tr key={p.id}>
                  <td className="gloss-key">
                    <div>{p.name}</div>
                    <code className="gloss-code">{p.spdx || p.id}</code>
                  </td>
                  <td className="gloss-type">{p.medium} · {p.archetype}</td>
                  <td className="gloss-meaning">{p.rationale || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <p className="subtle">Want something added? Edit <code>docs/roadmap.json</code> on GitHub and open a PR. To add one of these yourself, run <code>/add-license &lt;spdx-id&gt;</code> with Claude Code — see <a href="#/about">About</a>.</p>
    </article>
  );
}

function AddColumnPicker({ available, onAdd, onCancel }) {
  const [q, setQ] = useState('');
  const [highlight, setHighlight] = useState(0);
  const filtered = available.filter(l => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return l.name.toLowerCase().includes(needle)
        || l.id.toLowerCase().includes(needle)
        || (l.spdx && l.spdx.toLowerCase().includes(needle))
        || (l.tags || []).some(t => t.toLowerCase().includes(needle));
  });
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    const onDocClick = (e) => { if (!e.target.closest('.add-picker')) onCancel(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [onCancel]);
  return (
    <div
      className="add-picker"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <input
        autoFocus
        className="add-picker-input"
        value={q}
        placeholder="Search licenses..."
        onChange={e => { setQ(e.target.value); setHighlight(0); }}
        onKeyDown={e => {
          if (e.key === 'Enter' && filtered[highlight]) onAdd(filtered[highlight].id);
          else if (e.key === 'ArrowDown') { setHighlight(h => Math.min(h + 1, filtered.length - 1)); e.preventDefault(); }
          else if (e.key === 'ArrowUp')   { setHighlight(h => Math.max(h - 1, 0)); e.preventDefault(); }
        }}
      />
      <ul className="add-picker-list">
        {filtered.length === 0 && <li className="add-picker-empty">No matches</li>}
        {filtered.map((l, i) => (
          <li
            key={l.id}
            className={i === highlight ? 'hl' : ''}
            onMouseEnter={() => setHighlight(i)}
            onMouseDown={() => onAdd(l.id)}
          >
            <span className="add-picker-name">{l.name}</span>
            <span className="add-picker-spdx">{l.spdx || l.id}</span>
          </li>
        ))}
      </ul>
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
  if (route.name === 'roadmap')  return <RoadmapPage/>;
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
      <p>Each license's meta data records its status with two stewardship bodies: the <a href="https://opensource.org/licenses/" target="_blank" rel="noopener">Open Source Initiative</a> and the <a href="https://www.gnu.org/licenses/license-list.html" target="_blank" rel="noopener">Free Software Foundation</a>. OSI approval is a single boolean: either a license is listed on OSI's approved-licenses page, or it isn't.</p>

      <p>FSF's stance is not a boolean. Their license page distinguishes several categories and, even within "free software", often warns or recommends against specific licenses. Merely appearing on FSF's list is not an endorsement. This catalog captures that nuance with a <code>stance</code> field on every FSF approval, taking one of six values:</p>

      <table className="glossary">
        <thead><tr><th>Stance</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr><td className="gloss-key"><code>endorsed</code></td><td className="gloss-meaning">Free software license that FSF endorses, GPL-compatible. FSF's default "yes, use this" — the GPL family itself, Apache 2.0, MIT (Expat), BSD-2/3, MPL-2.0 with secondary-license mechanism, etc.</td></tr>
          <tr><td className="gloss-key"><code>accepted</code></td><td className="gloss-meaning">Free software, but either GPL-INCOMPATIBLE (FSF notes you should probably pick something else for interop) or accepted-with-reservations (e.g. CC0 because of its explicit patent non-grant). EPL-1.0, CDDL, Ms-PL, Ms-RL, EUPL-1.2 live here.</td></tr>
          <tr><td className="gloss-key"><code>non-software</code></td><td className="gloss-meaning">Free license that FSF endorses for non-software works (documentation, fonts, creative media) but NOT for software. GFDL, OFL, CC-BY-4.0, CC-BY-SA-4.0 belong here.</td></tr>
          <tr><td className="gloss-key"><code>discouraged</code></td><td className="gloss-meaning">Technically free, but FSF explicitly recommends AGAINST using it. WTFPL is the canonical example — FSF notes its lack of a warranty disclaimer makes it legally risky for licensors. Appearing on FSF's list is not an endorsement here.</td></tr>
          <tr><td className="gloss-key"><code>nonfree</code></td><td className="gloss-meaning">FSF does not consider this a free-software license. The original 4-clause BSD (advertising clause), every CC-BY-NC or CC-BY-ND variant for practical-use works, and the source-available licenses like BUSL, Elastic-2.0, SSPL, PolyForm-NC fall here.</td></tr>
          <tr><td className="gloss-key"><code>unclassified</code></td><td className="gloss-meaning">Not listed on FSF's license page. Hardware licenses (CERN-OHL variants, TAPR-OHL) and some newer licenses FSF hasn't taken a position on.</td></tr>
        </tbody>
      </table>

      <p>Each license's Detail page links directly to the FSF list entry used to derive the stance, with the exact wording from FSF as the <code>note</code> field so readers can see how we interpreted FSF's text. The browse page lets you filter by stance — if you specifically need "endorsed software licenses", that's one checkbox.</p>

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

      <CostEstimate/>

      <p className="sponsor-cta">Like this work? <a href="https://k1monfared.github.io/sponsor.html" target="_blank" rel="noopener">Sponsor it here</a>.</p>
    </article>
  );
}

function CostEstimate() {
  const [cost, setCost] = useState(null);
  useEffect(() => {
    fetch('licenses/cost-estimate.json', NOCACHE).then(r => r.ok ? r.json() : null).then(setCost).catch(() => {});
  }, []);
  if (!cost) return null;
  const fmt = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const basisSentence = cost.mode === 'average' ? (
    <>
      Averaged across {cost.analyzed_count} licenses that currently have deep-analysis
      runs ({cost.sample_details.map((s, i) => <span key={s.license_id}>{i > 0 ? ', ' : ''}<code>{s.license_id}</code></span>)}),
      a rough per-license cost at current <code>{cost.pricing_model}</code> list prices
      (${cost.price_input_per_mtok}/M input, ${cost.price_output_per_mtok}/M output)
      works out to about <strong>{fmt(cost.avg_cost_per_license_usd)}</strong>.
    </>
  ) : (
    <>
      Using <code>{cost.sample_details[0].license_id}</code> as the sole benchmark
      (the only license with a deep-analysis run so far), a rough per-license cost
      at current <code>{cost.pricing_model}</code> list prices
      (${cost.price_input_per_mtok}/M input, ${cost.price_output_per_mtok}/M output)
      works out to about <strong>{fmt(cost.avg_cost_per_license_usd)}</strong>.
    </>
  );
  return (
    <>
      <h3>What this costs to build</h3>
      <p>
        This catalog is populated by LLM-driven research runs against public sources.
        {' '}{basisSentence}{' '}
        Across {cost.licenses_count} licenses that's roughly{' '}
        <strong>{fmt(cost.total_cost_usd)}</strong> in total.
      </p>
      <p className="subtle">
        Order-of-magnitude estimate, not an exact bill. Computed from the repo's own
        byte counts: archived sources as input proxy, generated artifacts as output
        proxy, with a 2× multiplier on input to account for prompting and multi-turn
        overhead. The estimate updates automatically when licenses are added or
        analyzed — {cost.mode === 'benchmark'
          ? 'as soon as a second license is analyzed, this figure will switch from a single-license benchmark to a true average.'
          : 'adding more analyzed licenses will refine the mean further.'}
      </p>
    </>
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
    fetch('schemas/feature-vocabulary.json', NOCACHE).then(r => r.json()).then(setVocab);
  }, []);
  if (!vocab) return <p>Loading...</p>;

  const groupRows = (group, description, rows) => (
    <>
      <tr>
        <td colSpan={3} className="group-h">
          <span className="group-name">{group}</span>
          {description && <span className="group-desc"> &mdash; {description}</span>}
        </td>
      </tr>
      {rows.map(r => (
        <tr key={`${group}-${r.key}`}>
          <td className="gloss-key">
            <div>{r.label || r.key}</div>
            <code className="gloss-code">{r.key}</code>
          </td>
          <td className="gloss-type">{r.type || ''}</td>
          <td className="gloss-meaning">{r.description}</td>
        </tr>
      ))}
    </>
  );

  return (
    <article className="prose">
      <h2>Glossary</h2>
      <p>Every term used in the comparison table, explained. Each row of the comparison table is one <em>feature</em> drawn from the controlled vocabulary below.</p>

      <h3>Feature vocabulary</h3>
      <table className="glossary">
        <thead><tr><th>Term</th><th>Group</th><th>Meaning</th></tr></thead>
        <tbody>
          {groupRows('Permissions', 'what the license lets you do',
            vocab.permissions.map(e  => ({ ...e, type: 'permission'  })))}
          {groupRows('Conditions', 'what you must do in exchange',
            vocab.conditions.map(e   => ({ ...e, type: 'condition'   })))}
          {groupRows('Limitations', 'what the license does not grant you',
            vocab.limitations.map(e  => ({ ...e, type: 'limitation'  })))}
        </tbody>
      </table>

      <h3>Cell values</h3>
      <table className="glossary">
        <thead><tr><th>Value</th><th></th><th>Meaning</th></tr></thead>
        <tbody>
          {VALUE_TERMS.map(v => (
            <tr key={v.key}>
              <td><ValueBadge v={v.key}/></td>
              <td className="gloss-type">{v.key}</td>
              <td className="gloss-meaning">{v.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>License archetypes and stewardship bodies</h3>
      <table className="glossary">
        <thead><tr><th>Term</th><th>Kind</th><th>Meaning</th></tr></thead>
        <tbody>
          {groupRows('Archetypes', "a single label summarizing the license's strategic shape",
            EXTRA_TERMS.filter(t => t.group === 'archetype').map(t => ({ ...t, type: t.group })))}
          {groupRows('Stewardship bodies', 'organizations that classify or approve licenses',
            EXTRA_TERMS.filter(t => t.group === 'body').map(t => ({ ...t, type: t.group })))}
        </tbody>
      </table>
      <p className="subtle">The archetype labels are not formally standardized. They follow a convention drawn from SPDX's license-list metadata, choosealicense.com, GitHub's license picker, and the FSF's free-software vs copyleft-strength breakdown. Each license in this project is tagged with exactly one archetype, picked to summarize its strategic shape rather than every nuance. See <a href="#/about">About</a> for methodology and caveats.</p>
    </article>
  );
}

export default App;
