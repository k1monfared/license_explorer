---
name: lookup-license
description: Given a rough license name or description, disambiguate it, fetch its canonical text, record OSI/FSF approval status, and write the initial license entry (meta.json, text.raw.txt, index.json stub, .progress.json). Idempotent, resumes gracefully if any step was already done.
---

# lookup-license

## Inputs
- A rough license name, SPDX identifier, or descriptive phrase (e.g. "mit", "agpl", "the one Go uses").

## Outputs (all under `licenses/<id>/`)
1. `text.raw.txt` — byte-for-byte canonical license text.
2. `meta.json` — identity, SPDX id, medium, archetype, canonical_url, text_provenance {source_url, retrieved_at, sha256}, references[], approvals[].
3. Stub entry appended to `licenses/index.json` including `osi_approved` and `fsf_libre` booleans that mirror meta.approvals.
4. `.progress.json` — initialize if missing, set `lookup_license.status = complete` on success.

## Procedure

### 1. Disambiguate the name
Consult these in order until a single canonical identifier is agreed on:
1. Open Source Initiative (https://opensource.org/licenses/) — SPDX id + canonical URL.
2. SPDX license list (https://spdx.org/licenses/) — back-up for SPDX id.
3. TLDR Legal (https://tldrlegal.com/) — user-friendly summary and short code.

Produce a canonical `id` = lowercased kebab-case of the SPDX id (e.g. `mit`, `apache-2.0`, `cc-by-sa-4.0`). If the user's input is ambiguous (e.g. "bsd" → BSD-2, BSD-3, BSD-4?), ask the user via AskUserQuestion before fetching anything.

### 2. Check existing progress
If `licenses/<id>/.progress.json` exists and `lookup_license.status === "complete"`, print `lookup-license already complete for <id>` and stop. This guarantees re-runs are no-ops.

### 3. Fetch canonical text
Preferred source order:
- OSI canonical page for OSI-approved licenses.
- SPDX text for licenses not at OSI.
- creativecommons.org for CC licenses.
- gnu.org for GPL / AGPL / LGPL.

Save verbatim to `licenses/<id>/text.raw.txt` — UTF-8, Unix line endings, trailing newline. Use `WebFetch`; then extract the actual license text from the HTML (strip site chrome) but keep the body byte-for-byte, whitespace included. Never paraphrase.

### 4. Compute provenance and build meta.json
- `sha256` of the exact bytes written to `text.raw.txt`.
- `retrieved_at` = current UTC ISO-8601 timestamp.
- `references[]` = every site you consulted to produce this entry. At minimum: OSI (if approved), SPDX (if present), TLDR Legal, canonical URL. Each entry needs `source`, `url`, `retrieved_at`. Add `note` if helpful.
- `medium` = `software` for code licenses, `media` for CC, `hardware` / `data` where applicable.
- `archetype` = one of: `permissive`, `weak-copyleft`, `strong-copyleft`, `attribution`, `share-alike`, `public-domain`, `proprietary`. Pick the closest fit from the vocabulary in `schemas/meta.schema.json`.

### 5. Build approvals[]
For each stewardship body, check its canonical list and record the result. **Every entry is a full citation with URL and retrieved_at, not a hard-coded boolean.**

- **OSI**: fetch `https://opensource.org/licenses/` and check whether the SPDX id is listed.
  - If yes: `{ "body": "OSI", "approved": true, "url": "https://opensource.org/license/<id>", "retrieved_at": "..." }`.
  - If no: `{ "body": "OSI", "approved": false, "url": "https://opensource.org/licenses/", "retrieved_at": "...", "note": "Not listed on OSI approved-license page as of retrieved_at." }`.

- **FSF**: fetch `https://www.gnu.org/licenses/license-list.html` and search for the license. FSF classifies licenses into four categories:
  1. Free software licenses compatible with the GPL
  2. Free software licenses incompatible with the GPL
  3. Nonfree software licenses
  4. Licenses for works other than software

  - If in categories 1 or 2: `{ "body": "FSF", "approved": true, "url": "https://www.gnu.org/licenses/license-list.html#<anchor>", "retrieved_at": "...", "note": "GPL-compatible free software license." }` or `"...GPL-incompatible..."`.
  - If in category 3 (nonfree): `{ "body": "FSF", "approved": false, "url": "...", "retrieved_at": "...", "note": "FSF classifies as nonfree." }`.
  - If in category 4 (non-software): `{ "body": "FSF", "approved": true, "url": "...", "retrieved_at": "...", "note": "FSF lists as license for works other than software." }`.
  - If not found: `{ "body": "FSF", "approved": false, "url": "https://www.gnu.org/licenses/license-list.html", "retrieved_at": "...", "note": "Not classified by FSF as of retrieved_at." }`.

Retrieve the anchor id by finding the license's heading on the FSF page (they use `id="<name>"` on dt elements).

### 6. Append to `licenses/index.json`
Read, parse, append, write-temp+rename. New entry:
```json
{
  "id": "<id>",
  "name": "<human name>",
  "spdx": "<SPDX>",
  "medium": "<medium>",
  "archetype": "<archetype>",
  "blurb": "<≤280 chars, one-sentence description>",
  "tags": ["..."],
  "osi_approved": <true/false from approvals OSI entry>,
  "fsf_libre":    <true/false from approvals FSF entry>
}
```

### 7. Write .progress.json (atomic)
```json
{
  "lookup_license":   { "status": "complete", "updated_at": "<now>" },
  "extract_features": { "status": "pending",  "updated_at": "<now>" },
  "deep_analysis":    { "status": "pending",  "updated_at": "<now>" }
}
```

### 8. Validate
Run `npm run validate`. On failure, set `lookup_license.status = "failed"`, write `last_error` with the validator output, do not proceed. Leave text.raw.txt in place (it's idempotent to re-generate).

## Required sourcing

- `meta.json.references` must list every site you consulted with `retrieved_at` timestamps.
- `meta.json.approvals` must have entries for OSI and FSF even when `approved: false` — the entry itself is the proof you checked.
- Never synthesize or paraphrase text into `text.raw.txt`. Byte-for-byte only.

## Atomic writes

Every JSON write uses: write to `<path>.tmp` → rename to `<path>`. A crash mid-write never produces a truncated file.

## Failure modes
- Network error mid-fetch: `text.raw.txt` is not written; state stays `pending`.
- Ambiguous name: ask the user before fetching.
- Validator fails after write: mark `failed` + `last_error`; stop.
