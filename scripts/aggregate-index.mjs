#!/usr/bin/env node
// Collects every licenses/<id>/.index-entry.json into a single licenses/index.json.
// Preserves any existing catalog entries whose license dirs no longer have an
// .index-entry.json file (i.e. old seeds like mit, apache-2.0). Stable order: sort
// by archetype group then by id.
import fs from 'node:fs/promises';
import path from 'node:path';

const ARCHETYPE_ORDER = [
  'permissive', 'weak-copyleft', 'strong-copyleft',
  'attribution', 'share-alike', 'public-domain', 'proprietary'
];

async function readJson(p) { return JSON.parse(await fs.readFile(p, 'utf8')); }

const existing = JSON.parse(await fs.readFile('licenses/index.json', 'utf8'));
const byId = Object.fromEntries(existing.map(e => [e.id, e]));

const dirs = (await fs.readdir('licenses', { withFileTypes: true }))
  .filter(d => d.isDirectory()).map(d => d.name);

for (const id of dirs) {
  const entryPath = `licenses/${id}/.index-entry.json`;
  try {
    const e = await readJson(entryPath);
    byId[e.id] = e;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // No index-entry file: keep whatever was already in the catalog (or ignore if none).
  }
}

// Propagate FSF stance from each license's meta.json into the catalog entry.
for (const [id, entry] of Object.entries(byId)) {
  try {
    const meta = await readJson(`licenses/${id}/meta.json`);
    const fsf = (meta.approvals || []).find(a => a.body === 'FSF');
    if (fsf && fsf.stance) entry.fsf_stance = fsf.stance;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

const sorted = Object.values(byId).sort((a, b) => {
  const ai = ARCHETYPE_ORDER.indexOf(a.archetype);
  const bi = ARCHETYPE_ORDER.indexOf(b.archetype);
  if (ai !== bi) return ai - bi;
  return a.id.localeCompare(b.id);
});

await fs.writeFile('licenses/index.json', JSON.stringify(sorted, null, 2) + '\n');

// Remove the .index-entry.json fragments now that they're merged.
for (const id of dirs) {
  const entryPath = `licenses/${id}/.index-entry.json`;
  try { await fs.unlink(entryPath); } catch (err) { if (err.code !== 'ENOENT') throw err; }
}

console.log(`aggregated ${sorted.length} licenses into licenses/index.json`);
for (const e of sorted) console.log(`  ${e.archetype.padEnd(16)} ${e.id}`);

// Build a flat feature index so the browse page can filter by feature value
// without fetching 45 features.json files at page load. Shape:
//   { "<id>": { "<feature-key>": "permitted" | "required" | ... } }
{
  const featureIndex = {};
  const analysisIndex = {};
  for (const entry of sorted) {
    const featPath = `licenses/${entry.id}/features.json`;
    try {
      const feat = JSON.parse(await fs.readFile(featPath, 'utf8'));
      const row = {};
      for (const group of ['permissions', 'conditions', 'limitations']) {
        for (const e of feat[group] || []) row[e.key] = e.value;
      }
      featureIndex[entry.id] = row;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      featureIndex[entry.id] = {};
    }

    // Count analysis topics per license so the browse page can surface it.
    const anaPath = `licenses/${entry.id}/analysis.json`;
    try {
      const ana = JSON.parse(await fs.readFile(anaPath, 'utf8'));
      analysisIndex[entry.id] = {
        topics: (ana.entries || []).length,
        topic_keys: (ana.entries || []).map(e => e.topic)
      };
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  await fs.writeFile('licenses/feature-index.json', JSON.stringify(featureIndex, null, 2) + '\n');
  await fs.writeFile('licenses/analysis-index.json', JSON.stringify(analysisIndex, null, 2) + '\n');
  console.log(`wrote licenses/feature-index.json (${Object.keys(featureIndex).length} licenses × feature values)`);
  console.log(`wrote licenses/analysis-index.json (${Object.keys(analysisIndex).length} licenses with deep analysis)`);
}

// Recompute the cost estimate based on the new catalog and archive sizes.
try {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('node', ['scripts/estimate-cost.mjs'], { stdio: 'pipe' });
  if (r.status !== 0) console.error('cost estimate failed:', r.stderr?.toString());
  else console.log('wrote licenses/cost-estimate.json');
} catch (err) { console.error('cost estimate failed:', err.message); }

// Sync the roadmap: whatever's now in the catalog drops out of planned[].
try {
  const roadmapPath = 'docs/roadmap.json';
  const roadmap = JSON.parse(await fs.readFile(roadmapPath, 'utf8'));
  const before = roadmap.planned.length;
  const catalogIds = new Set(sorted.map(e => e.id));
  roadmap.planned = roadmap.planned.filter(p => !catalogIds.has(p.id));
  if (roadmap.planned.length !== before) {
    await fs.writeFile(roadmapPath, JSON.stringify(roadmap, null, 2) + '\n');
    console.log(`roadmap: ${before - roadmap.planned.length} entries moved to done, ${roadmap.planned.length} remaining`);
  } else {
    console.log(`roadmap: ${roadmap.planned.length} planned, none completed this pass`);
  }
} catch (err) {
  if (err.code !== 'ENOENT') console.error('roadmap sync failed:', err.message);
}
