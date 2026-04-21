---
name: deep-analysis
description: For a license with features.json in place, research how the license operates in practice using only public sources. Every source is downloaded into the repo and content-addressed by sha256; every step is logged to an append-only audit log; prompts are versioned so the work is reproducible.
---

# deep-analysis

## Inputs
- License `id` (required).

## Outputs (under `licenses/<id>/`)
- `analysis.json` per `schemas/analysis.schema.json`.
- `analysis-sources/<sha256>.<ext>` — the raw bytes of every source consulted.
- `analysis-sources/<sha256>.meta.json` — {url, retrieved_at, sha256, bytes, content_type, history}.
- `analysis-log.jsonl` — append-only audit log with one JSON record per step.
- `.progress.json` — `deep_analysis` stage status.

## Procedure

This skill runs in three phases, each driven by a versioned prompt file
in `.claude/skills/deep-analysis/prompts/v1/`. All phases log to
`analysis-log.jsonl` and use only public sources that are first
downloaded and content-addressed before any claim is written.

### Phase 0 — Initialize

1. Read `.progress.json`. If `deep_analysis.status === "complete"`, stop.
   If `partial`, read `analysis-log.jsonl` and resume at the first
   un-processed topic.
2. Log the session start:
   ```
   node scripts/append-log.mjs <id> '{"step":"session-start","prompt_version":"v1","license_id":"<id>"}'
   ```
3. Build the topic list. In order:
   1. Every feature with `value === "grey"` in `features.json` — each
      grey area should get at least one entry.
   2. Standard topics where public material exists: `enforcement-history`,
      `notable-court-cases`, `relicensing-controversy`, `patent-grant-scope`,
      `compatibility-debate`. Include a topic only if you know of public
      material.

### Phase 1 — discover-sources (per topic)

Follow `.claude/skills/deep-analysis/prompts/v1/discover-sources.md`.

Output a draft candidate list at
`licenses/<id>/.analysis-draft/<topic>-candidates.json`.

### Phase 2 — archive-sources (per topic)

Follow `.claude/skills/deep-analysis/prompts/v1/archive-sources.md`.

Invokes `scripts/archive-source.mjs <id> <url>` for each candidate and
records the sha256 returned.

### Phase 3 — synthesize-entry (per topic)

Follow `.claude/skills/deep-analysis/prompts/v1/synthesize-entry.md`.

Read archived source files directly from disk (never re-fetch from the
network at this phase). Produce one entry with `summary` + `sources[]`
and append atomically to `analysis.json`.

### Phase 4 — Finalize

1. Aggregate a file-level `sources[]` at the top level of `analysis.json`
   by taking the distinct union of every entry's `sources[]`.
2. Run `npm run validate`. If it fails, set
   `deep_analysis.status = "failed"`, record the error in
   `.progress.json.deep_analysis.last_error`, and stop.
3. On success, set `deep_analysis.status = "complete"` and log:
   ```
   node scripts/append-log.mjs <id> '{"step":"session-complete","topics":<n>,"entries_written":<n>}'
   ```

## Required sourcing invariants

- Every entry has ≥1 source.
- Every source has `source`, `url`, `retrieved_at`, `archive_sha256`, and
  either `excerpt` or `summary`.
- Every `archive_sha256` in `analysis.json` corresponds to a file that
  exists on disk in `analysis-sources/`.
- Every `analysis-sources/<sha>.*` has a sibling `.meta.json`.
- Every `analysis-log.jsonl` entry has `timestamp` and `step`.

The validator (`scripts/validate.mjs`) enforces these on every commit.

## Auditability

- **Prompts are versioned.** Each phase references a prompt file in
  `prompts/v1/` by relative path. When prompts evolve, create a `v2/`
  directory and bump references; do not edit past versions.
- **Sources are archived.** The live web may change or disappear; the
  repo retains the exact bytes used to produce each claim.
- **Steps are logged.** `analysis-log.jsonl` is the full replay trail:
  which topics were considered, which sources fetched, which entries
  written or skipped, with timestamps.

## Replay

To replay an earlier analysis (e.g. to compare against a newer one or to
verify a claim):

```
cat licenses/<id>/analysis-log.jsonl | jq 'select(.step == "source-archive")'
```

Gives every (url, sha256) pair consulted. Open
`licenses/<id>/analysis-sources/<sha>.html` to see the exact bytes that
were read, regardless of whether the live URL still serves the same
content today.

## Privacy and legality

- Public sources only. No paywalled or login-gated material.
- Respect robots.txt and rate limits.
- Quote only what's necessary. Keep excerpts under 500 characters per
  quotation.

## Failure handling

Every phase logs failures to `analysis-log.jsonl` rather than aborting
the whole session. A failed source-archive for topic X leaves other
topics unaffected. A failed topic is marked skipped in the log and can
be retried via `/refresh-analysis <id>`.
