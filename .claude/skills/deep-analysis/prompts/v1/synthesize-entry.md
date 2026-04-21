# Prompt v1 — synthesize-entry

**Purpose.** Read a set of archived sources on a topic and write one
`analysis.json` entry summarizing what the public record says.

## Input

- `license_id`.
- `topic` (feature key or named topic).
- Ordered list of archived sources: each has `archive_sha256`, `url`,
  `authority_tier`, and local paths (`body`, `meta`).

## Procedure

1. Open each archived body file at `licenses/<id>/analysis-sources/<sha>.<ext>`.
   Read the text content (for HTML, extract the main article body; avoid
   site chrome). Select up to three verbatim passages most relevant to
   the topic, keeping each excerpt under 500 characters.

2. Compose a `summary` of what the sources collectively say about the
   topic: ≤500 characters, plain English, no speculation beyond what the
   sources support. If sources disagree, say so explicitly.

3. Build the entry per `schemas/analysis.schema.json`:
   ```json
   {
     "topic": "<topic>",
     "summary": "<≤500 chars>",
     "sources": [
       {
         "source": "<e.g. 'CourtListener — Jacobsen v. Katzer'>",
         "url": "<canonical URL>",
         "retrieved_at": "<from meta.json>",
         "archive_sha256": "<from meta.json>",
         "excerpt": "<verbatim up to 500 chars>"
       }
     ]
   }
   ```

4. **Every source in the final `sources[]` must have `archive_sha256`.**
   If a source is referenced that was not successfully archived, either
   archive it now or drop it from the entry.

5. Write the entry atomically into `licenses/<id>/analysis.json` (read,
   append to `entries[]`, write-temp + rename). Do NOT buffer multiple
   entries in memory and flush at the end — partial work must survive a
   crash.

6. After each successful entry:
   ```
   node scripts/append-log.mjs <id> '{"step":"synthesize-entry","prompt_version":"v1","topic":"<topic>","sources_used":[<shas>],"entry_written":true}'
   ```

## Sourcing rules

- Every assertion in `summary` must be supported by at least one quoted
  or summarized source in `sources[]`.
- Never paraphrase a source's conclusion as your own without citation.
- If the topic has no adequately-sourced material, skip the entry and
  log:
  ```
  node scripts/append-log.mjs <id> '{"step":"synthesize-skipped","prompt_version":"v1","topic":"<topic>","reason":"<why>"}'
  ```

## Excerpt hygiene

- Preserve the author's exact wording for excerpts. Use ellipsis (…) for
  elision.
- Do not concatenate sentences from different places into one excerpt.
- If a quoted passage contains ambiguity that the summary resolves,
  prefer the longer quote over a shorter one.
