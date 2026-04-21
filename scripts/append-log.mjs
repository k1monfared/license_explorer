#!/usr/bin/env node
// Append a JSON entry to licenses/<id>/analysis-log.jsonl (one entry per line).
// The timestamp is added automatically.
//
// Usage:
//   node scripts/append-log.mjs <license-id> '<json-string>'
//
// Example:
//   node scripts/append-log.mjs gpl-3.0 '{"step":"source-archive","url":"https://...","archive_sha256":"abc"}'

import fs from 'node:fs/promises';

const [, , licenseId, entryJson] = process.argv;
if (!licenseId || !entryJson) {
  console.error('Usage: node scripts/append-log.mjs <license-id> <json-string>');
  process.exit(2);
}

const parsed = JSON.parse(entryJson);
const entry = { timestamp: new Date().toISOString(), ...parsed };

const dir = `licenses/${licenseId}`;
await fs.mkdir(dir, { recursive: true });
await fs.appendFile(`${dir}/analysis-log.jsonl`, JSON.stringify(entry) + '\n');
console.log('logged');
