import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const SCHEMA_NAMES = ['meta', 'features', 'analysis', 'progress', 'index'];
let ajv = null;

async function loadAjv() {
  if (ajv) return ajv;
  ajv = new Ajv.default ? new Ajv.default({ allErrors: true, strict: false }) : new Ajv({ allErrors: true, strict: false });
  if (addFormats.default) addFormats.default(ajv); else addFormats(ajv);
  for (const name of SCHEMA_NAMES) {
    const s = JSON.parse(await fs.readFile(`schemas/${name}.schema.json`, 'utf8'));
    ajv.addSchema(s, `${name}.schema.json`);
  }
  return ajv;
}

export async function validateFile(filePath, schemaName) {
  const av = await loadAjv();
  const validate = av.getSchema(`${schemaName}.schema.json`);
  const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const ok = validate(data);
  return ok
    ? { ok: true }
    : { ok: false, errors: validate.errors.map(e => `${e.instancePath} ${e.message}`) };
}

export function validateTextHtml(html) {
  const ids = [...html.matchAll(/<span[^>]*id="s-(\d+)"/g)].map(m => Number(m[1]));
  if (ids.length === 0) return { ok: false, errors: ['no sentence spans found'] };
  const missing = [];
  for (let i = 0; i <= Math.max(...ids); i++) if (!ids.includes(i)) missing.push(`s-${i}`);
  return missing.length
    ? { ok: false, errors: [`missing ids: ${missing.join(', ')}`] }
    : { ok: true };
}

async function sha256File(p) {
  const h = crypto.createHash('sha256');
  h.update(await fs.readFile(p));
  return h.digest('hex');
}

export async function validateRepo() {
  const errors = [];
  const indexPath = 'licenses/index.json';
  try { await fs.access(indexPath); } catch { return { ok: true }; }

  const idxRes = await validateFile(indexPath, 'index');
  if (!idxRes.ok) errors.push(`licenses/index.json: ${idxRes.errors.join(', ')}`);
  const catalog = JSON.parse(await fs.readFile(indexPath, 'utf8'));

  // Orphan detection: every licenses/<id>/ dir must have a catalog entry.
  const catalogIds = new Set(catalog.map(e => e.id));
  try {
    const ents = await fs.readdir('licenses', { withFileTypes: true });
    for (const d of ents) {
      if (!d.isDirectory()) continue;
      if (!catalogIds.has(d.name)) {
        errors.push(`licenses/${d.name}: directory exists but is not listed in licenses/index.json`);
      }
    }
  } catch {}

  const vocab = JSON.parse(await fs.readFile('schemas/feature-vocabulary.json', 'utf8'));
  const vocabKeys = new Set(
    [...vocab.permissions, ...vocab.conditions, ...vocab.limitations].map(e => e.key)
  );

  for (const entry of catalog) {
    const dir = `licenses/${entry.id}`;
    const metaP = `${dir}/meta.json`;
    const metaRes = await validateFile(metaP, 'meta');
    if (!metaRes.ok) { errors.push(`${metaP}: ${metaRes.errors.join(', ')}`); continue; }
    const meta = JSON.parse(await fs.readFile(metaP, 'utf8'));

    const rawP = `${dir}/text.raw.txt`;
    try {
      const actual = await sha256File(rawP);
      if (actual !== meta.text_provenance.sha256) {
        errors.push(`${rawP}: sha256 mismatch, expected ${meta.text_provenance.sha256.slice(0,12)} got ${actual.slice(0,12)}`);
      }
    } catch (e) { errors.push(`${rawP}: ${e.message}`); }

    const htmlP = `${dir}/text.html`;
    let html = null;
    try { html = await fs.readFile(htmlP, 'utf8'); } catch (err) { if (err.code !== 'ENOENT') errors.push(`${htmlP}: ${err.message}`); }
    if (html !== null) {
      const htmlRes = validateTextHtml(html);
      if (!htmlRes.ok) errors.push(`${htmlP}: ${htmlRes.errors.join(', ')}`);

      const featP = `${dir}/features.json`;
      try {
        await fs.access(featP);
        const featRes = await validateFile(featP, 'features');
        if (!featRes.ok) errors.push(`${featP}: ${featRes.errors.join(', ')}`);
        const feat = JSON.parse(await fs.readFile(featP, 'utf8'));
        const sentenceIds = new Set([...html.matchAll(/id="(s-\d+)"/g)].map(m => m[1]));
        const allEntries = [...feat.permissions, ...feat.conditions, ...feat.limitations];
        for (const e of allEntries) {
          if (!vocabKeys.has(e.key)) errors.push(`${featP}: unknown feature key "${e.key}"`);
          for (const c of e.citations) {
            if (!sentenceIds.has(c.sentence_id)) errors.push(`${featP}: citation ${c.sentence_id} not in ${htmlP}`);
          }
          // Source-completeness rule:
          //  * grey values ALWAYS require a citation or external reference (contested claim).
          //  * commentary on a positive value (permitted/required/forbidden) requires a source
          //    (the commentary is expanding on an assertion grounded in the text, so it must cite).
          //  * commentary on `silent` or `not_assessed` is allowed without a citation: the value
          //    itself already means "the license text does not address this"; commentary merely
          //    explains what that silence implies.
          const commentaryRequiresSource = e.commentary && e.commentary.length
            && e.value !== 'silent' && e.value !== 'not_assessed';
          const needsSource = e.value === 'grey' || commentaryRequiresSource;
          if (needsSource && e.citations.length === 0 && e.external_references.length === 0) {
            const reason = e.value === 'grey' ? 'grey value' : `commentary on ${e.value} value`;
            errors.push(`${featP}: entry "${e.key}" has ${reason} but no citations or external references`);
          }
        }
      } catch (err) { if (err.code !== 'ENOENT') errors.push(`${featP}: ${err.message}`); }
    }

    const anaP = `${dir}/analysis.json`;
    try {
      await fs.access(anaP);
      const anaRes = await validateFile(anaP, 'analysis');
      if (!anaRes.ok) errors.push(`${anaP}: ${anaRes.errors.join(', ')}`);
      // Provenance check: every archive_sha256 in analysis.json must point
      // to an existing file in analysis-sources/.
      const ana = JSON.parse(await fs.readFile(anaP, 'utf8'));
      const allSrcRefs = [
        ...(ana.entries || []).flatMap(e => e.sources || []),
        ...(ana.sources || [])
      ];
      for (const s of allSrcRefs) {
        if (!s.archive_sha256) continue;
        // Any file with that sha256 (content-addressed; extension varies).
        const srcDir = `${dir}/analysis-sources`;
        let found = false;
        try {
          const ents = await fs.readdir(srcDir);
          for (const name of ents) {
            if (name.startsWith(s.archive_sha256 + '.') && !name.endsWith('.meta.json')) { found = true; break; }
          }
        } catch {}
        if (!found) errors.push(`${anaP}: archive_sha256 ${s.archive_sha256.slice(0,12)}… has no matching file in ${srcDir}/`);
      }
    } catch {}

    const progP = `${dir}/.progress.json`;
    try {
      await fs.access(progP);
      const progRes = await validateFile(progP, 'progress');
      if (!progRes.ok) errors.push(`${progP}: ${progRes.errors.join(', ')}`);
    } catch {}
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await validateRepo();
  if (r.ok) { console.log('OK validate'); }
  else { console.error('FAIL validation:\n  ' + r.errors.join('\n  ')); process.exit(1); }
}
