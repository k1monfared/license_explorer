import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { tokenizeToHtml } from './tokenizer.mjs';

const raw = await fs.readFile('licenses/mit/text.raw.txt', 'utf8');
const sha = crypto.createHash('sha256').update(raw).digest('hex');
const retrieved = '2026-04-21T14:00:00Z';

const meta = {
  id: 'mit',
  name: 'MIT License',
  spdx: 'MIT',
  medium: 'software',
  archetype: 'permissive',
  version: null,
  year: null,
  canonical_url: 'https://opensource.org/license/mit',
  text_provenance: {
    source_url: 'https://opensource.org/license/mit',
    retrieved_at: retrieved,
    sha256: sha
  },
  references: [
    { source: 'OSI',            url: 'https://opensource.org/license/mit',         retrieved_at: retrieved },
    { source: 'TLDR Legal',     url: 'https://tldrlegal.com/license/mit-license',  retrieved_at: retrieved },
    { source: 'choosealicense', url: 'https://choosealicense.com/licenses/mit/',   retrieved_at: retrieved }
  ]
};
await fs.writeFile('licenses/mit/meta.json', JSON.stringify(meta, null, 2) + '\n');

const { html, sentences } = tokenizeToHtml(raw);
await fs.writeFile('licenses/mit/text.html', html + '\n');

console.log('MIT seed complete. sha256=', sha);
console.log('sentences:', sentences.length);
sentences.forEach((s, i) => console.log(`  s-${i}: ${s.slice(0, 80)}${s.length > 80 ? '...' : ''}`));
