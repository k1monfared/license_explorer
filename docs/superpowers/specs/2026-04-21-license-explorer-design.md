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
│   │   ├── meta.json          # identity + references
│   │   ├── text.raw.txt       # original license text, byte-for-byte
│   │   ├── text.html          # sentence-wrapped with <span id="s-N">
│   │   ├── features.json      # permissions/conditions/limitations + citations
│   │   └── analysis.json      # (optional) court cases, deeper commentary
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
  "references": [
    { "source": "OSI",         "url": "https://opensource.org/license/mit" },
    { "source": "TLDR Legal",  "url": "https://tldrlegal.com/license/mit-license" },
    { "source": "choosealicense", "url": "https://choosealicense.com/licenses/mit/" }
  ]
}
```

### 4.3 `licenses/<id>/features.json`

Grouped into the four choosealicense-style buckets. Each feature entry has a `key` drawn from the vocabulary, a `value`, and zero or more `citations` pointing to sentence IDs in `text.html`.

```json
{
  "permissions": [ { "key": "commercial-use",       "value": "permitted",
                     "citations": [{ "sentence_id": "s-3" }] } ],
  "conditions":  [ { "key": "include-copyright",    "value": "required",
                     "citations": [{ "sentence_id": "s-7" }] },
                   { "key": "network-use-disclose", "value": "grey",
                     "citations": [{ "sentence_id": "s-12" }],
                     "commentary": "FSF FAQ: running on a server is not conveying. AGPL was designed to close this gap." } ],
  "limitations": [ { "key": "liability",            "value": "forbidden",
                     "citations": [{ "sentence_id": "s-14" }] } ]
}
```

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

### 4.4 `licenses/<id>/text.html`

The full license text, each sentence wrapped as `<span id="s-N" class="sentence">…</span>`. CSS `span.sentence:target { background: #facc15; outline: 1px solid #facc15; }` highlights whichever sentence is in the URL hash; a tiny script pulses it for ~1 second and scrolls it into view. CI schema validates that sentence IDs are dense and contiguous.

### 4.5 `schemas/feature-vocabulary.json`

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
- **Smoke test** for each page: headless Chrome visits `#/`, `#/license/mit`, `#/compare?set=mit,gpl-3.0` and asserts expected DOM markers.

## 10. References

- `memory/reference_license_sources.md` — TLDR Legal, OSI, Creative Commons, Luis Villa.
- `/home/k1/public/large_dog_breeds/` — stack pattern (React via CDN + Babel), data-driven app style.
- `/home/k1/public/site_kit/` — shared CSS/JS (theme, nav, typography, sidebar, lightbox, pagination).
