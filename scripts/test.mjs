import { spec } from 'node:test/reporters';
import { run } from 'node:test';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs/promises';
import path from 'node:path';

async function walk(dir, out = []) {
  for (const d of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) await walk(p, out);
    else if (d.isFile() && p.endsWith('.test.mjs')) out.push(p);
  }
  return out;
}

const files = await walk('tests');

await pipeline(
  run({ files, concurrency: true }),
  new spec(),
  process.stdout
);
