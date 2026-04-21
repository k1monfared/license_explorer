---
description: For a feature key in schemas/feature-vocabulary.json, iterate every license in licenses/index.json and run extract-features --feature=<key> for each. Licenses render 'not_assessed' until they have this feature populated.
argument-hint: <feature-key>
allowed-tools: Skill, Read, Bash
---

# /backfill-feature $ARGUMENTS

1. Verify `$ARGUMENTS` exists in `schemas/feature-vocabulary.json`. If not, stop with a clear error listing valid keys.
2. Read `licenses/index.json`.
3. For each catalog entry:
   - Invoke the `extract-features` skill with id and `--feature=$ARGUMENTS`.
   - On failure for a single license: record the error, continue with the next license; do not abort the whole pass.
4. After all licenses, run `npm run validate`.
5. Summarize (succeeded / failed / skipped).
6. Commit: `git add -A && git commit -m "feat: backfill feature $ARGUMENTS across all licenses"`.
