# Prompt v1 — archive-sources

**Purpose.** For each source identified in the discover-sources step,
download the raw content into the repository so the analysis is
reproducible and auditable independently of the live web.

## Procedure

For each entry in `licenses/<id>/.analysis-draft/<topic>-candidates.json`:

1. Invoke:
   ```
   node scripts/archive-source.mjs <id> <url>
   ```
2. Read the JSON line the script prints to stdout. It contains
   `sha256`, `body`, `meta`, `bytes`. Keep the `sha256` — every
   `sources[]` entry in the final `analysis.json` must reference it
   via `archive_sha256`.
3. Log the archival:
   ```
   node scripts/append-log.mjs <id> '{"step":"source-archive","prompt_version":"v1","topic":"<topic>","url":"<url>","archive_sha256":"<sha>","bytes":<n>}'
   ```
4. If the fetch fails (non-2xx, network error, rate-limited), do NOT
   fabricate a sha256. Log the failure and either fall back to an
   alternative source or mark the source as unavailable:
   ```
   node scripts/append-log.mjs <id> '{"step":"source-archive-failed","prompt_version":"v1","topic":"<topic>","url":"<url>","error":"<message>"}'
   ```

## Privacy and legality

- Only archive sources with public access. Do not attempt paywalled or
  login-gated URLs.
- Respect robots.txt and rate limits. Use one request at a time; pause
  between requests if the host appears to throttle.
- Archive the raw response bytes, not a re-rendered or re-styled version.

## Deduplication

The archive is content-addressed by sha256, so fetching the same URL
twice (or two URLs that resolve to byte-identical content) does not
create duplicate files. The `.meta.json` accumulates a `history` of
retrievals for that content.
