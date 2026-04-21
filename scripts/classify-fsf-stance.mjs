#!/usr/bin/env node
// Apply the nuanced FSF-stance classification to every license's meta.json.
// The mapping below was built by reading the archived FSF license list
// (licenses/<id>/analysis-sources/450a28ca….html in many licenses) and
// cross-referencing FSF's category headings and per-entry commentary.
//
// Stance values:
//   endorsed       — Free + GPL-compatible. FSF's default "yes use this".
//   accepted       — Free but GPL-incompatible, or Free + FSF notes
//                    reservations (patent-grant concerns, awkwardness),
//                    but not actively discouraged.
//   non-software   — Free license for non-software works (documentation,
//                    fonts, media, data). FSF does not list software
//                    freedom guarantees for these but endorses them for
//                    their intended medium.
//   discouraged    — Free but FSF explicitly recommends AGAINST using
//                    (e.g. WTFPL — no warranty disclaimer; NOSL with
//                    DRM concerns).
//   nonfree        — Does NOT meet FSF's free-software definition.
//   unclassified   — Not listed on FSF's license page. Includes newer
//                    hardware licenses, source-available licenses, etc.
//
// Re-run after adding a license: node scripts/classify-fsf-stance.mjs

import fs from 'node:fs/promises';

const STANCES = {
  // Software — endorsed (free + GPL-compatible, FSF's preferred)
  'mit':               { stance: 'endorsed',     note: 'Simple permissive free software license; GPL-compatible. FSF lists as "Expat License".' },
  'bsd-2-clause':      { stance: 'endorsed',     note: 'Free software, GPL-compatible. FSF lists as "FreeBSD License".' },
  'bsd-3-clause':      { stance: 'endorsed',     note: 'Free software, GPL-compatible. FSF lists as "Modified BSD License".' },
  '0bsd':              { stance: 'endorsed',     note: 'Free software, GPL-compatible. Public-domain-equivalent; FSF-compatible.' },
  'isc':               { stance: 'endorsed',     note: 'Free software, GPL-compatible. FSF notes the "and/or" wording clarification in 2007.' },
  'zlib':              { stance: 'endorsed',     note: 'Simple permissive free software license; GPL-compatible.' },
  'bsl-1.0':           { stance: 'endorsed',     note: 'Boost Software License; free software, GPL-compatible.' },
  'upl-1.0':           { stance: 'endorsed',     note: 'Universal Permissive License; free, with explicit patent grant; GPL-compatible.' },
  'unlicense':         { stance: 'endorsed',     note: 'Public-domain-equivalent; GPL-compatible. FSF notes it works but recommends CC0 for stronger legal footing.' },
  'psf-2.0':           { stance: 'endorsed',     note: 'Python Software Foundation License 2.0; free, GPL-compatible.' },
  'ms-pl':             { stance: 'accepted',     note: 'Free software but GPL-INCOMPATIBLE due to licensing terms. FSF recommends against its use where GPL-compatibility matters.' },
  'artistic-2.0':      { stance: 'endorsed',     note: 'Perl\'s license; free + GPL-compatible with a menu-style compliance model.' },
  'apache-2.0':        { stance: 'endorsed',     note: 'Free + GPL-compatible (GPLv3 only). Explicit patent grant. FSF recommends for projects that want a permissive license with patent protection.' },
  'mpl-2.0':           { stance: 'endorsed',     note: 'Free + GPL-compatible via Secondary Licenses mechanism (§3.3). File-level weak copyleft.' },

  // Software — accepted (free but GPL-incompatible, or reserved)
  'epl-1.0':           { stance: 'accepted',     note: 'Free but GPL-INCOMPATIBLE due to choice-of-venue and indemnification. FSF recommends GPL-compatible alternatives.' },
  'epl-2.0':           { stance: 'accepted',     note: 'Free; GPL-incompatible by default but optionally GPL-compatible via Exhibit A Secondary License. FSF considers this an improvement over EPL-1.0.' },
  'cddl-1.0':          { stance: 'accepted',     note: 'Free but GPL-INCOMPATIBLE. FSF notes this is why ZFS cannot be merged into the Linux kernel.' },
  'ms-rl':             { stance: 'accepted',     note: 'Free but GPL-incompatible file-level reciprocal license.' },

  // Software — GPL family (endorsed as reference implementation of free software)
  'gpl-2.0-only':      { stance: 'endorsed',     note: 'FSF\'s own strong-copyleft license. Free + GPL-compatible with itself.' },
  'gpl-3.0-only':      { stance: 'endorsed',     note: 'FSF\'s current recommended strong-copyleft license. Explicit patent grant, anti-tivoization.' },
  'lgpl-2.1-only':     { stance: 'endorsed',     note: 'FSF\'s weak-copyleft license for libraries; GPL-compatible.' },
  'lgpl-3.0-only':     { stance: 'endorsed',     note: 'Updated LGPL, layered over GPLv3; GPL-compatible with patent grant.' },
  'agpl-3.0-only':     { stance: 'endorsed',     note: 'FSF\'s network-copyleft license. Closes the SaaS loophole in GPLv3. GPL-compatible.' },

  // Software — EUPL (special: compatibility-clause bridges EUPL and GPL)
  'eupl-1.2':          { stance: 'accepted',     note: 'Free; GPL-compatible only via the §5 Compatibility Clause / Appendix. FSF lists as a Free Software License with compatibility caveat.' },

  // Non-software (FSF has separate section for documentation, fonts, media)
  'gfdl-1.3-only':     { stance: 'non-software', note: 'FSF\'s documentation license. Free for documentation; not for software. FSF endorses for its intended scope.' },
  'ofl-1.1':           { stance: 'non-software', note: 'Free license for fonts. FSF endorses for font files; GPL-compatible-ish for embedded use.' },
  'cc0-1.0':           { stance: 'accepted',     note: 'Public-domain dedication. FSF accepts as GPL-compatible free software, but notes the explicit patent non-grant. For non-software, FSF recommends it broadly.' },
  'cc-by-4.0':         { stance: 'non-software', note: 'Free license for creative works; FSF endorses for works of opinion and artistic works; not for software.' },
  'cc-by-sa-4.0':      { stance: 'non-software', note: 'Free copyleft for creative works. FSF endorses for non-software works. One-way compatible with GPLv3 for software-plus-media cases.' },
  'cc-by-3.0':         { stance: 'non-software', note: 'Older version of CC-BY. FSF accepts for non-software works.' },
  'cc-by-sa-3.0':      { stance: 'non-software', note: 'Older ShareAlike. FSF accepts for non-software works. Legacy Wikipedia license through 2023.' },

  // Nonfree — creative works with restrictions FSF considers incompatible with freedom
  'cc-by-nd-4.0':      { stance: 'nonfree',      note: 'FSF classifies CC-BY-ND as NONFREE for works of practical use because no-derivatives restricts modification. Acceptable only for opinion/statement works.' },
  'cc-by-nc-4.0':      { stance: 'nonfree',      note: 'FSF classifies NonCommercial licenses as NONFREE. The commercial-use restriction is considered incompatible with the freedoms FSF requires.' },
  'cc-by-nc-sa-4.0':   { stance: 'nonfree',      note: 'Same as CC-BY-NC but with ShareAlike. NC makes it nonfree per FSF.' },
  'cc-by-nc-nd-4.0':   { stance: 'nonfree',      note: 'Most restrictive CC license. Both NC and ND make it nonfree per FSF.' },

  // Nonfree — software licenses FSF actively rejects
  'bsd-4-clause':      { stance: 'nonfree',      note: 'The original 4-clause BSD. FSF classifies as NONFREE because the advertising clause (§3) imposes multi-notice burdens that are impractical when many such works are combined.' },

  // Discouraged — free but FSF recommends against
  'wtfpl':             { stance: 'discouraged',  note: 'Free software but FSF warns against using it. Lacks a warranty disclaimer, which creates legal risk for licensors. FSF recommends CC0 or MIT as alternatives.' },

  // Unclassified — not on FSF's license list (hardware, source-available, pre-OSS era)
  'cern-ohl-p-2.0':    { stance: 'unclassified', note: 'Open-hardware license; FSF\'s license page focuses on software, does not classify hardware licenses. OSI-approved as open-source-equivalent for hardware.' },
  'cern-ohl-w-2.0':    { stance: 'unclassified', note: 'Open-hardware license; FSF does not classify hardware licenses.' },
  'cern-ohl-s-2.0':    { stance: 'unclassified', note: 'Open-hardware license; FSF does not classify hardware licenses.' },
  'tapr-ohl-1.0':      { stance: 'unclassified', note: 'Open-hardware license (2007); not on FSF\'s list. Predates OSI\'s open-hardware endorsement process.' },
  'busl-1.1':          { stance: 'nonfree',      note: 'Source-available, NOT free software. FSF does not list BUSL but it falls outside FSF\'s free-software definition due to the commercial-use restriction until the Change Date.' },
  'elastic-2.0':       { stance: 'nonfree',      note: 'Source-available, NOT free software. FSF does not list ELv2; the managed-service prohibition makes it incompatible with FSF\'s freedoms.' },
  'sspl-1.0':          { stance: 'nonfree',      note: 'Source-available, NOT free software. FSF does not list SSPL; OSI explicitly rejected it. The §13 service-source requirement is considered overreach even by FSF\'s strong-copyleft standards.' },
  'polyform-noncommercial-1.0.0': { stance: 'nonfree', note: 'Source-available with noncommercial restriction. NOT free software. FSF does not list Polyform.' }
};

const now = new Date().toISOString();
let updated = 0;
let missing = [];

const catalog = JSON.parse(await fs.readFile('licenses/index.json', 'utf8'));
for (const entry of catalog) {
  const stanceInfo = STANCES[entry.id];
  if (!stanceInfo) { missing.push(entry.id); continue; }

  const metaPath = `licenses/${entry.id}/meta.json`;
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  let changed = false;
  for (const approval of meta.approvals) {
    if (approval.body !== 'FSF') continue;
    if (approval.stance !== stanceInfo.stance || approval.note !== stanceInfo.note) {
      approval.stance = stanceInfo.stance;
      approval.note = stanceInfo.note;
      approval.retrieved_at = now;
      changed = true;
    }
  }
  if (changed) {
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n');
    updated++;
  }
}

console.log(`updated ${updated} / ${catalog.length} licenses' FSF stance`);
if (missing.length) console.warn(`WARN: no stance mapping for: ${missing.join(', ')} — add them to STANCES in this script`);
