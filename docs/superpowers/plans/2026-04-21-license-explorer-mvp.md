# License Explorer MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, GitHub Pages–hosted interactive explorer for software + media licenses, driven by per-license JSON data, with feature-to-sentence citations, comparison, and a resumable Claude skill pipeline that populates license data.

**Architecture:** Static HTML shell + React via UMD + in-browser Babel, site_kit for chrome, SPA with hash routing. Data lives in `licenses/<id>/` directories (meta, raw text, sentence-wrapped HTML, features, analysis) governed by JSON schemas. Three project-local Claude skills (`lookup-license`, `extract-features`, `deep-analysis`) populate data incrementally via per-license `.progress.json` so failures never force redoing completed work.

**Tech Stack:** HTML, React 18 (CDN UMD), Babel Standalone, plain CSS, site_kit, Node.js for dev/test tooling only (ajv, playwright, http-server). Deploy: GitHub Pages from `master`.

**Spec:** `docs/superpowers/specs/2026-04-21-license-explorer-design.md`

---

## Phase A — Scaffold & Deploy

### Task 1: Enable GitHub Pages + minimal live index

**Files:**
- Create: `index.html`

- [ ] **Step 1: Write minimal `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>License Explorer</title>
  <style>body { font-family: system-ui, sans-serif; margin: 2rem; }</style>
</head>
<body>
  <h1>License Explorer</h1>
  <p>Coming soon — interactive explorer for software and media licenses.</p>
</body>
</html>
```

- [ ] **Step 2: Commit and push to master**

```bash
git add index.html
git commit -m "feat: minimal live landing page"
git push origin master
```

- [ ] **Step 3: Enable GitHub Pages via gh CLI**

```bash
echo '{"source":{"branch":"master","path":"/"}}' | \
  gh api -X POST /repos/k1monfared/license_explorer/pages --input -
```
Expected: JSON response containing `"status": "queued"` or `"built"`. If the response says `"already exists"`, Pages is already enabled — that's fine, continue.

- [ ] **Step 4: Verify site is live**

```bash
sleep 90
curl -sf https://k1monfared.github.io/license_explorer/ | grep "License Explorer"
```
Expected: HTML line containing `<h1>License Explorer</h1>`. If 404, wait another 60s and retry.

- [ ] **Step 5: Commit verification**

Nothing to commit; output confirms Step 3 only.

---

### Task 2: Node dev tooling (ajv, playwright, http-server)

**Files:**
- Create: `package.json`
- Create: `.gitignore` (modify to add `node_modules/`, `test-results/`, `playwright-report/`)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "license-explorer",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "test": "node scripts/test.mjs",
    "validate": "node scripts/validate.mjs",
    "serve": "npx http-server -p 8080 -c-1 -s .",
    "smoke": "npx playwright test tests/smoke.spec.mjs"
  },
  "devDependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "http-server": "^14.1.1",
    "@playwright/test": "^1.48.0"
  }
}
```

- [ ] **Step 2: Ensure `.gitignore` covers node**

If not present, append to `.gitignore`:
```
node_modules/
test-results/
playwright-report/
```

- [ ] **Step 3: Install deps**

```bash
npm install
```
Expected: `node_modules/` created; `package-lock.json` written.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: add dev tooling (ajv, playwright, http-server)"
```

---

### Task 3: JSON schemas + feature vocabulary

**Files:**
- Create: `schemas/meta.schema.json`
- Create: `schemas/features.schema.json`
- Create: `schemas/analysis.schema.json`
- Create: `schemas/progress.schema.json`
- Create: `schemas/index.schema.json`
- Create: `schemas/feature-vocabulary.json`

- [ ] **Step 1: Create `schemas/feature-vocabulary.json`**

```json
{
  "permissions": [
    { "key": "commercial-use",    "label": "Commercial use",        "description": "The licensed work may be used for commercial purposes." },
    { "key": "modification",      "label": "Modification",          "description": "The licensed work may be modified." },
    { "key": "distribution",      "label": "Distribution",          "description": "The licensed work may be distributed." },
    { "key": "private-use",       "label": "Private use",           "description": "The licensed work may be used and modified in private." },
    { "key": "patent-use",        "label": "Patent use",            "description": "An express grant of patent rights from contributors." }
  ],
  "conditions": [
    { "key": "include-copyright",       "label": "Include copyright",       "description": "A copy of the license and copyright notice must be included with the work." },
    { "key": "document-changes",        "label": "Document changes",        "description": "Changes made to the licensed work must be documented." },
    { "key": "disclose-source",         "label": "Disclose source",         "description": "Source code must be made available when the work is distributed." },
    { "key": "network-use-disclose",    "label": "Network use disclosure",  "description": "Users who interact with the work over a network must be able to receive the source." },
    { "key": "same-license",            "label": "Same license",            "description": "Modifications must be released under the same license." },
    { "key": "attribution",             "label": "Give attribution",        "description": "Credit the original author(s)." }
  ],
  "limitations": [
    { "key": "liability",  "label": "Liability",  "description": "The license includes a limitation of liability." },
    { "key": "warranty",   "label": "Warranty",   "description": "The license explicitly states it does not provide a warranty." },
    { "key": "trademark",  "label": "Trademark use", "description": "The license does not grant trademark rights." }
  ]
}
```

- [ ] **Step 2: Create `schemas/meta.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "meta.schema.json",
  "type": "object",
  "required": ["id", "name", "medium", "archetype", "canonical_url", "text_provenance", "references"],
  "properties": {
    "id":       { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]*$" },
    "name":     { "type": "string", "minLength": 1 },
    "spdx":     { "type": ["string", "null"] },
    "medium":   { "enum": ["software", "media", "hardware", "data"] },
    "archetype":{ "enum": ["permissive", "weak-copyleft", "strong-copyleft", "attribution", "share-alike", "public-domain", "proprietary"] },
    "version":  { "type": ["string", "null"] },
    "year":     { "type": ["integer", "null"] },
    "canonical_url": { "type": "string", "format": "uri" },
    "text_provenance": {
      "type": "object",
      "required": ["source_url", "retrieved_at", "sha256"],
      "properties": {
        "source_url":   { "type": "string", "format": "uri" },
        "retrieved_at": { "type": "string", "format": "date-time" },
        "sha256":       { "type": "string", "pattern": "^[a-f0-9]{64}$" }
      },
      "additionalProperties": false
    },
    "references": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object",
        "required": ["source", "url", "retrieved_at"],
        "properties": {
          "source":       { "type": "string", "minLength": 1 },
          "url":          { "type": "string", "format": "uri" },
          "retrieved_at": { "type": "string", "format": "date-time" },
          "note":         { "type": "string" }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 3: Create `schemas/features.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "features.schema.json",
  "$defs": {
    "externalRef": {
      "type": "object",
      "required": ["source", "url", "retrieved_at"],
      "properties": {
        "source":       { "type": "string", "minLength": 1 },
        "url":          { "type": "string", "format": "uri" },
        "retrieved_at": { "type": "string", "format": "date-time" },
        "excerpt":      { "type": "string" },
        "summary":      { "type": "string" }
      },
      "anyOf": [
        { "required": ["excerpt"] },
        { "required": ["summary"] }
      ],
      "additionalProperties": false
    },
    "citation": {
      "type": "object",
      "required": ["sentence_id"],
      "properties": {
        "sentence_id": { "type": "string", "pattern": "^s-[0-9]+$" },
        "note":        { "type": "string" }
      },
      "additionalProperties": false
    },
    "entry": {
      "type": "object",
      "required": ["key", "value", "citations", "external_references"],
      "properties": {
        "key":   { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
        "value": { "enum": ["permitted", "required", "forbidden", "silent", "grey", "not_assessed"] },
        "citations":          { "type": "array", "items": { "$ref": "#/$defs/citation" } },
        "external_references":{ "type": "array", "items": { "$ref": "#/$defs/externalRef" } },
        "commentary":         { "type": "string" }
      },
      "additionalProperties": false
    }
  },
  "type": "object",
  "required": ["permissions", "conditions", "limitations", "sources"],
  "properties": {
    "permissions": { "type": "array", "items": { "$ref": "#/$defs/entry" } },
    "conditions":  { "type": "array", "items": { "$ref": "#/$defs/entry" } },
    "limitations": { "type": "array", "items": { "$ref": "#/$defs/entry" } },
    "sources": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["source", "url", "role"],
        "properties": {
          "source": { "type": "string", "minLength": 1 },
          "url":    { "type": "string" },
          "role":   { "type": "string", "minLength": 1 },
          "retrieved_at": { "type": "string", "format": "date-time" }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 4: Create `schemas/analysis.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "analysis.schema.json",
  "type": "object",
  "required": ["entries", "sources"],
  "properties": {
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["topic", "summary", "sources"],
        "properties": {
          "topic":   { "type": "string" },
          "summary": { "type": "string", "minLength": 1 },
          "sources": {
            "type": "array", "minItems": 1,
            "items": {
              "type": "object",
              "required": ["source", "url", "retrieved_at"],
              "properties": {
                "source":       { "type": "string" },
                "url":          { "type": "string", "format": "uri" },
                "retrieved_at": { "type": "string", "format": "date-time" },
                "excerpt":      { "type": "string" },
                "summary":      { "type": "string" }
              },
              "anyOf": [
                { "required": ["excerpt"] },
                { "required": ["summary"] }
              ],
              "additionalProperties": false
            }
          }
        },
        "additionalProperties": false
      }
    },
    "sources": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["source", "url", "retrieved_at"],
        "properties": {
          "source":       { "type": "string" },
          "url":          { "type": "string", "format": "uri" },
          "retrieved_at": { "type": "string", "format": "date-time" }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 5: Create `schemas/progress.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "progress.schema.json",
  "$defs": {
    "stage": {
      "type": "object",
      "required": ["status", "updated_at"],
      "properties": {
        "status":      { "enum": ["pending", "partial", "complete", "failed"] },
        "updated_at":  { "type": "string", "format": "date-time" },
        "completed_keys": { "type": "array", "items": { "type": "string" } },
        "remaining_keys": { "type": "array", "items": { "type": "string" } },
        "last_error":  { "type": ["string", "null"] }
      },
      "additionalProperties": false
    }
  },
  "type": "object",
  "required": ["lookup_license", "extract_features", "deep_analysis"],
  "properties": {
    "lookup_license":   { "$ref": "#/$defs/stage" },
    "extract_features": { "$ref": "#/$defs/stage" },
    "deep_analysis":    { "$ref": "#/$defs/stage" }
  },
  "additionalProperties": false
}
```

- [ ] **Step 6: Create `schemas/index.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "index.schema.json",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "name", "medium", "archetype", "blurb", "tags"],
    "properties": {
      "id":        { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]*$" },
      "name":      { "type": "string" },
      "spdx":      { "type": ["string", "null"] },
      "medium":    { "enum": ["software", "media", "hardware", "data"] },
      "archetype": { "enum": ["permissive", "weak-copyleft", "strong-copyleft", "attribution", "share-alike", "public-domain", "proprietary"] },
      "blurb":     { "type": "string", "maxLength": 280 },
      "tags":      { "type": "array", "items": { "type": "string" } }
    },
    "additionalProperties": false
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add schemas/
git commit -m "feat: JSON schemas and feature vocabulary"
```

---

### Task 4: Validation script with tests

**Files:**
- Create: `scripts/validate.mjs`
- Create: `scripts/test.mjs`
- Create: `tests/validate.test.mjs`
- Create: `tests/fixtures/valid-meta.json`
- Create: `tests/fixtures/invalid-meta.json`

- [ ] **Step 1: Write the failing test — `tests/validate.test.mjs`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFile, validateTextHtml, validateRepo } from '../scripts/validate.mjs';

test('accepts a valid meta.json fixture', async () => {
  const r = await validateFile('tests/fixtures/valid-meta.json', 'meta');
  assert.equal(r.ok, true, r.errors?.join('\n'));
});

test('rejects an invalid meta.json fixture with a clear error', async () => {
  const r = await validateFile('tests/fixtures/invalid-meta.json', 'meta');
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /text_provenance/);
});

test('flags sentence id gaps in text.html', () => {
  const html = '<span id="s-0">A.</span><span id="s-2">C.</span>';
  const r = validateTextHtml(html);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /s-1/);
});

test('accepts contiguous sentence ids', () => {
  const html = '<span id="s-0">A.</span><span id="s-1">B.</span>';
  const r = validateTextHtml(html);
  assert.equal(r.ok, true);
});
```

- [ ] **Step 2: Write fixtures**

`tests/fixtures/valid-meta.json`:
```json
{
  "id": "mit", "name": "MIT License", "spdx": "MIT",
  "medium": "software", "archetype": "permissive",
  "version": null, "year": null,
  "canonical_url": "https://opensource.org/license/mit",
  "text_provenance": {
    "source_url": "https://opensource.org/license/mit",
    "retrieved_at": "2026-04-21T14:03:22Z",
    "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
  },
  "references": [
    { "source": "OSI", "url": "https://opensource.org/license/mit", "retrieved_at": "2026-04-21T14:03:22Z" }
  ]
}
```

`tests/fixtures/invalid-meta.json` — same as above but remove the `text_provenance` block entirely.

- [ ] **Step 3: Write the validator — `scripts/validate.mjs`**

```javascript
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const SCHEMA_NAMES = ['meta', 'features', 'analysis', 'progress', 'index'];
let ajv = null;

async function loadAjv() {
  if (ajv) return ajv;
  ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
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

  const vocab = JSON.parse(await fs.readFile('schemas/feature-vocabulary.json', 'utf8'));
  const vocabKeys = new Set(
    [...vocab.permissions, ...vocab.conditions, ...vocab.limitations].map(e => e.key)
  );

  for (const entry of catalog) {
    const dir = `licenses/${entry.id}`;
    // meta
    const metaP = `${dir}/meta.json`;
    const metaRes = await validateFile(metaP, 'meta');
    if (!metaRes.ok) errors.push(`${metaP}: ${metaRes.errors.join(', ')}`);
    const meta = JSON.parse(await fs.readFile(metaP, 'utf8'));

    // text provenance
    const rawP = `${dir}/text.raw.txt`;
    try {
      const actual = await sha256File(rawP);
      if (actual !== meta.text_provenance.sha256) {
        errors.push(`${rawP}: sha256 mismatch — expected ${meta.text_provenance.sha256.slice(0,12)}…, got ${actual.slice(0,12)}…`);
      }
    } catch (e) { errors.push(`${rawP}: ${e.message}`); }

    // text.html
    const htmlP = `${dir}/text.html`;
    try {
      const html = await fs.readFile(htmlP, 'utf8');
      const htmlRes = validateTextHtml(html);
      if (!htmlRes.ok) errors.push(`${htmlP}: ${htmlRes.errors.join(', ')}`);

      // features.json + citation liveness + source completeness
      const featP = `${dir}/features.json`;
      try {
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
          const needsSource = e.value === 'grey' || (e.commentary && e.commentary.length);
          if (needsSource && e.citations.length === 0 && e.external_references.length === 0) {
            errors.push(`${featP}: entry "${e.key}" has ${e.value === 'grey' ? 'grey value' : 'commentary'} but no citations or external references`);
          }
        }
      } catch (err) { if (err.code !== 'ENOENT') errors.push(`${featP}: ${err.message}`); }
    } catch (err) { if (err.code !== 'ENOENT') errors.push(`${htmlP}: ${err.message}`); }

    // analysis.json (optional)
    const anaP = `${dir}/analysis.json`;
    try {
      await fs.access(anaP);
      const anaRes = await validateFile(anaP, 'analysis');
      if (!anaRes.ok) errors.push(`${anaP}: ${anaRes.errors.join(', ')}`);
    } catch {}

    // progress.json (optional but validated if present)
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
  if (r.ok) { console.log('✓ validate OK'); }
  else { console.error('✗ validation failed:\n  ' + r.errors.join('\n  ')); process.exit(1); }
}
```

- [ ] **Step 4: Write `scripts/test.mjs`**

```javascript
import { spec } from 'node:test/reporters';
import { run } from 'node:test';
import { pipeline } from 'node:stream/promises';
import { glob } from 'node:fs/promises';

const files = [];
for await (const f of glob('tests/**/*.test.mjs')) files.push(f);

await pipeline(
  run({ files, concurrency: true }),
  new spec(),
  process.stdout
);
```

- [ ] **Step 5: Run tests; confirm all pass**

```bash
npm test
```
Expected: 4 tests pass (accepts valid meta, rejects invalid meta, flags gaps, accepts contiguous).

- [ ] **Step 6: Run `npm run validate`; confirm OK (no licenses yet)**

```bash
npm run validate
```
Expected: `✓ validate OK`.

- [ ] **Step 7: Commit**

```bash
git add scripts/ tests/
git commit -m "feat: schema + repo validator with unit tests"
```

---

### Task 5: Scaffold React shell + site_kit + theme toggle

**Files:**
- Modify: `index.html`
- Create: `app.jsx`
- Create: `licenses.css`

- [ ] **Step 1: Replace `index.html` with the React shell**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>License Explorer</title>
  <link rel="stylesheet" href="https://k1monfared.github.io/site_kit/css/base.css">
  <link rel="stylesheet" href="https://k1monfared.github.io/site_kit/css/nav.css">
  <link rel="stylesheet" href="./licenses.css">
  <script src="https://k1monfared.github.io/site_kit/js/theme.js"></script>
</head>
<body>
  <header>
    <div class="container">
      <h1 style="display:inline-block">License Explorer</h1>
      <button id="theme-toggle" style="float:right"><span class="theme-icon"></span></button>
    </div>
  </header>
  <main class="container">
    <div id="root"></div>
  </main>
  <footer>
    <div class="container"><small>Open-source license explorer · <a href="https://github.com/k1monfared/license_explorer">source</a></small></div>
  </footer>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script>
    fetch("app.jsx").then(r => r.text()).then(jsx => {
      const patched = jsx
        .replace(/^\s*import\s+\{([^}]+)\}\s+from\s+["']react["'];?\s*$/m,
                 (_, n) => `const { ${n.trim()} } = React;`)
        .replace(/^\s*import\s+\S.*$/mg, "")
        .replace(/^\s*export\s+default\s+/m, "window.__App = ");
      const { code } = Babel.transform(patched, { presets: ["react"] });
      const s = document.createElement("script");
      s.textContent = code;
      document.head.appendChild(s);
      ReactDOM.createRoot(document.getElementById("root"))
              .render(React.createElement(window.__App));
    }).catch(e => {
      document.getElementById("root").textContent = "Error loading app: " + e;
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Create `app.jsx`**

```jsx
import { useState, useEffect } from "react";

function App() {
  const [catalog, setCatalog] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch("licenses/index.json")
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(setCatalog)
      .catch(e => setErr(String(e)));
  }, []);

  if (err) return <p style={{color: "#f87171"}}>Error: {err}</p>;
  if (!catalog) return <p>Loading…</p>;
  if (catalog.length === 0) return <p>No licenses yet. Add one via <code>/add-license</code>.</p>;
  return <p>Loaded {catalog.length} license(s). Browse UI coming next.</p>;
}

export default App;
```

- [ ] **Step 3: Create `licenses.css`**

```css
:root { --container-max-width: 1200px; }
main.container { padding-top: 1.5rem; padding-bottom: 2rem; }
#theme-toggle { background: none; border: 1px solid var(--border, #333); color: var(--text, #eee); padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; }
```

- [ ] **Step 4: Seed empty catalog so the page renders**

```bash
mkdir -p licenses
echo '[]' > licenses/index.json
```

- [ ] **Step 5: Serve locally and verify**

```bash
npm run serve &
SERVER_PID=$!
sleep 2
curl -sf http://localhost:8080/ | grep "License Explorer"
kill $SERVER_PID
```
Expected: line `<h1 style="display:inline-block">License Explorer</h1>` printed.

- [ ] **Step 6: Commit**

```bash
git add index.html app.jsx licenses.css licenses/index.json
git commit -m "feat: React app shell + site_kit chrome + empty catalog"
git push origin master
```

---

### Task 6: Hash router with stub routes

**Files:**
- Modify: `app.jsx`

- [ ] **Step 1: Write the failing test — `tests/router.test.mjs`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, serializeCompare } from '../scripts/router.mjs';

test('parses #/ as browse route', () => {
  assert.deepEqual(parseRoute('#/'), { name: 'browse' });
});

test('parses #/license/<id>', () => {
  assert.deepEqual(parseRoute('#/license/mit'), { name: 'detail', id: 'mit' });
});

test('parses #/license/<id>/text', () => {
  assert.deepEqual(parseRoute('#/license/mit/text'), { name: 'text', id: 'mit' });
});

test('parses #/compare?set=mit,gpl-3.0', () => {
  assert.deepEqual(
    parseRoute('#/compare?set=mit,gpl-3.0'),
    { name: 'compare', ids: ['mit', 'gpl-3.0'] }
  );
});

test('serializes compare set back to hash', () => {
  assert.equal(serializeCompare(['mit', 'gpl-3.0']), '#/compare?set=mit,gpl-3.0');
});

test('parseRoute defaults to browse for unknown hashes', () => {
  assert.deepEqual(parseRoute('#/garbage'), { name: 'browse' });
});
```

- [ ] **Step 2: Create `scripts/router.mjs`**

```javascript
export function parseRoute(hash) {
  const h = (hash || '').replace(/^#/, '');
  if (!h || h === '/') return { name: 'browse' };
  const m = h.match(/^\/license\/([a-z0-9][a-z0-9-]*)(?:\/(text))?$/);
  if (m) return m[2] ? { name: 'text', id: m[1] } : { name: 'detail', id: m[1] };
  const cm = h.match(/^\/compare(?:\?set=([a-z0-9,.-]+))?$/);
  if (cm) return { name: 'compare', ids: cm[1] ? cm[1].split(',').filter(Boolean) : [] };
  return { name: 'browse' };
}

export function serializeCompare(ids) {
  return '#/compare?set=' + ids.join(',');
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: 10 tests pass (4 from Task 4 + 6 new).

- [ ] **Step 4: Wire router into `app.jsx`**

Replace `app.jsx` contents with:

```jsx
import { useState, useEffect } from "react";

function parseRoute(hash) {
  const h = (hash || '').replace(/^#/, '');
  if (!h || h === '/') return { name: 'browse' };
  const m = h.match(/^\/license\/([a-z0-9][a-z0-9-]*)(?:\/(text))?$/);
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

function BrowseStub()   { return <p>Browse page (stub)</p>; }
function DetailStub({id}){ return <p>Detail page (stub) for <strong>{id}</strong></p>; }
function TextStub({id})  { return <p>Text page (stub) for <strong>{id}</strong></p>; }
function CompareStub({ids}){ return <p>Compare page (stub): {ids.join(', ') || '(none)'}</p>; }

function App() {
  const route = useRoute();
  if (route.name === 'detail')  return <DetailStub id={route.id}/>;
  if (route.name === 'text')    return <TextStub id={route.id}/>;
  if (route.name === 'compare') return <CompareStub ids={route.ids}/>;
  return <BrowseStub/>;
}

export default App;
```

- [ ] **Step 5: Run smoke test manually**

```bash
npm run serve &
SERVER_PID=$!
sleep 2
for path in "" "#/license/mit" "#/license/mit/text" "#/compare?set=mit,gpl-3.0"; do
  echo "-- http://localhost:8080/$path"
done
# Visit each in a browser; confirm the correct stub renders.
kill $SERVER_PID
```

- [ ] **Step 6: Commit**

```bash
git add app.jsx scripts/router.mjs tests/router.test.mjs
git commit -m "feat: hash router with four stub routes"
git push origin master
```

---

## Phase B — Data pipeline foundations

### Task 7: Sentence tokenizer (pure function, TDD)

**Files:**
- Create: `scripts/tokenizer.mjs`
- Create: `tests/tokenizer.test.mjs`

- [ ] **Step 1: Write failing tests — `tests/tokenizer.test.mjs`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeToHtml, extractSentences } from '../scripts/tokenizer.mjs';

test('splits on period with space', () => {
  const { html, sentences } = tokenizeToHtml('First. Second. Third.');
  assert.equal(sentences.length, 3);
  assert.ok(html.includes('id="s-0"'));
  assert.ok(html.includes('id="s-1"'));
  assert.ok(html.includes('id="s-2"'));
});

test('does not split on abbreviations', () => {
  const { sentences } = tokenizeToHtml('See Dr. Smith. Then go.');
  assert.equal(sentences.length, 2);
  assert.equal(sentences[0], 'See Dr. Smith.');
});

test('preserves newlines between paragraphs', () => {
  const { html } = tokenizeToHtml('A.\n\nB.');
  assert.match(html, /id="s-0"[^<]*A\./);
  assert.match(html, /id="s-1"[^<]*B\./);
  assert.match(html, /<br><br>|\n\n/);
});

test('idempotent: re-tokenizing same text produces same IDs', () => {
  const t = 'One. Two. Three.';
  const a = tokenizeToHtml(t);
  const b = tokenizeToHtml(t);
  assert.equal(a.html, b.html);
});

test('handles question and exclamation marks', () => {
  const { sentences } = tokenizeToHtml('What? Yes! Go.');
  assert.equal(sentences.length, 3);
});

test('extractSentences pulls plain text back from html', () => {
  const { html } = tokenizeToHtml('Alpha. Beta.');
  assert.deepEqual(extractSentences(html), ['Alpha.', 'Beta.']);
});

test('single sentence without terminator still gets id', () => {
  const { sentences } = tokenizeToHtml('Just one sentence');
  assert.equal(sentences.length, 1);
  assert.equal(sentences[0], 'Just one sentence');
});
```

- [ ] **Step 2: Run tests; confirm they all fail**

```bash
npm test
```
Expected: tokenizer tests fail with "Cannot find module".

- [ ] **Step 3: Implement `scripts/tokenizer.mjs`**

```javascript
const ABBREVS = new Set([
  'Mr', 'Mrs', 'Ms', 'Dr', 'Jr', 'Sr', 'St',
  'Inc', 'Ltd', 'Co', 'Corp',
  'vs', 'etc', 'e.g', 'i.e', 'cf', 'al',
  'U.S', 'U.K', 'U.N'
]);

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function splitSentences(text) {
  const out = [];
  let buf = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    buf += ch;
    if (ch === '.' || ch === '!' || ch === '?') {
      const tail = buf.trimEnd();
      const prevWord = tail.slice(0, -1).split(/[\s]/).pop() || '';
      const next = text[i + 1];
      const isEnd = !next || /[\s\n]/.test(next);
      if (ch === '.' && ABBREVS.has(prevWord)) {
        i++; continue;
      }
      if (isEnd) {
        out.push(buf.trim());
        buf = '';
        while (text[i + 1] === ' ' || text[i + 1] === '\n') { buf += text[i + 1]; i++; }
      }
    }
    i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export function tokenizeToHtml(text) {
  const sentences = splitSentences(text);
  const parts = [];
  let joinBetween = '';
  sentences.forEach((s, idx) => {
    parts.push(joinBetween);
    parts.push(`<span id="s-${idx}" class="sentence">${escapeHtml(s)}</span>`);
    joinBetween = ' ';
  });
  const paragraphSplit = text.split(/\n\s*\n/).length > 1;
  const html = paragraphSplit
    ? sentences.map((s, idx) => `<span id="s-${idx}" class="sentence">${escapeHtml(s)}</span>`).join('<br><br>')
    : parts.join('');
  return { html, sentences };
}

export function extractSentences(html) {
  return [...html.matchAll(/<span[^>]*id="s-\d+"[^>]*>([\s\S]*?)<\/span>/g)]
    .map(m => m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
}
```

- [ ] **Step 4: Run tests; confirm all pass**

```bash
npm test
```
Expected: all 17 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/tokenizer.mjs tests/tokenizer.test.mjs
git commit -m "feat: sentence tokenizer with idempotent IDs"
```

---

### Task 8: Seed MIT license end-to-end (proof of the model)

**Files:**
- Create: `licenses/mit/text.raw.txt`
- Create: `licenses/mit/meta.json`
- Create: `licenses/mit/text.html`
- Create: `licenses/mit/features.json`
- Create: `licenses/mit/.progress.json`
- Modify: `licenses/index.json`
- Create: `scripts/seed-mit.mjs` (helper for reproducible seeding)

- [ ] **Step 1: Write `scripts/seed-mit.mjs` that builds meta + text.html from raw text**

```javascript
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { tokenizeToHtml } from './tokenizer.mjs';

const raw = await fs.readFile('licenses/mit/text.raw.txt', 'utf8');
const sha = crypto.createHash('sha256').update(raw).digest('hex');

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
    retrieved_at: '2026-04-21T14:00:00Z',
    sha256: sha
  },
  references: [
    { source: 'OSI',            url: 'https://opensource.org/license/mit',         retrieved_at: '2026-04-21T14:00:00Z' },
    { source: 'TLDR Legal',     url: 'https://tldrlegal.com/license/mit-license',  retrieved_at: '2026-04-21T14:00:00Z' },
    { source: 'choosealicense', url: 'https://choosealicense.com/licenses/mit/',   retrieved_at: '2026-04-21T14:00:00Z' }
  ]
};
await fs.writeFile('licenses/mit/meta.json', JSON.stringify(meta, null, 2) + '\n');

const { html } = tokenizeToHtml(raw);
await fs.writeFile('licenses/mit/text.html', html + '\n');

console.log('MIT seed complete. sha256=', sha);
```

- [ ] **Step 2: Write the raw text**

Save the canonical MIT text to `licenses/mit/text.raw.txt` (paste the standard MIT License text, substituting a placeholder copyright holder line).

- [ ] **Step 3: Run the seed**

```bash
node scripts/seed-mit.mjs
```
Expected: prints the computed sha256. `licenses/mit/meta.json` and `licenses/mit/text.html` are written.

- [ ] **Step 4: Hand-author `licenses/mit/features.json`**

**First open `licenses/mit/text.html` and list the sentence IDs that are actually present.** The example below assumes `s-0` through `s-3` exist; adjust the `sentence_id` values in every citation to match the real IDs in your generated HTML.

```json
{
  "permissions": [
    { "key": "commercial-use", "value": "permitted", "citations": [{ "sentence_id": "s-1" }], "external_references": [] },
    { "key": "modification",   "value": "permitted", "citations": [{ "sentence_id": "s-1" }], "external_references": [] },
    { "key": "distribution",   "value": "permitted", "citations": [{ "sentence_id": "s-1" }], "external_references": [] },
    { "key": "private-use",    "value": "permitted", "citations": [{ "sentence_id": "s-1" }], "external_references": [] },
    { "key": "patent-use",     "value": "silent", "citations": [], "external_references": [] }
  ],
  "conditions": [
    { "key": "include-copyright",    "value": "required", "citations": [{ "sentence_id": "s-2" }], "external_references": [] },
    { "key": "document-changes",     "value": "silent", "citations": [], "external_references": [] },
    { "key": "disclose-source",      "value": "silent", "citations": [], "external_references": [] },
    { "key": "network-use-disclose", "value": "silent", "citations": [], "external_references": [] },
    { "key": "same-license",         "value": "silent", "citations": [], "external_references": [] },
    { "key": "attribution",          "value": "required", "citations": [{ "sentence_id": "s-2" }], "external_references": [] }
  ],
  "limitations": [
    { "key": "liability", "value": "forbidden", "citations": [{ "sentence_id": "s-3" }], "external_references": [] },
    { "key": "warranty",  "value": "forbidden", "citations": [{ "sentence_id": "s-3" }], "external_references": [] },
    { "key": "trademark", "value": "silent", "citations": [], "external_references": [] }
  ],
  "sources": [
    { "source": "license text", "url": "licenses/mit/text.html", "role": "primary evidence" }
  ]
}
```

- [ ] **Step 5: Write `.progress.json`**

```json
{
  "lookup_license":   { "status": "complete", "updated_at": "2026-04-21T14:00:00Z" },
  "extract_features": { "status": "complete", "updated_at": "2026-04-21T14:15:00Z" },
  "deep_analysis":    { "status": "pending",  "updated_at": "2026-04-21T14:00:00Z" }
}
```

- [ ] **Step 6: Update `licenses/index.json`**

```json
[
  { "id": "mit", "name": "MIT License", "spdx": "MIT",
    "medium": "software", "archetype": "permissive",
    "blurb": "Shortest permissive license — commercial and proprietary use permitted with attribution.",
    "tags": ["permissive", "attribution"] }
]
```

- [ ] **Step 7: Run validator**

```bash
npm run validate
```
Expected: `✓ validate OK`. If errors report citation IDs not in `text.html`, adjust the sentence IDs in features.json to match IDs that actually exist.

- [ ] **Step 8: Commit**

```bash
git add licenses/ scripts/seed-mit.mjs
git commit -m "feat: seed MIT license end-to-end (meta, text, features, progress)"
git push origin master
```

---

## Phase C — UI completion

### Task 9: Browse page (filter sidebar, search, table, compare tray)

**Files:**
- Modify: `app.jsx`
- Modify: `licenses.css`

- [ ] **Step 1: Add compare-state hook + URL sync to `app.jsx`**

Replace the body of `app.jsx` above `export default App;` with (keep imports and the router bits from Task 6):

```jsx
function useCompareSet() {
  // On the browse page the compare set is local-only; it becomes URL-canonical
  // only when the user navigates to #/compare?set=… via the tray link.
  const [set, setSet] = useState([]);
  const toggle = (id) => setSet(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const clear = () => setSet([]);
  return { set, toggle, clear, setSet };
}

function useCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    fetch('licenses/index.json').then(r => r.json()).then(setCatalog).catch(e => setErr(String(e)));
  }, []);
  return { catalog, err };
}

function FilterSidebar({ catalog, filters, setFilters }) {
  const mediums = [...new Set(catalog.map(l => l.medium))];
  const archetypes = [...new Set(catalog.map(l => l.archetype))];
  const toggleSet = (key, v) => {
    const cur = new Set(filters[key]);
    cur.has(v) ? cur.delete(v) : cur.add(v);
    setFilters({ ...filters, [key]: [...cur] });
  };
  const Group = ({ title, name, values }) => (
    <div className="filter-group">
      <div className="filter-h">{title}</div>
      {values.map(v => {
        const on = filters[name].includes(v);
        const count = catalog.filter(l => l[name] === v).length;
        return (
          <label key={v} className="filter-item">
            <input type="checkbox" checked={on} onChange={() => toggleSet(name, v)}/>
            <span>{v}</span><span className="count">{count}</span>
          </label>
        );
      })}
    </div>
  );
  return (
    <aside className="filter-panel">
      <Group title="Medium"    name="medium"    values={mediums}/>
      <Group title="Archetype" name="archetype" values={archetypes}/>
    </aside>
  );
}

function BrowsePage() {
  const { catalog, err } = useCatalog();
  const { set, toggle } = useCompareSet();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ medium: [], archetype: [] });

  if (err) return <p style={{color:'#f87171'}}>Error: {err}</p>;
  if (!catalog) return <p>Loading…</p>;

  const rows = catalog.filter(l => {
    if (filters.medium.length    && !filters.medium.includes(l.medium))       return false;
    if (filters.archetype.length && !filters.archetype.includes(l.archetype)) return false;
    if (q) {
      const needle = q.toLowerCase();
      return l.name.toLowerCase().includes(needle) ||
             l.blurb.toLowerCase().includes(needle) ||
             l.tags.some(t => t.toLowerCase().includes(needle));
    }
    return true;
  });

  return (
    <div className="browse">
      <FilterSidebar catalog={catalog} filters={filters} setFilters={setFilters}/>
      <div className="browse-main">
        <input className="search" placeholder="Search licenses, features, keywords…"
               value={q} onChange={e => setQ(e.target.value)}/>
        <table className="brz">
          <thead><tr><th></th><th>Name</th><th>Archetype</th><th>Medium</th><th>Tags</th></tr></thead>
          <tbody>
            {rows.map(l => (
              <tr key={l.id}>
                <td><input type="checkbox" checked={set.includes(l.id)} onChange={() => toggle(l.id)}/></td>
                <td><a href={`#/license/${l.id}`}>{l.name}</a></td>
                <td>{l.archetype}</td>
                <td>{l.medium}</td>
                <td>{l.tags.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {set.length > 0 && (
          <div className="cmp-tray">
            <span>Comparing ({set.length}): {set.join(', ')}</span>
            <a href={`#/compare?set=${set.join(',')}`} className="cmp-go">Compare →</a>
          </div>
        )}
      </div>
    </div>
  );
}
```

Then wire `BrowsePage` into `App()` replacing `BrowseStub`:

```jsx
function App() {
  const route = useRoute();
  if (route.name === 'detail')  return <DetailStub id={route.id}/>;
  if (route.name === 'text')    return <TextStub id={route.id}/>;
  if (route.name === 'compare') return <CompareStub ids={route.ids}/>;
  return <BrowsePage/>;
}
```

- [ ] **Step 2: Add CSS to `licenses.css`**

Append:

```css
.browse { display: grid; grid-template-columns: 200px 1fr; gap: 1rem; }
.filter-panel { background: var(--code-bg, #0f172a); padding: 0.75rem; border-radius: 6px; font-size: 0.85rem; }
.filter-group { margin-bottom: 0.75rem; }
.filter-h { color: var(--muted, #9ca3af); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
.filter-item { display: flex; justify-content: space-between; align-items: center; padding: 0.15rem 0; cursor: pointer; }
.filter-item input[type="checkbox"] { margin-right: 0.4rem; }
.count { color: var(--muted, #6b7280); font-size: 0.75rem; }
.search { width: 100%; background: var(--code-bg, #0f172a); border: 1px solid var(--border, #374151); color: var(--text, #eee); padding: 0.4rem 0.6rem; border-radius: 4px; margin-bottom: 0.75rem; font-size: 0.9rem; }
.brz { width: 100%; border-collapse: collapse; }
.brz th, .brz td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border, #1f2937); }
.brz th { color: var(--muted, #9ca3af); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; }
.cmp-tray { position: sticky; bottom: 0; background: var(--surface, #1a1a1a); border-top: 1px solid var(--border, #374151); padding: 0.5rem 1rem; display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; }
.cmp-go { background: var(--link, #7dd3fc); color: #0a0a0a; padding: 0.25rem 0.75rem; border-radius: 4px; text-decoration: none; font-weight: 600; }
```

- [ ] **Step 3: Serve and verify**

```bash
npm run serve &
SERVER_PID=$!
sleep 2
curl -sf http://localhost:8080/ | grep -q 'id="root"' && echo "ok shell"
kill $SERVER_PID
```

Open `http://localhost:8080/` in a browser. Verify: filter sidebar on the left, search box, one row for MIT, checkbox works, tray shows at the bottom when the row is checked, "Compare →" link routes to `#/compare?set=mit`.

- [ ] **Step 4: Commit**

```bash
git add app.jsx licenses.css
git commit -m "feat: browse page with filters, search, and compare tray"
git push origin master
```

---

### Task 10: Detail page

**Files:**
- Modify: `app.jsx`

- [ ] **Step 1: Add `DetailPage` component to `app.jsx`**

Replace `DetailStub` with:

```jsx
function DetailPage({ id }) {
  const [meta, setMeta]   = useState(null);
  const [feats, setFeats] = useState(null);
  const [err, setErr]     = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`licenses/${id}/meta.json`).then(r => r.ok ? r.json() : Promise.reject(`meta ${r.status}`)),
      fetch(`licenses/${id}/features.json`).then(r => r.ok ? r.json() : Promise.reject(`features ${r.status}`))
    ]).then(([m, f]) => { setMeta(m); setFeats(f); }).catch(e => setErr(String(e)));
  }, [id]);

  if (err) return <p style={{color:'#f87171'}}>Error: {err}</p>;
  if (!meta || !feats) return <p>Loading…</p>;

  const Row = ({ e, group }) => (
    <tr>
      <td>{e.key}</td>
      <td><ValueBadge v={e.value}/></td>
      <td>{e.citations.map(c => <a key={c.sentence_id} href={`#/license/${id}/text?s=${c.sentence_id}`}>{c.sentence_id}</a>)}</td>
      <td>{e.commentary || ''}</td>
    </tr>
  );

  return (
    <div>
      <p><a href="#/">← All licenses</a></p>
      <h2>{meta.name}</h2>
      <p className="meta">{meta.medium} · {meta.archetype} {meta.spdx && `· SPDX: ${meta.spdx}`}</p>
      <p><a href={`#/license/${id}/text`}>View full text →</a></p>
      <h3>Permissions</h3>
      <table className="feat-table"><tbody>{feats.permissions.map(e => <Row key={e.key} e={e} group="permissions"/>)}</tbody></table>
      <h3>Conditions</h3>
      <table className="feat-table"><tbody>{feats.conditions.map(e => <Row key={e.key} e={e} group="conditions"/>)}</tbody></table>
      <h3>Limitations</h3>
      <table className="feat-table"><tbody>{feats.limitations.map(e => <Row key={e.key} e={e} group="limitations"/>)}</tbody></table>
      <h3>References</h3>
      <ul>{meta.references.map(r => <li key={r.url}><a href={r.url} target="_blank" rel="noopener">{r.source}</a></li>)}</ul>
    </div>
  );
}

function ValueBadge({ v }) {
  const styles = {
    permitted:   { bg: 'rgba(74,222,128,.15)', color: '#4ade80', label: '✓ permitted' },
    required:    { bg: 'rgba(250,204,21,.15)', color: '#facc15', label: '! required' },
    forbidden:   { bg: 'rgba(248,113,113,.15)', color: '#f87171', label: '✗ forbidden' },
    silent:      { bg: 'transparent', color: '#6b7280', label: '— silent' },
    grey:        { bg: 'rgba(156,163,175,.18)', color: '#9ca3af', label: '? grey area' },
    not_assessed:{ bg: 'transparent', color: '#4b5563', label: '· not assessed' }
  }[v];
  return <span className="val" style={{ background: styles.bg, color: styles.color }}>{styles.label}</span>;
}
```

Replace the router branch `<DetailStub ...>` with `<DetailPage id={route.id}/>`.

- [ ] **Step 2: Add CSS**

Append to `licenses.css`:
```css
.feat-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
.feat-table td { padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--border, #1f2937); font-size: 0.9rem; }
.val { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 500; }
.meta { color: var(--muted, #9ca3af); font-size: 0.9rem; }
```

- [ ] **Step 3: Verify**

```bash
npm run serve &
SERVER_PID=$!
sleep 2
curl -sf http://localhost:8080/#/license/mit
kill $SERVER_PID
```

Open `http://localhost:8080/#/license/mit` in a browser. Confirm the permissions/conditions/limitations tables render with value badges and citation sentence IDs link to the text view.

- [ ] **Step 4: Commit**

```bash
git add app.jsx licenses.css
git commit -m "feat: license detail page with value badges and citations"
```

---

### Task 11: Text viewer with :target highlight

**Files:**
- Modify: `app.jsx`
- Modify: `licenses.css`

- [ ] **Step 1: Add `TextPage` component**

Replace `TextStub` with:

```jsx
function TextPage({ id }) {
  const [html, setHtml] = useState(null);
  const [err, setErr]   = useState(null);

  useEffect(() => {
    fetch(`licenses/${id}/text.html`).then(r => r.ok ? r.text() : Promise.reject(`HTTP ${r.status}`))
      .then(setHtml).catch(e => setErr(String(e)));
  }, [id]);

  useEffect(() => {
    // Parse ?s= from the hash and scroll to it.
    const m = location.hash.match(/[?&]s=(s-\d+)/);
    if (m && html) {
      setTimeout(() => {
        const el = document.getElementById(m[1]);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('pulse'); }
      }, 50);
    }
  }, [html]);

  if (err) return <p style={{color:'#f87171'}}>Error: {err}</p>;
  if (!html) return <p>Loading…</p>;

  return (
    <div>
      <p><a href={`#/license/${id}`}>← Back to {id}</a></p>
      <article className="license-text" dangerouslySetInnerHTML={{ __html: html }}/>
    </div>
  );
}
```

Wire to the router: replace `<TextStub ...>` with `<TextPage id={route.id}/>`.

- [ ] **Step 2: Add CSS**

Append to `licenses.css`:
```css
.license-text { font-family: Georgia, serif; line-height: 1.6; font-size: 1rem; }
.license-text .sentence { padding: 0 1px; border-radius: 2px; }
.license-text .sentence:target,
.license-text .sentence.pulse { background: #facc1555; outline: 1px solid #facc15; animation: pulse 1.5s ease-out; }
@keyframes pulse { 0% { background: #facc15aa; } 100% { background: #facc1533; } }
```

- [ ] **Step 3: Verify**

```bash
npm run serve &
SERVER_PID=$!
sleep 2
kill $SERVER_PID
```

Open `http://localhost:8080/#/license/mit/text?s=s-2` and confirm the target sentence is highlighted and scrolled into view.

- [ ] **Step 4: Commit**

```bash
git add app.jsx licenses.css
git commit -m "feat: text viewer with sentence-level highlight via :target"
git push origin master
```

---

### Task 12: Compare page with add, remove, reorder

**Files:**
- Modify: `app.jsx`
- Modify: `licenses.css`

- [ ] **Step 1: Add `ComparePage`**

Replace `CompareStub` with:

```jsx
function ComparePage({ ids }) {
  const [catalog, setCatalog] = useState(null);
  const [data, setData]       = useState({});
  const [order, setOrder]     = useState(ids);
  const [expanded, setExpanded] = useState({}); // key: group:feature

  useEffect(() => { setOrder(ids); }, [ids.join(',')]);

  useEffect(() => {
    fetch('licenses/index.json').then(r => r.json()).then(setCatalog);
  }, []);

  useEffect(() => {
    const missing = order.filter(id => !data[id]);
    if (missing.length === 0) return;
    Promise.all(missing.map(id =>
      Promise.all([
        fetch(`licenses/${id}/meta.json`).then(r => r.json()),
        fetch(`licenses/${id}/features.json`).then(r => r.json())
      ]).then(([meta, feat]) => [id, { meta, feat }])
    )).then(results => {
      setData(d => { const next = { ...d }; for (const [id, v] of results) next[id] = v; return next; });
    });
  }, [order.join(',')]);

  const updateHash = (next) => { location.hash = '#/compare?set=' + next.join(','); };
  const removeCol  = (id) => { const next = order.filter(x => x !== id); updateHash(next); };
  const addCol     = (id) => { if (order.includes(id)) return; const next = [...order, id]; updateHash(next); };
  const moveCol    = (from, to) => {
    if (from === to) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    updateHash(next);
  };

  if (!catalog) return <p>Loading…</p>;
  if (order.length === 0) return <p>No licenses selected. <a href="#/">Go browse →</a></p>;

  const vocabGroups = ['permissions', 'conditions', 'limitations'];
  // Build the row list from the first loaded license's features, in vocab order.
  const firstLoaded = order.find(id => data[id]);
  if (!firstLoaded) return <p>Loading licenses…</p>;
  const rowsByGroup = {};
  for (const g of vocabGroups) {
    rowsByGroup[g] = data[firstLoaded].feat[g].map(e => e.key);
  }

  const findEntry = (id, g, key) => {
    const f = data[id]?.feat;
    if (!f) return null;
    return f[g].find(e => e.key === key) || { key, value: 'not_assessed', citations: [], external_references: [] };
  };

  const toggleExpand = (g, key) => setExpanded(x => ({ ...x, [`${g}:${key}`]: !x[`${g}:${key}`] }));

  const available = catalog.filter(c => !order.includes(c.id));

  return (
    <div>
      <p><a href="#/">← All licenses</a></p>
      <h2>Compare</h2>
      <table className="cmp-table">
        <thead>
          <tr>
            <th></th>
            {order.map((id, i) => (
              <th key={id} draggable onDragStart={e => e.dataTransfer.setData('from', i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => moveCol(Number(e.dataTransfer.getData('from')), i)}>
                <span style={{cursor:'grab'}}>≡</span>
                <a href={`#/license/${id}`}>{data[id]?.meta?.name || id}</a>
                <button onClick={() => removeCol(id)} aria-label={`remove ${id}`} style={{marginLeft:'0.5rem'}}>×</button>
              </th>
            ))}
            <th>
              {available.length > 0 && (
                <select onChange={e => { if (e.target.value) { addCol(e.target.value); e.target.value = ''; }}}
                        defaultValue="">
                  <option value="">+ add</option>
                  {available.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {vocabGroups.map(g => (
            <>
              <tr key={`h-${g}`}><td colSpan={order.length + 2} className="group-h">{g}</td></tr>
              {rowsByGroup[g].map(key => {
                const isOpen = expanded[`${g}:${key}`];
                return (
                  <>
                    <tr key={`${g}-${key}`}>
                      <td className="feat-label">{key}
                        <button className="cite-btn" onClick={() => toggleExpand(g, key)}>¶</button>
                      </td>
                      {order.map(id => {
                        const e = findEntry(id, g, key);
                        return <td key={id}><ValueBadge v={e.value}/></td>;
                      })}
                      <td></td>
                    </tr>
                    {isOpen && (
                      <tr key={`${g}-${key}-exp`} className="cite-row">
                        <td colSpan={order.length + 2}>
                          <div className="cite-expanded">
                            {order.map(id => {
                              const e = findEntry(id, g, key);
                              if (!e.citations.length && !e.external_references.length) {
                                return <div key={id} className="cite-entry"><strong>{id}</strong><em>No matching language in text.</em></div>;
                              }
                              return (
                                <div key={id} className="cite-entry">
                                  <strong>{id}</strong>
                                  <div>
                                    {e.citations.map(c => (
                                      <div key={c.sentence_id}>
                                        <a href={`#/license/${id}/text?s=${c.sentence_id}`} target="_blank" rel="noopener">↗ {c.sentence_id}</a>
                                        {c.note && <span> — {c.note}</span>}
                                      </div>
                                    ))}
                                    {e.external_references.map((r, i) => (
                                      <div key={i}>
                                        <a href={r.url} target="_blank" rel="noopener">↗ {r.source}</a>
                                        {r.excerpt && <blockquote>"{r.excerpt}"</blockquote>}
                                      </div>
                                    ))}
                                    {e.commentary && <p className="commentary">{e.commentary}</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Wire: replace `<CompareStub ...>` with `<ComparePage ids={route.ids}/>`.

- [ ] **Step 2: Add CSS**

Append to `licenses.css`:
```css
.cmp-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.cmp-table th, .cmp-table td { padding: 0.4rem 0.6rem; border: 1px solid var(--border, #1f2937); vertical-align: top; }
.cmp-table .group-h { background: var(--surface, #111); color: var(--muted, #9ca3af); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; font-weight: 500; }
.cmp-table .feat-label { color: var(--muted, #aaa); }
.cite-btn { background: none; border: none; color: var(--link, #7dd3fc); cursor: pointer; margin-left: 0.3rem; font-size: 0.8rem; opacity: 0.6; }
.cite-btn:hover { opacity: 1; }
.cite-expanded { background: var(--code-bg, #0d1520); border-left: 2px solid var(--link, #7dd3fc); padding: 0.6rem; }
.cite-entry { display: grid; grid-template-columns: 110px 1fr; gap: 0.75rem; padding: 0.4rem 0; border-top: 1px solid var(--border, #1e293b); }
.cite-entry:first-child { border-top: none; }
.cite-entry blockquote { margin: 0.25rem 0; padding-left: 0.5rem; border-left: 2px solid var(--warning, #facc15); color: var(--muted, #cbd5e1); font-style: italic; font-size: 0.85rem; }
.commentary { color: var(--muted, #9ca3af); font-size: 0.85rem; margin-top: 0.4rem; }
```

- [ ] **Step 3: Verify**

Open `http://localhost:8080/#/compare?set=mit` in a browser. Add a second license via the "+ add" dropdown (you'll need a second seeded license first; if only MIT is seeded, that's expected and the dropdown will be empty). Confirm remove (×) works and URL updates.

- [ ] **Step 4: Commit**

```bash
git add app.jsx licenses.css
git commit -m "feat: compare page with add/remove/drag-reorder and inline citations"
git push origin master
```

---

## Phase D — Skills & automation

### Task 13: `lookup-license` skill

**Files:**
- Create: `.claude/skills/lookup-license/SKILL.md`

- [ ] **Step 1: Write the skill**

```markdown
---
name: lookup-license
description: Given a rough license name or description, disambiguate it, fetch its canonical text, and write the initial license entry (meta.json, text.raw.txt, index.json stub, .progress.json). Idempotent — resumes gracefully if any step was already done.
---

# lookup-license

## Inputs
- A rough license name, SPDX identifier, or descriptive phrase (e.g. "mit", "agpl", "the one Google uses for Go").

## Outputs (all under `licenses/<id>/`)
1. `text.raw.txt` — byte-for-byte canonical license text.
2. `meta.json` — identity, SPDX id, medium, archetype, canonical_url, text_provenance {source_url, retrieved_at, sha256}, references[].
3. Stub entry appended to `licenses/index.json`.
4. `.progress.json` — initialize if missing; set `lookup_license.status = complete` on success.

## Procedure

1. **Disambiguate the name.** Consult these in order: OSI list (opensource.org/licenses), SPDX license list (spdx.org/licenses), TLDR Legal (tldrlegal.com). Produce a canonical `id` (lowercased kebab-case of SPDX id, e.g. `mit`, `apache-2.0`, `cc-by-sa-4.0`).

2. **Read existing `.progress.json` if present.** If `lookup_license.status` is `complete`, print `✓ lookup-license already complete for <id>` and stop.

3. **Fetch canonical text.** Preferred source order: OSI canonical page → SPDX text → creativecommons.org for CC licenses → gnu.org for GPL/AGPL/LGPL. Save verbatim to `licenses/<id>/text.raw.txt` (UTF-8, Unix line endings, trailing newline). Use `WebFetch` and save the raw text only (not the HTML chrome).

4. **Compute sha256** of the raw text and build `meta.json` per the schema in `schemas/meta.schema.json`. `retrieved_at` is the current UTC ISO-8601 timestamp. `references` must include **all** sources you actually used — OSI, TLDR Legal, canonical url, and anything else consulted; each entry needs `source`, `url`, `retrieved_at`, and optional `note`.

5. **Append to `licenses/index.json`** with `id`, `name`, `spdx`, `medium`, `archetype`, a ≤280 char `blurb`, and `tags[]`.

6. **Write `.progress.json`** using write-temp-then-rename (atomic). Leave `extract_features` and `deep_analysis` as `pending`.

7. **Validate.** Run `npm run validate`. If any error, leave written artifacts in place and set `lookup_license.status = failed`, `last_error` to the validator output; do not raise, return so the orchestrator can handle it.

## Required sourcing

- `meta.json.references` must list every site you consulted to produce this entry, with `retrieved_at` timestamps.
- If the canonical text appears in multiple authoritative places (e.g. OSI and SPDX), prefer OSI and note SPDX in references.
- Never synthesize or paraphrase text into `text.raw.txt`. It is byte-for-byte.

## Atomic writes

```
write path.tmp → fsync → rename to path
```

Always. Applies to every JSON file this skill produces.

## Failure modes
- Network error mid-fetch: `text.raw.txt` is not written; state stays `pending`.
- Ambiguous name: ask the user via AskUserQuestion before fetching.
- Validator fails after write: mark `failed` and stop; the user can fix the JSON by hand or re-run `--retry`.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/lookup-license/
git commit -m "feat(skill): lookup-license"
```

---

### Task 14: `extract-features` skill

**Files:**
- Create: `.claude/skills/extract-features/SKILL.md`

- [ ] **Step 1: Write the skill**

```markdown
---
name: extract-features
description: Given a license id, tokenize the raw text into text.html (stable s-N sentence ids), then read each vocabulary feature from schemas/feature-vocabulary.json and populate features.json with value + sentence citations + external references. Resumable per feature via .progress.json.
---

# extract-features

## Inputs
- License `id` (required).
- Optional `--feature=<key>` flag to scope the run to one feature key (used by /backfill-feature).

## Outputs (under `licenses/<id>/`)
- `text.html` — one `<span id="s-N" class="sentence">…</span>` per sentence, IDs contiguous from 0.
- `features.json` — entries in `permissions`, `conditions`, `limitations` with value + citations[] + external_references[] + optional commentary.
- `.progress.json` — `extract_features.status`, `completed_keys[]`, `remaining_keys[]`, `last_error`, `updated_at`.

## Procedure

1. **Read `.progress.json`.** If `extract_features.status === "complete"`, print `✓ already complete` and stop. If `partial`, read `completed_keys` to skip what's done.

2. **Tokenize text (idempotent).** Call `node scripts/tokenizer.mjs <id>` (or import `tokenizeToHtml` inside Node). If `text.html` already exists and its content matches a re-tokenization of `text.raw.txt`, leave it alone. Otherwise overwrite. The tokenizer is deterministic, so IDs are stable across runs.

3. **Load the vocabulary** from `schemas/feature-vocabulary.json`. Build the ordered list of all feature keys.

4. **Determine keys to process:** `keys_to_process = requested (if --feature) else (vocab_keys - completed_keys)`.

5. **For each key in keys_to_process:**
    a. Read the license text, identify the sentence(s) from `text.html` that address this feature. If none, `value = silent`, `citations = []`.
    b. Decide the value: `permitted | required | forbidden | silent | grey`. Never use `not_assessed` from this skill — that value is reserved for vocabulary keys that have never been processed.
    c. If the determination depends on **any source other than the license text itself** (commentary, FSF FAQ, Luis Villa post, etc.), populate `external_references` with full provenance: `source`, `url`, `retrieved_at`, and either `excerpt` (verbatim quote) or `summary` (paraphrase).
    d. For `value === "grey"` or non-empty `commentary`, you **MUST** provide at least one citation or external reference. CI will reject otherwise.
    e. Write the entry into the correct group in `features.json` (atomic temp+rename).
    f. Append the key to `completed_keys` and remove from `remaining_keys` in `.progress.json` (atomic temp+rename). These two writes must both land before moving to the next key; if only the features.json write succeeded and the progress write didn't, the next run will reprocess the key and overwrite — which is acceptable because the write is deterministic.

6. **Aggregate `sources[]`** at the end: collect every distinct external source used anywhere in the file into the file-level `sources` array.

7. **Mark complete.** If `keys_to_process` exhausted without error, set `extract_features.status = complete`. If `--feature` was scoped, only flip to complete when `completed_keys` covers the full vocabulary.

8. **Validate.** Run `npm run validate`. On failure, set `status = failed`, write `last_error`, leave completed keys intact so a re-run continues.

## Required sourcing

- Every `grey` value or non-empty commentary MUST cite at least one of: a sentence from `text.html` (via `citations`) OR an external reference with full provenance.
- External references must include `source`, `url`, `retrieved_at`, and one of `excerpt`/`summary`.
- If your interpretation comes from a skill-level system prompt or your own general knowledge, that is NOT a source. Find a citable text before asserting a value.

## Tokenizer guarantees

- `scripts/tokenizer.mjs` is idempotent: tokenizing the same `text.raw.txt` twice yields the same `text.html` byte-for-byte.
- Sentence IDs are dense (`s-0, s-1, …, s-N`) with no gaps.
- CI validates both properties.

## Failure modes
- A feature key is genuinely ambiguous and no citable source exists → set `value = grey` with commentary explaining the ambiguity and cite the closest available reference (e.g., TLDR Legal's note on the same question). Never omit sourcing.
- Tokenizer collapses on a surprising abbreviation → add the abbreviation to `ABBREVS` in `scripts/tokenizer.mjs`, re-run; IDs remain stable for unaffected sentences.
- Write fails mid-feature → the key is not marked complete; next run retries.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/extract-features/
git commit -m "feat(skill): extract-features with resumable per-key state"
```

---

### Task 15: `/add-license` orchestrator slash command

**Files:**
- Create: `.claude/commands/add-license.md`

- [ ] **Step 1: Write the command**

```markdown
---
description: Run the full license pipeline (lookup-license → extract-features → deep-analysis) for a rough license name, resuming gracefully from any partial state.
argument-hint: <rough license name>
allowed-tools: Skill, Read, Write, Edit, Bash
---

# /add-license $ARGUMENTS

Run the license ingestion pipeline for `$ARGUMENTS`. Resume from partial state; never redo completed work.

## Procedure

1. **Disambiguate** the rough name to a canonical `id` (use the same logic as `lookup-license` step 1; if ambiguous, ask via AskUserQuestion).

2. **Load (or initialize) `.progress.json`** at `licenses/<id>/.progress.json`.

3. **Stage 1 — lookup-license.**
   - If `lookup_license.status === "complete"`: print `✓ lookup-license: already done`.
   - Else: invoke the `lookup-license` skill with the disambiguated id.
   - On success: ensure `.progress.json.lookup_license.status = complete`.
   - On failure: stop, print the error, do not continue.
   - **Checkpoint:** tell the user what was produced and pause for confirmation before continuing. Ask: "Lookup complete. Continue to feature extraction?"

4. **Stage 2 — extract-features.**
   - If `extract_features.status === "complete"`: print `✓ extract-features: already done`.
   - Else (pending or partial): invoke the `extract-features` skill with the id. The skill itself resumes at the first non-complete key.
   - **Checkpoint:** list the feature values produced, any grey areas with commentary, and pause. Ask: "Extraction complete. Continue to deep analysis?" The user may choose to skip deep analysis (MVP already ships without it).

5. **Stage 3 — deep-analysis (optional).**
   - Same pattern: skip if complete, invoke otherwise.
   - **Checkpoint:** summarize and stop.

6. **Run `npm run validate`** after each stage. If it fails, record the error into the relevant stage's `last_error` and stop.

## Retry behavior

- If any stage is `failed`, running `/add-license <name>` again will attempt that stage from whatever partial state remains. If the failure is intrinsic (e.g. ambiguous grey area for a key), the user should fix the data by hand and clear `last_error` before re-running.

## Atomic writes

All JSON writes go through write-temp-then-rename. A crash mid-write never produces a truncated file.
```

- [ ] **Step 2: Run the command end-to-end on `apache-2.0`**

```
/add-license apache-2.0
```

Proceed through both checkpoints. Expected: `licenses/apache-2.0/{text.raw.txt, text.html, meta.json, features.json, .progress.json}` all written; `licenses/index.json` updated; `npm run validate` passes.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/add-license.md licenses/apache-2.0/ licenses/index.json
git commit -m "feat(cmd): /add-license orchestrator + apache-2.0 data"
git push origin master
```

---

### Task 16: `/backfill-feature` command

**Files:**
- Create: `.claude/commands/backfill-feature.md`

- [ ] **Step 1: Write the command**

```markdown
---
description: For a newly added feature key in schemas/feature-vocabulary.json, iterate every license in licenses/index.json and run extract-features --feature=<key> for each.
argument-hint: <feature-key>
allowed-tools: Skill, Read, Bash
---

# /backfill-feature $ARGUMENTS

1. Verify `$ARGUMENTS` exists in `schemas/feature-vocabulary.json`. If not, stop with an error.
2. Read `licenses/index.json`.
3. For each entry:
   - Invoke `extract-features` skill with id and `--feature=$ARGUMENTS`.
   - On failure for a single license, record and continue; do not abort the whole pass.
4. After all licenses, run `npm run validate`. Summarize results (succeeded / failed / skipped).
5. Commit with message `feat: backfill feature $ARGUMENTS across all licenses`.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/backfill-feature.md
git commit -m "feat(cmd): /backfill-feature orchestrator"
```

---

## Phase E — Populate remaining licenses

### Task 17: Run `/add-license` for the remaining 7 archetype licenses

**Files:**
- Generated: `licenses/<id>/*` for each of: `bsd-3-clause`, `mpl-2.0`, `lgpl-3.0`, `gpl-3.0`, `agpl-3.0`, `cc-by-4.0`, `cc-by-sa-4.0`.

- [ ] **Step 1: Run for each license**

For each id in the list above:

```
/add-license <id>
```

Proceed through checkpoints. When finished, verify:

```bash
npm run validate
```
Expected: `✓ validate OK` with all 9 licenses present.

- [ ] **Step 2: Commit each license as its own commit** (the orchestrator commits per stage; if it doesn't, commit manually with `feat: add <id> license data`).

- [ ] **Step 3: Push**

```bash
git push origin master
```

- [ ] **Step 4: Verify live**

Open `https://k1monfared.github.io/license_explorer/` and confirm all 9 licenses appear in the browse table; check that `#/compare?set=mit,gpl-3.0,cc-by-sa-4.0` renders a valid three-column comparison with citations.

---

## Phase F — Deep analysis

### Task 18: `deep-analysis` skill

**Files:**
- Create: `.claude/skills/deep-analysis/SKILL.md`

- [ ] **Step 1: Write the skill**

```markdown
---
name: deep-analysis
description: For a given license id, search public sources (CourtListener, FSF/Apache legal-discuss archives, Luis Villa's writing) for material that illuminates how the license works in practice. Write analysis.json with per-topic entries and full source provenance. Resumable.
---

# deep-analysis

## Inputs
- License `id`.

## Outputs (under `licenses/<id>/`)
- `analysis.json` per `schemas/analysis.schema.json`.
- `.progress.json`: update `deep_analysis` stage.

## Procedure

1. **Read `.progress.json`.** If `deep_analysis.status === "complete"`, stop. If `partial`, continue from where it left off (each entry is written atomically, so whatever's already in `analysis.json` stays).

2. **Determine topics to cover.** Start from features with `value === "grey"` in `features.json` (every grey area should have at least one analysis entry). Add topics found in the wild that aren't in the vocabulary (e.g., "enforcement history", "notable court cases") if meaningful cases exist.

3. **For each topic:**
    - **Search public sources only:**
      - CourtListener / RECAP (`https://www.courtlistener.com/api/`) for court filings.
      - FSF legal-discuss archives (publicly archived).
      - Apache legal-discuss archives.
      - Luis Villa's blog posts (lu.is and archive.org of prior domains).
      - Academic papers (open access).
    - **Do not** use private repositories, paid databases without authorized access, or any non-public documents.
    - **Write an entry** with:
        - `topic`: short string (prefer feature-vocabulary keys where applicable).
        - `summary`: ≤500 chars.
        - `sources[]`: minimum one entry; each entry has `source`, `url`, `retrieved_at`, and `excerpt` or `summary`.
    - **Write the entry atomically** into `analysis.json` (temp + rename). Do NOT buffer all entries and write at the end.

4. **After each successful entry**, update `.progress.json.deep_analysis.updated_at` and leave status `partial` until the topic list is exhausted, then set `complete`.

5. **Aggregate** file-level `sources[]` at the end (distinct source×url).

6. **Validate.** Run `npm run validate`. On failure, mark `failed` + `last_error`.

## Required sourcing

- Every entry needs ≥1 source. No exceptions.
- Every source must have `retrieved_at` and either `excerpt` or `summary`.
- Your own generalization of case law is not a source. Cite the case.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/deep-analysis/
git commit -m "feat(skill): deep-analysis"
```

---

### Task 19: `/refresh-analysis` command + run for all 9

**Files:**
- Create: `.claude/commands/refresh-analysis.md`
- Generated: `licenses/<id>/analysis.json` for all 9 licenses.

- [ ] **Step 1: Write the command**

```markdown
---
description: Run deep-analysis for a single license id (forces re-run even if status is complete).
argument-hint: <id>
allowed-tools: Skill, Read, Bash
---

# /refresh-analysis $ARGUMENTS

1. Clear `deep_analysis.status` in `licenses/$ARGUMENTS/.progress.json` to `pending`, preserving other stages.
2. Invoke the `deep-analysis` skill for `$ARGUMENTS`.
3. Run `npm run validate`.
4. Commit: `feat(analysis): refresh $ARGUMENTS`.
```

- [ ] **Step 2: Run for each license**

```
/refresh-analysis mit
/refresh-analysis apache-2.0
/refresh-analysis bsd-3-clause
/refresh-analysis mpl-2.0
/refresh-analysis lgpl-3.0
/refresh-analysis gpl-3.0
/refresh-analysis agpl-3.0
/refresh-analysis cc-by-4.0
/refresh-analysis cc-by-sa-4.0
```

- [ ] **Step 3: Verify + push**

```bash
npm run validate
git push origin master
```

- [ ] **Step 4: Add Deep Analysis section to the detail page**

In `app.jsx`, extend `DetailPage` to fetch `licenses/${id}/analysis.json` (treat 404 as "no analysis yet"); when present, render a "Deep analysis" section below References that groups entries by `topic`, renders each `summary`, and lists sources as external links.

```jsx
const [analysis, setAnalysis] = useState(null);
useEffect(() => {
  fetch(`licenses/${id}/analysis.json`)
    .then(r => r.ok ? r.json() : null).then(setAnalysis).catch(() => setAnalysis(null));
}, [id]);

// …after References section in the returned JSX:
{analysis && analysis.entries.length > 0 && (
  <>
    <h3>Deep analysis</h3>
    {analysis.entries.map((e, i) => (
      <section key={i} className="analysis-entry">
        <h4>{e.topic}</h4>
        <p>{e.summary}</p>
        <ul>{e.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noopener">{s.source}</a>{s.excerpt && <blockquote>"{s.excerpt}"</blockquote>}</li>)}</ul>
      </section>
    ))}
  </>
)}
```

Commit: `git commit -am "feat: deep-analysis section on detail page"`.

---

## Phase G — Final polish

### Task 20: GitHub Actions CI for validation

**Files:**
- Create: `.github/workflows/validate.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: validate
on:
  push:
    branches: [master]
  pull_request:
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm install
      - run: npm test
      - run: npm run validate
```

- [ ] **Step 2: Commit + verify**

```bash
git add .github/workflows/validate.yml
git commit -m "ci: run tests and validator on push/PR"
git push origin master
```

Check `https://github.com/k1monfared/license_explorer/actions` — the workflow should run and succeed.

---

### Task 21: Final smoke test and STATUS.log update

**Files:**
- Create: `tests/smoke.spec.mjs`
- Modify: `STATUS.log`

- [ ] **Step 1: Write the smoke test**

```javascript
import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:8080';

test('browse page shows all 9 licenses', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('table.brz tbody tr')).toHaveCount(9);
});

test('detail page renders for MIT', async ({ page }) => {
  await page.goto(BASE + '/#/license/mit');
  await expect(page.locator('h2')).toContainText('MIT');
  await expect(page.locator('.feat-table')).toHaveCount(3);
});

test('compare page renders three licenses with citation expand', async ({ page }) => {
  await page.goto(BASE + '/#/compare?set=mit,apache-2.0,gpl-3.0');
  await expect(page.locator('.cmp-table')).toBeVisible();
  await page.locator('.cite-btn').first().click();
  await expect(page.locator('.cite-expanded')).toBeVisible();
});

test('text page highlights sentence via :target', async ({ page }) => {
  await page.goto(BASE + '/#/license/mit/text?s=s-2');
  const el = page.locator('#s-2');
  await expect(el).toBeVisible();
  await expect(el).toHaveClass(/pulse/);
});
```

- [ ] **Step 2: Run smoke tests**

```bash
npx playwright install chromium
npm run serve &
SERVER_PID=$!
sleep 2
npm run smoke
kill $SERVER_PID
```
Expected: 4 tests pass.

- [ ] **Step 3: Update `STATUS.log`**

Change stage to `Minimum Viable Product (MVP)` with all core features checked off; update `Last Updated` to today's date.

Run:
```bash
loglog STATUS.log > STATUS.md
```

- [ ] **Step 4: Commit + push**

```bash
git add tests/smoke.spec.mjs STATUS.log STATUS.md
git commit -m "test: playwright smoke suite; STATUS: MVP complete"
git push origin master
```

---

## Appendix — Running the plan

Each task is self-contained. Normal flow:

```bash
cd /home/k1/public/license_explorer
# follow the task steps in order; every task ends with a commit
```

If `npm run validate` ever fails mid-task, stop and fix before committing. Don't commit over a failing validator — it's the guardrail for the whole data pipeline.
