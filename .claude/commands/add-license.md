---
description: Run the full license pipeline (lookup-license → extract-features → deep-analysis) for a rough license name, resuming gracefully from any partial state.
argument-hint: <rough license name>
allowed-tools: Skill, Read, Write, Edit, Bash
---

# /add-license $ARGUMENTS

Run the license ingestion pipeline for `$ARGUMENTS`. Resume from partial state; never redo completed work.

## Procedure

1. **Disambiguate** the rough name to a canonical `id` (same logic as the lookup-license skill step 1; if ambiguous, ask via AskUserQuestion).

2. **Load or initialize `.progress.json`** at `licenses/<id>/.progress.json`.

3. **Stage 1 — lookup-license.**
   - If `lookup_license.status === "complete"`: print `lookup-license: already done`.
   - Else: invoke the `lookup-license` skill with the disambiguated id.
   - On success: ensure `.progress.json.lookup_license.status = complete`.
   - On failure: stop, print the error, do not continue.
   - **Checkpoint:** tell the user what was produced and pause for confirmation before continuing. Ask: "Lookup complete. Continue to feature extraction?"

4. **Stage 2 — extract-features.**
   - If `extract_features.status === "complete"`: print `extract-features: already done`.
   - Else (pending or partial): invoke the `extract-features` skill with the id. The skill itself resumes at the first non-complete key.
   - **Checkpoint:** list the feature values produced, any grey areas with commentary, then pause. Ask: "Extraction complete. Continue to deep analysis?"

5. **Stage 3 — deep-analysis (optional).**
   - Same pattern: skip if complete, invoke otherwise.
   - **Checkpoint:** summarize and stop.

6. **Run `npm run validate`** after each stage. If it fails, record the error in the relevant stage's `last_error` and stop.

## Retry behavior

- If any stage is `failed`, running `/add-license <name>` again attempts that stage from whatever partial state remains. Intrinsic failures (e.g. a key with no citable source) should be resolved by the user, after which clearing `last_error` and re-running continues.

## Atomic writes

All JSON writes use write-temp + rename. A crash mid-write never produces a truncated file.
