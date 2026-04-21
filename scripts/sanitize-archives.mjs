#!/usr/bin/env node
// Scan every archived HTML body under licenses/<id>/analysis-sources/, redact
// secret-shaped strings (Google API keys, AWS keys, etc.), and rewrite the
// file + its sibling .meta.json + every reference to the old sha256 in
// analysis.json, analysis-log.jsonl across the repo.
//
// Needed because archive-source.mjs originally saved pages verbatim and some
// pages (Google-owned help/policy pages) embed Google's public API keys in
// their markup, which trips GitHub's secret scanner. The archive script now
// redacts at write time; this script is the one-time catch-up for files
// written before that change.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const SECRET_PATTERNS = [
  { name: 'Google API key',    re: /AIza[0-9A-Za-z_-]{35}/g,            replacement: '[REDACTED-GOOGLE-API-KEY]' },
  { name: 'AWS access key id', re: /AKIA[0-9A-Z]{16}/g,                   replacement: '[REDACTED-AWS-KEY-ID]' },
  { name: 'Slack token',       re: /xox[baprs]-[0-9a-zA-Z-]{10,}/g,       replacement: '[REDACTED-SLACK-TOKEN]' },
  { name: 'GitHub PAT',        re: /ghp_[0-9a-zA-Z]{36}/g,                replacement: '[REDACTED-GITHUB-PAT]' },
  { name: 'GitHub fine-grained PAT', re: /github_pat_[0-9a-zA-Z_]{22,}/g, replacement: '[REDACTED-GITHUB-PAT]' }
];

async function walkSourceDirs() {
  const out = [];
  const licenses = await fs.readdir('licenses', { withFileTypes: true });
  for (const d of licenses) {
    if (!d.isDirectory()) continue;
    const dir = `licenses/${d.name}/analysis-sources`;
    try {
      const ents = await fs.readdir(dir);
      for (const f of ents) {
        if (f.endsWith('.meta.json')) continue;
        out.push({ licenseId: d.name, dir, name: f, full: `${dir}/${f}` });
      }
    } catch {}
  }
  return out;
}

const renames = new Map(); // oldSha -> { newSha, licenseId }

for (const f of await walkSourceDirs()) {
  const text = await fs.readFile(f.full, 'utf8');
  let redacted = text, hits = 0;
  for (const p of SECRET_PATTERNS) {
    const before = redacted;
    redacted = redacted.replace(p.re, p.replacement);
    if (redacted !== before) hits++;
  }
  if (hits === 0) continue;

  // Compute the new sha and rewrite file + .meta.json
  const oldSha = f.name.replace(/\.[^.]+$/, '');
  const ext = f.name.slice(oldSha.length); // includes leading dot
  const newSha = crypto.createHash('sha256').update(redacted).digest('hex');
  const newBodyPath = `${f.dir}/${newSha}${ext}`;
  const oldMetaPath = `${f.dir}/${oldSha}.meta.json`;
  const newMetaPath = `${f.dir}/${newSha}.meta.json`;

  await fs.writeFile(newBodyPath, redacted);
  if (oldSha !== newSha) await fs.unlink(f.full);

  // Update meta.json: preserve url / retrieved_at / bytes but fix sha + note.
  let meta = {};
  try { meta = JSON.parse(await fs.readFile(oldMetaPath, 'utf8')); } catch {}
  meta.sha256 = newSha;
  meta.bytes = Buffer.byteLength(redacted, 'utf8');
  meta.redactions = hits;
  await fs.writeFile(newMetaPath, JSON.stringify(meta, null, 2) + '\n');
  if (oldSha !== newSha && oldMetaPath !== newMetaPath) await fs.unlink(oldMetaPath);

  renames.set(oldSha, { newSha, licenseId: f.licenseId });
  console.log(`redacted ${f.licenseId} ${oldSha.slice(0,12)}… → ${newSha.slice(0,12)}… (${hits} match group)`);
}

if (renames.size === 0) {
  console.log('no secret patterns found; nothing to rewrite');
  process.exit(0);
}

// Rewrite every reference in analysis.json / analysis-log.jsonl.
async function walkLicenseFiles() {
  const out = [];
  for (const d of await fs.readdir('licenses', { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const dir = `licenses/${d.name}`;
    for (const f of ['analysis.json', 'analysis-log.jsonl']) {
      const p = `${dir}/${f}`;
      try { await fs.access(p); out.push(p); } catch {}
    }
  }
  return out;
}

for (const p of await walkLicenseFiles()) {
  let text = await fs.readFile(p, 'utf8');
  let changed = false;
  for (const [oldSha, { newSha }] of renames) {
    if (text.includes(oldSha)) {
      text = text.split(oldSha).join(newSha);
      changed = true;
    }
  }
  if (changed) {
    await fs.writeFile(p, text);
    console.log(`updated references in ${p}`);
  }
}

console.log(`rewrote ${renames.size} archives + their references. Run: node scripts/aggregate-index.mjs && npm run validate`);
