# License Explorer

**Status**: 🟡 MVP | **Mode**: 🤖 Claude Code | **Updated**: 2026-04-21

**Live site: [k1monfared.github.io/license_explorer](https://k1monfared.github.io/license_explorer/)**

An interactive, evidence-backed guide to software and media licenses. For every license it catalogs, every claim in the comparison table is linked to the exact sentence in the license text that justifies it, and grey areas are surfaced rather than hidden.

## Features

- **Browse** 21 licenses across permissive, weak-copyleft, strong-copyleft, attribution, share-alike, and public-domain archetypes — filter by medium (software / media), archetype, OSI approval, FSF free-software status, and full-text search.
- **Side-by-side comparison** with add, remove, and drag-reorder of columns. The URL is canonical and shareable.
- **Sentence-level citations**: clicking any citation opens the full license text in a new tab, scrolled to the cited sentence and highlighted.
- **Grey-area support**: where a license is ambiguous or contested, cells show a "grey" badge with commentary and supporting citations.
- **OSI + FSF approvals** recorded as first-class data with source URLs, not hard-coded booleans.
- **Full source provenance**: every JSON file records where the data came from, when it was retrieved, and for license text, a sha256 hash so drift is detectable.

See [About](https://k1monfared.github.io/license_explorer/#/about) for methodology and caveats, and [Glossary](https://k1monfared.github.io/license_explorer/#/glossary) for term definitions.

## For users

Open [the live site](https://k1monfared.github.io/license_explorer/) and start browsing. Typical flows:

- "Which licenses allow commercial use without requiring me to share my source?" → filter for OSI-approved, sort by permissive archetype.
- "What's the difference between GPL-3.0 and AGPL-3.0 for a hosted web service?" → compare both, expand the `network-use-disclose` row.
- "Is CC0 OSI-approved?" → open the CC0 detail page; the approvals row shows OSI not-approved with a link explaining why.

## For developers

### Local development

Requires Node.js 20+.

```bash
git clone https://github.com/k1monfared/license_explorer
cd license_explorer
npm install
npm test          # unit tests (validator, router, tokenizer)
npm run validate  # schema + citation liveness + provenance + source completeness
npm run serve     # http-server on :8080
npm run smoke     # playwright end-to-end (browse, detail, compare, text highlight)
```

The site is a static SPA: `index.html` loads React 18 and Babel Standalone from a CDN and fetches `app.jsx` at runtime. There is no build step — push to `master` and GitHub Pages serves the files directly.

### Adding a license

The Claude-authored pipeline handles this end-to-end. Assuming you have Claude Code:

```
/add-license <rough name>
```

This runs three skills in sequence with review checkpoints:

1. **`lookup-license`** — disambiguates the name via OSI / SPDX / TLDR Legal, fetches canonical text verbatim (via `scripts/fetch-text.mjs`), computes sha256, writes `meta.json` (including OSI and FSF approval entries with citation URLs) and an `.index-entry.json` fragment for the catalog.
2. **`extract-features`** — tokenizes the text into sentence-anchored HTML, then iterates the vocabulary in `schemas/feature-vocabulary.json` and populates `features.json` with citations to sentence ids.
3. **`deep-analysis`** *(optional for MVP)* — searches public sources (CourtListener, FSF and Apache legal-discuss archives, Luis Villa's writing) and writes `analysis.json` entries.

After the skill runs, merge the `.index-entry.json` fragments into the catalog:

```bash
node scripts/aggregate-index.mjs
npm run validate
git add . && git commit -m "feat: add <id>"
```

### Adding a feature to the vocabulary

Edit `schemas/feature-vocabulary.json` to add the new key (pick the group: permissions / conditions / limitations). Then backfill it across every license:

```
/backfill-feature <new-key>
```

The orchestrator walks `licenses/index.json`, invokes `extract-features --feature=<key>` for each license, and commits. Licenses that haven't had the feature populated yet render as `not_assessed` in the UI — visually distinct from `silent`, so the table never lies about what data exists.

### Project layout

```
license_explorer/
├── index.html                 # app shell (React + Babel via CDN)
├── app.jsx                    # single-file SPA, hash-routed
├── licenses.css               # page-specific styles (theme vars from site_kit)
├── licenses/
│   ├── index.json             # browse catalog
│   └── <id>/
│       ├── meta.json          # identity + provenance + approvals + references
│       ├── text.raw.txt       # canonical license text, byte-for-byte
│       ├── text.html          # sentence-wrapped with <span id="s-N">
│       ├── features.json      # value + citations + external_references per key
│       ├── analysis.json      # (optional) court cases + deep commentary
│       └── .progress.json     # pipeline state for resumable ingestion
├── schemas/                   # JSON schemas; CI validates every data file
├── scripts/
│   ├── fetch-text.mjs         # byte-for-byte URL → file
│   ├── tokenizer.mjs          # deterministic sentence splitter with stable ids
│   ├── validate.mjs           # schema + citation liveness + source completeness
│   ├── aggregate-index.mjs    # merge .index-entry.json fragments into catalog
│   └── router.mjs             # hash-route parser (unit-tested)
├── .claude/
│   ├── skills/                # lookup-license, extract-features, deep-analysis
│   └── commands/              # /add-license, /backfill-feature, /refresh-analysis
├── tests/                     # unit tests + playwright smoke suite
├── .github/workflows/         # CI: run tests + validate on push/PR
└── docs/superpowers/          # design spec and implementation plan
```

### Validation guarantees

CI (and `npm run validate` locally) enforces:

- **Schema validity** for every `meta.json`, `features.json`, `analysis.json`, `.progress.json`, and `index.json`.
- **Sentence id density**: every `text.html` has contiguous ids `s-0 … s-N` with no gaps.
- **Citation liveness**: every `sentence_id` referenced in `features.json` exists in the corresponding `text.html`.
- **Text provenance**: `meta.json.text_provenance.sha256` matches the current `text.raw.txt` hash.
- **Feature-key coverage**: every feature key in a `features.json` is defined in `schemas/feature-vocabulary.json` (catches typos and stale keys).
- **Source completeness**: every `value: "grey"` entry, and every non-silent entry with commentary, has at least one citation or external reference.
- **Orphan detection**: every `licenses/<id>/` directory has a corresponding entry in `licenses/index.json`.

## Contributing

- **Data corrections** — if you think a feature value or citation is wrong for a license, open an issue or a PR. Include the sentence id that you think supports your reading.
- **New licenses** — PRs welcome. Use `/add-license <name>` as the starting point so the data conforms to the schema.
- **New feature vocabulary** — open an issue first to discuss whether a new key adds distinctive signal that the existing ones don't capture.

Caveats about the data (LLM-driven extraction, jurisdiction variance, source freshness) are spelled out on the [About page](https://k1monfared.github.io/license_explorer/#/about).

## Support

If this is useful to you, [sponsor the work](https://k1monfared.github.io/sponsor.html).

## License

The code in this repository is MIT-licensed. The license texts under `licenses/<id>/text.raw.txt` are published by their respective stewards and redistributed here under the terms those stewards already publish them under (SPDX, OSI, FSF, Creative Commons, etc.).
