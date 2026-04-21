---
description: Run deep-analysis for a single license id (forces re-run even if status is complete).
argument-hint: <id>
allowed-tools: Skill, Read, Bash
---

# /refresh-analysis $ARGUMENTS

1. Reset `deep_analysis` in `licenses/$ARGUMENTS/.progress.json` to `{ "status": "pending", "updated_at": "<now>" }`, preserving the other stages.
2. Invoke the `deep-analysis` skill for `$ARGUMENTS`.
3. Run `npm run validate`.
4. Commit: `feat(analysis): refresh $ARGUMENTS`.
