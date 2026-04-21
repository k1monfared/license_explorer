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
