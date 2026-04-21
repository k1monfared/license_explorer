---
name: extract-features
description: For a license with text.raw.txt in place, tokenize into text.html (stable s-N sentence IDs), then read each vocabulary feature from schemas/feature-vocabulary.json and populate features.json with value + sentence citations + external references. Resumable per feature via .progress.json.
---

# extract-features

## Inputs
- License `id` (required).
- Optional `--feature=<key>` flag to scope the run to a single vocabulary key (used by `/backfill-feature`).

## Outputs (under `licenses/<id>/`)
- `text.html` — `<span id="s-N" class="sentence">...</span>` per sentence, contiguous IDs from 0.
- `features.json` — entries in `permissions`, `conditions`, `limitations`; each has `value`, `citations[]`, `external_references[]`, optional `commentary`.
- `.progress.json` — `extract_features.status`, `completed_keys[]`, `remaining_keys[]`, `last_error`, `updated_at`.

## Procedure

### 1. Read progress
If `extract_features.status === "complete"` and no `--feature` flag: print `already complete` and stop. Otherwise read `completed_keys` so we skip what's already done.

### 2. Tokenize text (idempotent)
Run:
```
node -e "
  import('./scripts/tokenizer.mjs').then(async m => {
    const fs = await import('node:fs/promises');
    const raw = await fs.readFile('licenses/<id>/text.raw.txt','utf8');
    const { html } = m.tokenizeToHtml(raw);
    await fs.writeFile('licenses/<id>/text.html', html + '\n');
  });
"
```

The tokenizer in `scripts/tokenizer.mjs` is deterministic: re-running yields the same bytes, so sentence IDs are stable across runs.

### 3. Load vocabulary
Read `schemas/feature-vocabulary.json`. Collect every key into an ordered list (permissions first, then conditions, then limitations, preserving vocabulary order).

### 4. Determine keys to process
```
keys_to_process = {requested_key} if --feature else (vocab_keys - completed_keys)
```

### 5. For each key in keys_to_process
a. **Read the license text.** Find the sentence(s) in `licenses/<id>/text.html` (via the plaintext extractable from `<span class="sentence">`) that address this feature.
b. **Decide the value** from {`permitted`, `required`, `forbidden`, `silent`, `grey`}. Never use `not_assessed` — that's reserved for keys that have never been processed.
c. **Citations.** Record every sentence ID that grounds the value. `silent` entries have no citations.
d. **External references.** If your determination relies on anything beyond the license text itself (FSF FAQ, court ruling, Luis Villa commentary, TLDR Legal summary), add entries to `external_references` with full provenance: `source`, `url`, `retrieved_at`, and one of `excerpt` (verbatim) or `summary` (paraphrase).
e. **Grey areas.** For `value === "grey"` you **must** provide at least one `citation` OR one `external_reference`. The CI validator enforces this; entries without sources fail.
f. **Commentary.** Free-text paragraph explaining the nuance. Required for grey; optional otherwise. Same sourcing rule — if commentary introduces a claim that isn't in the license text, cite where it came from.
g. **Write the feature entry** into the correct group in `features.json` using write-temp-then-rename (atomic). If the group already has an entry for this key (from a prior run), replace it.
h. **Update `.progress.json`.** Append key to `completed_keys`, remove from `remaining_keys`, set `updated_at` to now. Atomic rename.

### 6. Aggregate file-level sources
After processing all keys, walk every entry in `features.json` and collect distinct (source, url) pairs into the file-level `sources[]` array. Always include the license text itself:
```json
{ "source": "license text", "url": "licenses/<id>/text.html", "role": "primary evidence" }
```

### 7. Mark complete
If no `--feature` scope and all vocabulary keys are now in `completed_keys`, set `extract_features.status = "complete"`. If `--feature`, only flip to `complete` when every vocab key is covered.

### 8. Validate
Run `npm run validate`. On failure: set status `failed`, write `last_error`, leave the completed keys intact so re-runs continue from where you stopped.

## Required sourcing

- Every `grey` value or non-empty `commentary` MUST have at least one citation or external reference. No exceptions. The validator catches this.
- External references must include `source`, `url`, `retrieved_at`, and one of `excerpt` or `summary`.
- Your own general knowledge is not a source. If you're making a claim about how the license is interpreted, cite where that interpretation comes from.

## Tokenizer guarantees

- `scripts/tokenizer.mjs` is idempotent, deterministic.
- Sentence IDs are dense (`s-0, s-1, ..., s-N`), no gaps. CI validates.
- Paragraph breaks force sentence boundaries even without terminators (so a title line becomes its own sentence).

## Failure modes
- Feature genuinely ambiguous with no citable source → `value: "grey"` + commentary explaining the ambiguity + cite TLDR Legal or the closest available reference. Never skip sourcing.
- Tokenizer surprise → add to `ABBREVS` in `scripts/tokenizer.mjs`, re-tokenize. Existing IDs for unaffected sentences remain the same.
- Write fails mid-feature → key not marked complete, next run retries.
