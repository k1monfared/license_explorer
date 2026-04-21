#!/usr/bin/env node
// Download a URL's body, compute sha256, and save it under the license's
// analysis-sources directory. Paired with a .meta.json holding retrieval
// metadata. Idempotent: if an object with the same sha256 already exists,
// the script still refreshes its meta.json (new retrieved_at) but leaves
// the body alone.
//
// Usage:
//   node scripts/archive-source.mjs <license-id> <url>
//
// Prints a single JSON line to stdout:
//   {"sha256":"<hex>","body":"<relative path>","meta":"<relative path>","url":"<url>","bytes":<n>}
//
// This is the file the deep-analysis skill invokes for every external
// source it consults, before writing any analysis.json entry that cites
// that source.

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

const [, , licenseId, url] = process.argv;
if (!licenseId || !url) {
  console.error('Usage: node scripts/archive-source.mjs <license-id> <url>');
  process.exit(2);
}

const dir = `licenses/${licenseId}/analysis-sources`;
await fs.mkdir(dir, { recursive: true });

const headers = {
  'User-Agent': 'license_explorer archive bot (github.com/k1monfared/license_explorer)',
  'Accept': '*/*'
};

const r = await fetch(url, { headers, redirect: 'follow' });
if (!r.ok) {
  console.error(`HTTP ${r.status} ${r.statusText} for ${url}`);
  process.exit(1);
}
const body = Buffer.from(await r.arrayBuffer());
const sha = crypto.createHash('sha256').update(body).digest('hex');

const ct = (r.headers.get('content-type') || 'application/octet-stream').toLowerCase();
const ext =
  ct.includes('html')   ? 'html' :
  ct.includes('json')   ? 'json' :
  ct.includes('xml')    ? 'xml' :
  ct.includes('pdf')    ? 'pdf' :
  ct.includes('text')   ? 'txt' :
  'bin';

const bodyPath = `${dir}/${sha}.${ext}`;
const metaPath = `${dir}/${sha}.meta.json`;

// Only write body if it doesn't already exist (content-addressed; identical
// URLs with identical bodies dedupe automatically).
let bodyWasNew = false;
try { await fs.access(bodyPath); }
catch { await fs.writeFile(bodyPath, body); bodyWasNew = true; }

const meta = {
  url,
  final_url: r.url,
  retrieved_at: new Date().toISOString(),
  sha256: sha,
  bytes: body.length,
  content_type: ct,
  http_status: r.status
};
// Preserve history of retrievals if meta already exists.
let history = [];
try {
  const prev = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  history = prev.history || [];
  history.unshift({ retrieved_at: prev.retrieved_at, http_status: prev.http_status, final_url: prev.final_url });
} catch {}
meta.history = history.slice(0, 20);
await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n');

console.log(JSON.stringify({
  sha256: sha, body: bodyPath, meta: metaPath,
  url, bytes: body.length, body_was_new: bodyWasNew
}));
