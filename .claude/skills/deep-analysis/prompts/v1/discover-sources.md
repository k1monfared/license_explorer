# Prompt v1 — discover-sources

**Purpose.** For a given license id and topic, identify the public sources
(court filings, legal-discuss archives, academic papers, respected blog
commentary) that illuminate how the license treats this topic in practice.

**Versioning.** This file is versioned (`v1`). When the skill evolves,
create `v2/` alongside; do not edit older versions. Log the version used
for each source-discovery step in `analysis-log.jsonl`.

## Input

- `license_id`: e.g. `gpl-3.0`, `agpl-3.0`, `cc0-1.0`.
- `topic`: either a feature-vocabulary key (e.g. `network-use-disclose`) or
  a named topic (`enforcement-history`, `notable-court-cases`,
  `relicensing-controversy`).
- (Optional) `prior_sources`: list of URLs already archived for this
  license/topic to avoid re-fetching.

## Procedure

1. Prefer sources from this order of authority, and prefer official
   archival locations over third-party mirrors:
   - **CourtListener / RECAP** (`https://www.courtlistener.com/`) — court
     opinions and filings.
   - **FSF licensing archives** — `https://lists.gnu.org/archive/` for
     legal-discuss, `https://www.gnu.org/licenses/gpl-faq.html`.
   - **Apache legal-discuss** — `https://lists.apache.org/list.html?legal-discuss@apache.org`.
   - **Luis Villa's writing** — `https://lu.is/` and `https://archive.org/`
     mirrors of earlier domains.
   - Open-access law review articles — DOI landing pages preferred over
     PDF mirrors.

2. For each candidate source, record:
   - `url`: the canonical URL to fetch.
   - `why`: one sentence on why this source is relevant to the topic.
   - `authority_tier`: `1` for court filings and official FAQs; `2` for
     legal-discuss archives and Luis Villa; `3` for academic; `4` for
     other respected commentary.

3. **Do not** use: private repositories, paywalled databases without
   authorized access, social media posts as primary sources, AI-generated
   summaries of other sources.

4. Output: a JSON array of candidate sources with the fields above. Write
   it as a draft to `licenses/<id>/.analysis-draft/<topic>-candidates.json`
   and log the step:
   ```
   node scripts/append-log.mjs <id> '{"step":"discover-sources","prompt_version":"v1","topic":"<topic>","candidates":<n>}'
   ```

## Completion criteria

- At least one tier-1 or tier-2 source per topic where public material
  exists. If the topic has no public record, log a note and mark the
  topic as skipped — do not fabricate sources.
