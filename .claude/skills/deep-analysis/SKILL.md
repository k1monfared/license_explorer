---
name: deep-analysis
description: For a license with features.json in place, search public sources (CourtListener, FSF and Apache legal-discuss archives, Luis Villa's writing, academic papers) for material that illuminates how the license works in practice. Write analysis.json with per-topic entries and full source provenance. Resumable.
---

# deep-analysis

## Inputs
- License `id`.

## Outputs (under `licenses/<id>/`)
- `analysis.json` per `schemas/analysis.schema.json`.
- `.progress.json`: update `deep_analysis` stage.

## Procedure

### 1. Read progress
If `deep_analysis.status === "complete"`, stop. If `partial`, continue; whatever's already in `analysis.json` stays.

### 2. Determine topics
Build the topic list in this order:
1. Every feature with `value === "grey"` in `features.json` (each grey area should have at least one analysis entry).
2. Broader themes if meaningful public material exists: `enforcement-history`, `notable-court-cases`, `compatibility`, `drafting-ambiguity`.

Do not invent topics without underlying sources.

### 3. For each topic
a. **Search public sources only.** Do not access private repositories, paid databases (unless you have authorized access), or documents behind login walls.
   - CourtListener / RECAP: `https://www.courtlistener.com/api/` for court filings.
   - FSF legal-discuss archives (publicly archived mailing list).
   - Apache legal-discuss archives.
   - Luis Villa's blog (lu.is, and archive.org for prior domains).
   - Open-access academic papers and law review articles.
b. **Write an entry:**
   ```json
   {
     "topic": "<feature-key or theme>",
     "summary": "<≤500 chars plain-English summary of what the sources say>",
     "sources": [
       { "source": "<site or publication>", "url": "<deep link>",
         "retrieved_at": "<now>", "excerpt": "<verbatim quote>" }
     ]
   }
   ```
   `sources` must have at least one entry. Each source entry needs `source`, `url`, `retrieved_at`, and one of `excerpt` (verbatim) or `summary` (paraphrase).
c. **Write the entry atomically** into `analysis.json` via temp+rename. Do NOT buffer all entries and flush at the end. After each successful write, update `.progress.json.deep_analysis.updated_at`, leave `status: "partial"` until the topic list is exhausted.

### 4. Aggregate file-level sources
After all topics, collect distinct (source, url) pairs into the file-level `sources[]` array.

### 5. Mark complete
Once no remaining topics, set `deep_analysis.status = "complete"`.

### 6. Validate
Run `npm run validate`. On failure mark `failed` + `last_error`.

## Required sourcing

- Every entry needs ≥1 source. No exceptions.
- Every source must have `retrieved_at` + either `excerpt` or `summary`.
- Your own generalization of case law is not a source. Cite the case.
- For each citation, include enough context in `excerpt` that a reader can verify your summary without clicking through.
