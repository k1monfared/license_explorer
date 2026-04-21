# License Explorer — Design

**Date:** 2026-04-21
**Status:** Draft, pre-implementation
**Source:** `readme.log` + brainstorming session

## 1. Goal

An interactive GitHub Pages site that helps a public audience understand software licensing (with first-class support for non-software media from day one). Core value: every feature claim in the comparison table is backed by the exact sentence from the license text that justifies it, and grey areas are surfaced rather than hidden.

## 2. Audience & scope

Public audience: developers, creators, students, and license-curious generalists. MVP ships 9 licenses spanning major archetypes across both software and media, so the multi-medium data model is validated on day one rather than retrofitted later.

## 3. Architecture overview

**Stack.** Static HTML + React via CDN + in-browser Babel, matching the pattern in `large_dog_breeds`. No build step. Shared chrome (theme toggle, typography, nav) via `site_kit` URL includes.

**Pages (SPA, hash-routed):**
- `#/` — Browse: sidebar filters (medium / archetype / use), keyword search, sortable table with per-row checkbox, persistent "Compare (N)" tray.
- `#/license/<id>` — Detail: metadata, per-license feature table with expandable evidence, link to full text.
- `#/license/<id>/text` — Full license text (`text.html`) with sentence-level `#s-N` anchors; sentences highlight via CSS `:target`.
- `#/compare?set=<id1>,<id2>,…` — Side-by-side comparison with add, remove, and drag-to-reorder columns.

**State.** All selections live in the URL (filter state, compare set, column order). Reload and share both work. The only persisted state is the site_kit theme preference.

**Data loading.** First paint fetches `licenses/index.json` (catalog only). Per-license files are fetched on demand when opening a detail or compare view.

**Deployment.** GitHub Pages from the `master` branch, root path. Enabled via the GitHub API as part of initial setup.

## 4. Data model & directory layout

```
license_explorer/
├── index.html                 # shell: loads React UMD + Babel, fetches app.jsx
├── app.jsx                    # single-file React app (routes + pages)
├── licenses.css               # page-specific styles (overrides on site_kit)
├── licenses/
│   ├── index.json             # catalog for the browse page
│   ├── mit/
│   │   ├── meta.json          # identity + references + provenance
│   │   ├── text.raw.txt       # original license text, byte-for-byte
│   │   ├── text.html          # sentence-wrapped with <span id="s-N">
│   │   ├── features.json      # permissions/conditions/limitations + citations + sources
│   │   ├── analysis.json      # (optional) court cases + external sources
│   │   └── .progress.json     # per-license pipeline state for resumability
│   └── apache-2.0/ …
└── schemas/                   # JSON schemas; CI validates every data file
    ├── meta.schema.json
    ├── features.schema.json
    ├── analysis.schema.json
    └── feature-vocabulary.json
```

### 4.1 `licenses/index.json`

Flat catalog driving the browse table. Loaded on first paint.

```json
[
  { "id": "mit", "name": "MIT License", "spdx": "MIT",
    "medium": "software", "archetype": "permissive",
    "blurb": "Shortest permissive license — commercial + proprietary OK.",
    "tags": ["permissive", "attribution"] }
]
```

### 4.2 `licenses/<id>/meta.json`

Identity plus authoritative references. References drawn primarily from TLDR Legal, OSI (for software), Creative Commons (for media), and Luis Villa commentary (for grey-area analysis). See `memory/reference_license_sources.md`.

```json
{
  "id": "mit", "name": "MIT License", "spdx": "MIT",
  "medium": "software", "archetype": "permissive",
  "version": "1.0", "year": null,
  "canonical_url": "https://opensource.org/license/mit",
  "text_provenance": {
    "source_url": "https://opensource.org/license/mit",
    "retrieved_at": "2026-04-21T14:03:22Z",
    "sha256": "4ea3f4f9d8e3..."
  },
  "references": [
    { "source": "OSI",            "url": "https://opensource.org/license/mit",          "retrieved_at": "2026-04-21T14:03:22Z" },
    { "source": "TLDR Legal",     "url": "https://tldrlegal.com/license/mit-license",   "retrieved_at": "2026-04-21T14:03:22Z" },
    { "source": "choosealicense", "url": "https://choosealicense.com/licenses/mit/",    "retrieved_at": "2026-04-21T14:03:22Z" }
  ],
  "approvals": [
    { "body": "OSI", "approved": true,
      "url": "https://opensource.org/license/mit",
      "retrieved_at": "2026-04-21T14:03:22Z" },
    { "body": "FSF", "approved": true,
      "url": "https://www.gnu.org/licenses/license-list.html#Expat",
      "retrieved_at": "2026-04-21T14:03:22Z",
      "note": "Listed as 'Expat License' — GPL-compatible free software." }
  ]
}
```

**Approvals** track the license's status with stewardship bodies — OSI, FSF (Free Software Foundation's license list), and optionally Debian DFSG / Fedora. Each entry is a full citation with URL and `retrieved_at`, so "is this license OSI-approved?" is an authoritative claim backed by the OSI page itself, not a hard-coded boolean. The browse page exposes **OSI approved** and **FSF free software** as filter checkboxes, driven by per-license `osi_approved` / `fsf_libre` booleans in `licenses/index.json` that mirror the meta-level approvals.

**Provenance rule.** `text_provenance.sha256` is the hash of `text.raw.txt` as stored in the repo; CI validates the hash matches. If the canonical source ever drifts, the hash mismatch (run by a scheduled refresh) flags the license for review rather than silently serving stale content.

### 4.3 `licenses/<id>/features.json`

Grouped into the four choosealicense-style buckets. Each feature entry has a `key` drawn from the vocabulary, a `value`, and zero or more `citations` pointing to sentence IDs in `text.html`.

```json
{
  "permissions": [
    { "key": "commercial-use", "value": "permitted",
      "citations": [{ "sentence_id": "s-3" }],
      "external_references": [] }
  ],
  "conditions":  [
    { "key": "include-copyright", "value": "required",
      "citations": [{ "sentence_id": "s-7" }],
      "external_references": [] },
    { "key": "network-use-disclose", "value": "grey",
      "citations": [{ "sentence_id": "s-12" }],
      "commentary": "FSF FAQ: running on a server is not conveying. AGPL was designed to close this gap.",
      "external_references": [
        { "source": "FSF GPL FAQ",
          "url": "https://www.gnu.org/licenses/gpl-faq.html#UseGPLForAnything",
          "retrieved_at": "2026-04-21T14:03:22Z",
          "excerpt": "Running a modified version on a server open to the public..." }
      ] }
  ],
  "limitations": [
    { "key": "liability", "value": "forbidden",
      "citations": [{ "sentence_id": "s-14" }],
      "external_references": [] }
  ],
  "sources": [
    { "source": "license text", "url": "licenses/mit/text.html", "role": "primary evidence" },
    { "source": "FSF GPL FAQ", "url": "https://www.gnu.org/licenses/gpl-faq.html",
      "retrieved_at": "2026-04-21T14:03:22Z", "role": "grey-area commentary" }
  ]
}
```

**Source-completeness rule.** Every non-empty `commentary`, every `value: "grey"` entry, and every `value` assignment that relies on text outside the license itself, **must** have at least one matching entry in `external_references` or reference `licenses/<id>/text.html` via `citations`. CI enforces this: a grey value or commentary with no source fails validation. Every external reference must include `source`, `url`, `retrieved_at`, and `excerpt` (for the quoted passage) or `summary` (for a paraphrase). The file-level `sources` array aggregates every distinct source used anywhere in the file — the audit trail in one place.

A feature always lives in exactly one of the three groups — `permissions`, `conditions`, `limitations` — determined by its entry in the vocabulary. Grey areas are **not a separate group**; they are feature entries whose `value` is `"grey"`, with an optional `commentary` string for the ambiguity explanation. This keeps one feature = one row in the comparison table, regardless of how the license treats it.

**Value vocabulary.** Exactly six values, rendered distinctly in the UI:

| Value | Meaning | UI |
|---|---|---|
| `permitted` | License expressly allows it (permissions) | ✓ green |
| `required` | License requires it of downstream users (conditions) | ! yellow |
| `forbidden` | License disclaims it or prohibits it (limitations) | ✗ red |
| `silent` | License text does not address this | — gray, "No matching language" tooltip |
| `grey` | License text addresses it but contested / ambiguous | dashed border, "? grey area" |
| `not_assessed` | Feature exists in vocabulary but no one has extracted it yet | pale `·`, "Not yet analyzed" tooltip |

`silent` vs `not_assessed` is deliberately separate: one is a statement ("we looked and the text is silent"), the other is an absence of data. Any feature entry may include an optional `commentary` string; it is surfaced in the inline expand panel alongside the cited sentences. The `commentary` field is how grey areas get their ambiguity explanation.

### 4.4 `licenses/<id>/analysis.json`

Deep analysis from public sources (court filings, FSF / Apache legal-discuss archives, Luis Villa commentary). Every entry is grouped by feature key or topic and cites its sources with the same provenance fields.

```json
{
  "entries": [
    { "topic": "network-use-disclose",
      "summary": "Debated in practice; AGPL was added to close SaaS loophole.",
      "sources": [
        { "source": "Luis Villa blog",
          "url": "https://lu.is/blog/...",
          "retrieved_at": "2026-04-21T14:03:22Z",
          "excerpt": "...quoted passage..." }
      ] }
  ],
  "sources": [
    { "source": "CourtListener", "url": "https://www.courtlistener.com/...", "retrieved_at": "..." }
  ]
}
```

Same source-completeness rule as `features.json`: every entry must cite at least one source, and every source must include `url`, `retrieved_at`, and either `excerpt` or `summary`. No synthesized facts without a provenance trail.

### 4.5 `licenses/<id>/.progress.json`

Per-license pipeline state, written incrementally by the skills. Lets a failed or interrupted run resume rather than redo completed work.

```json
{
  "lookup_license":   { "status": "complete", "updated_at": "2026-04-21T14:03:22Z" },
  "extract_features": { "status": "partial",
                        "completed_keys": ["commercial-use", "liability"],
                        "remaining_keys": ["network-use-disclose", "patent-use"],
                        "last_error": null,
                        "updated_at": "2026-04-21T14:08:01Z" },
  "deep_analysis":    { "status": "pending" }
}
```

Status values: `pending | partial | complete | failed`. When `failed`, `last_error` carries the error message so a human can decide whether to retry or fix input. Gitignore entry excludes nothing — `.progress.json` is committed alongside the data so anyone resuming the work inherits the state.

### 4.6 `licenses/<id>/text.html`

The full license text, each sentence wrapped as `<span id="s-N" class="sentence">…</span>`. CSS `span.sentence:target { background: #facc15; outline: 1px solid #facc15; }` highlights whichever sentence is in the URL hash; a tiny script pulses it for ~1 second and scrolls it into view. CI schema validates that sentence IDs are dense and contiguous.

### 4.7 `schemas/feature-vocabulary.json`

Controlled vocabulary listing every feature key, its group, and human-readable label. **This file drives the comparison table rows.** Adding a row to the comparison table = adding an entry here + running `/backfill-feature`. Referenced keys in any license's `features.json` are validated against this file in CI.

## 5. Citation UX (comparison table)

Each cell in the comparison table shows its value and a "¶" icon. Clicking "¶" on any cell opens a single inline expand panel under the row with evidence for **every license in the table** at once (not just the clicked column):

- For licenses with explicit language: the cited sentence(s) as a blockquote plus a "↗ open in new tab" link to `licenses/<id>/text.html#s-N`. The linked view scrolls to and highlights the sentence via CSS `:target`.
- For `silent` licenses: a short note explaining why ("No matching language in text"), with a link to the full text.
- External authoritative citations (FSF FAQ, Luis Villa commentary, court filings) use regular `target="_blank"` links.

Multiple inline expand panels can be open at once. The comparison table supports add (trailing `+` column with searchable license picker), remove (`×` on column header), and drag-to-reorder (columns reorder in URL `?set=…`).

## 6. The three Claude skills + orchestrators

All project-local under `.claude/skills/` so clones of the repo get them automatically.

### 6.1 `lookup-license`

Input: rough name (e.g., "agpl", "the one Go uses"). Disambiguates via OSI / SPDX / TLDR Legal. Produces:

- `licenses/<id>/text.raw.txt` — verbatim canonical license text, byte-for-byte.
- `licenses/<id>/meta.json` — identity, references, canonical URL.
- Stub entry appended to `licenses/index.json`.

### 6.2 `extract-features`

Input: license id. Reads `text.raw.txt`, produces:

- `licenses/<id>/text.html` — sentence-tokenized with stable `s-N` ids. Tokenizer is a deterministic boring splitter (`. ! ?` with an abbreviation guard list). Idempotent: re-runs preserve existing sentence IDs by matching text hashes.
- `licenses/<id>/features.json` — for each feature in the vocabulary, assign a value and cite sentence IDs. Supports a `--feature=<key>` flag to scope to one feature (used by `/backfill-feature`).

### 6.3 `deep-analysis`

Input: license id. Searches public sources only (CourtListener / RECAP, FSF / Apache legal-discuss archives, Luis Villa's blog), produces:

- `licenses/<id>/analysis.json` — entries grouped by feature key or topic, each with a short summary and links to the underlying public documents.

### 6.4 Slash-command orchestrators (in `.claude/commands/`)

- `/add-license <name>` — runs `lookup-license` → `extract-features` → `deep-analysis` with a review checkpoint between each step.
- `/backfill-feature <key>` — iterates every license in `licenses/index.json`, runs `extract-features --feature=<key>`, commits.
- `/refresh-analysis <id>` — runs `deep-analysis` again for a single license (court cases change).

Every skill writes through the JSON schemas in `schemas/` and fails loudly if a write would break the schema.

### 6.5 Graceful failure and resumability

License population is a pipeline that can fail at any step (network errors during fetch, an edge-case in the text that trips the tokenizer, a source that rate-limits). The pipeline is designed so partial work is always saved and never has to be redone.

**Incremental writes.** No skill buffers a complete artifact in memory and writes it at the end. Each skill writes as it goes:

- `lookup-license` writes `text.raw.txt` immediately once fetched, then `meta.json`, then updates `.progress.json` → `lookup_license: complete`. If it fails before writing `meta.json`, the raw text is kept and rerunning skips the fetch.
- `extract-features` first writes `text.html` and sets `.progress.json.extract_features.status: partial, completed_keys: []`. Then for each feature key in the vocabulary it reads the text, writes the feature entry into `features.json`, and appends the key to `completed_keys` — all in one atomic write per feature. On rerun it reads `completed_keys` and skips them. If a specific key errors, it's recorded in `last_error` and the key is left for retry; other keys continue.
- `deep-analysis` writes each entry to `analysis.json` as it's produced (not at the end) and updates `.progress.json.deep_analysis` similarly.

**Atomic JSON writes.** Every JSON write uses write-to-temp + rename, so a crash mid-write never produces a truncated file.

**Orchestrator resumes.** `/add-license <name>` reads `.progress.json` first; for each pipeline stage with status `complete` it prints "✓ already done" and moves on. For `partial` it calls the skill which itself resumes at the first non-completed feature. For `pending` or `failed` it runs normally. This means rerunning `/add-license mit` after any failure is always safe and always resumes.

**Explicit "retry failed" path.** A stage marked `failed` requires either `--retry` or a fresh `/add-license` invocation to clear the `last_error` and try again. This prevents silent reruns of an issue the user hasn't seen.

## 7. Extensibility: adding a new feature later

1. Edit `schemas/feature-vocabulary.json` to add the key, its group, and label.
2. Run `/backfill-feature <new-key>`. Claude extracts it for every license and commits.
3. CI verifies no licenses reference unknown feature keys and all vocabulary entries are covered.

Licenses that predate a new vocabulary entry render as `not_assessed` (pale `·`) in the UI until the skill fills them in, so the table never lies about what data exists.

## 8. MVP scope & sequencing

**Ships in MVP:** MIT, Apache-2.0, BSD-3-Clause, MPL-2.0, LGPL-3.0, GPL-3.0, AGPL-3.0, CC-BY 4.0, CC-BY-SA 4.0.

**Build sequence** (each step produces a working site deployable to GH Pages):

1. Scaffold `index.html`, `app.jsx`, `licenses.css`; wire site_kit; ship empty index page live on GH Pages.
2. Ship `schemas/` + feature vocabulary + `lookup-license` + `extract-features` skills. Run them for MIT and GPL-3.0 as proof.
3. Browse page: sidebar filters, search, sortable table, compare tray.
4. Detail page + text viewer with `:target` highlight.
5. Compare page: feature-rows / license-columns, add / remove / drag-reorder, URL-canonical state.
6. Run `lookup-license` + `extract-features` for the remaining 7 licenses.
7. `deep-analysis` skill + run for all 9.
8. `/backfill-feature` + `/refresh-analysis` orchestrators.

**Explicitly out of MVP** (queued in STATUS.log): license-compatibility matrix, license picker wizard, per-country legal nuance, user-submitted citations, global (user-level) Claude skills, non-Latin language license support.

## 9. Testing

- **Schema validation** in CI: every `meta.json`, `features.json`, `analysis.json`, and `index.json` is validated against its schema. Feature keys must exist in the vocabulary.
- **Sentence ID density** in CI: every `text.html` must have ids `s-0 … s-N` without gaps.
- **Citation liveness** in CI: every `sentence_id` referenced in a `features.json` must exist in the corresponding `text.html`.
- **Text provenance** in CI: `meta.json.text_provenance.sha256` must match the current `text.raw.txt` hash.
- **Source completeness** in CI: every `value: "grey"` entry and every entry with non-empty `commentary` must have at least one citation or external reference. Every external reference must include `source`, `url`, `retrieved_at`, and either `excerpt` or `summary`.
- **Smoke test** for each page: headless Chrome visits `#/`, `#/license/mit`, `#/compare?set=mit,gpl-3.0` and asserts expected DOM markers.
- **Tokenizer unit tests**: sentence splitter is a pure function with a dedicated test suite covering abbreviations, quoted periods, numbered lists, and idempotency (re-running preserves existing IDs).

## 10. References

- `memory/reference_license_sources.md` — TLDR Legal, OSI, Creative Commons, Luis Villa.
- `/home/k1/public/large_dog_breeds/` — stack pattern (React via CDN + Babel), data-driven app style.
- `/home/k1/public/site_kit/` — shared CSS/JS (theme, nav, typography, sidebar, lightbox, pagination).
