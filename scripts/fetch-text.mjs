#!/usr/bin/env node
// Usage: node scripts/fetch-text.mjs <url> <output-path>
// Writes the exact body bytes of the URL to <output-path>. Used by lookup-license
// to grab canonical license text verbatim for text.raw.txt.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const [, , url, out] = process.argv;
if (!url || !out) {
  console.error('Usage: node scripts/fetch-text.mjs <url> <output-path>');
  process.exit(2);
}

const r = await fetch(url);
if (!r.ok) { console.error(`HTTP ${r.status} ${r.statusText}`); process.exit(1); }
const body = await r.text();
await fs.mkdir(out.slice(0, out.lastIndexOf('/')), { recursive: true });
await fs.writeFile(out, body);
const sha = crypto.createHash('sha256').update(body).digest('hex');
console.log(`wrote ${body.length} bytes to ${out}`);
console.log(`sha256: ${sha}`);
