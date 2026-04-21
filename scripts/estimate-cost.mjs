#!/usr/bin/env node
// Compute a rough, repo-derived estimate of how much LLM usage it took to
// produce the current catalog, using the best-documented license (currently
// gpl-3.0-only) as the per-license benchmark and scaling by catalog size.
//
// Writes licenses/cost-estimate.json so the About page can render a live
// number that updates whenever the catalog or archived sources change.
//
// The numbers here are an ORDER-OF-MAGNITUDE estimate, not an exact bill.
// Actual API usage includes prompting overhead, multi-turn context, retries,
// and tool-call loops that the raw artifact bytes don't capture. Treat the
// output as "about this much", not "exactly this much".

import fs from 'node:fs/promises';
import path from 'node:path';

// Claude Opus 4.7 public list prices (per 1M tokens, in USD), as of the
// commit that first lands this script. Update here when pricing changes.
const PRICE = {
  input_per_mtok:  15.00,
  output_per_mtok: 75.00,
  model: 'claude-opus-4-7'
};

// Approximate bytes → tokens conversion for mostly-English text.
const BYTES_PER_TOKEN = 3.5;

const BENCHMARK_ID = 'gpl-3.0-only';

async function safeSize(p) {
  try { const s = await fs.stat(p); return s.size; } catch { return 0; }
}

async function dirBytes(p) {
  try {
    const ents = await fs.readdir(p);
    let total = 0;
    for (const name of ents) total += await safeSize(path.join(p, name));
    return total;
  } catch { return 0; }
}

// Input proxy: everything the pipeline reads.
//   - canonical license text (text.raw.txt)
//   - features.json the analysis phase draws from
//   - archived sources (the single biggest input by volume)
// Output proxy: everything the pipeline writes beyond raw inputs.
//   - text.html (tokenized)
//   - features.json (feature extraction output)
//   - analysis.json (synthesized entries)
//   - .progress.json / analysis-log.jsonl
async function measureLicense(id) {
  const dir = `licenses/${id}`;
  const inputBytes =
    (await safeSize(`${dir}/text.raw.txt`)) +
    (await safeSize(`${dir}/features.json`)) +
    (await dirBytes(`${dir}/analysis-sources`));
  const outputBytes =
    (await safeSize(`${dir}/text.html`)) +
    (await safeSize(`${dir}/features.json`)) +
    (await safeSize(`${dir}/analysis.json`)) +
    (await safeSize(`${dir}/meta.json`)) +
    (await safeSize(`${dir}/.progress.json`)) +
    (await safeSize(`${dir}/analysis-log.jsonl`));
  return { input_bytes: inputBytes, output_bytes: outputBytes };
}

function estimateCost({ input_bytes, output_bytes }) {
  // Add a 2× multiplier to input bytes to account for conversational
  // overhead (system prompts, skill content, multi-turn context that the
  // raw artifacts don't directly reflect). Output bytes are closer to the
  // observed output.
  const input_tokens  = Math.round((input_bytes * 2) / BYTES_PER_TOKEN);
  const output_tokens = Math.round(output_bytes / BYTES_PER_TOKEN);
  const cost_usd =
    (input_tokens  / 1_000_000) * PRICE.input_per_mtok +
    (output_tokens / 1_000_000) * PRICE.output_per_mtok;
  return { input_tokens, output_tokens, cost_usd };
}

const catalog = JSON.parse(await fs.readFile('licenses/index.json', 'utf8'));

// Find every license that has an analysis.json — those are the ones that
// have gone through the deep-analysis pipeline and therefore carry the full
// set of input + output byte footprint. Use them as the sample for the
// per-license average. Fall back to the single GPL-3.0 benchmark only when
// nothing else is available.
let analysisIndex = {};
try { analysisIndex = JSON.parse(await fs.readFile('licenses/analysis-index.json', 'utf8')); }
catch {}
const analyzedIds = Object.keys(analysisIndex);

let mode, sample, perLicense, sampleDetails = [];
if (analyzedIds.length >= 2) {
  mode = 'average';
  let totalIn = 0, totalOut = 0;
  for (const id of analyzedIds) {
    const m = await measureLicense(id);
    totalIn += m.input_bytes;
    totalOut += m.output_bytes;
    const c = estimateCost(m);
    sampleDetails.push({ license_id: id, cost_usd: Number(c.cost_usd.toFixed(4)) });
  }
  sample = { input_bytes: Math.round(totalIn / analyzedIds.length), output_bytes: Math.round(totalOut / analyzedIds.length) };
  perLicense = estimateCost(sample);
} else {
  mode = 'benchmark';
  const id = analyzedIds[0] || BENCHMARK_ID;
  sample = await measureLicense(id);
  perLicense = estimateCost(sample);
  sampleDetails.push({ license_id: id, cost_usd: Number(perLicense.cost_usd.toFixed(4)) });
}

const out = {
  calculated_at: new Date().toISOString(),
  pricing_model: PRICE.model,
  price_input_per_mtok: PRICE.input_per_mtok,
  price_output_per_mtok: PRICE.output_per_mtok,
  bytes_per_token: BYTES_PER_TOKEN,
  mode,
  analyzed_count: analyzedIds.length,
  sample: {
    input_bytes: sample.input_bytes,
    output_bytes: sample.output_bytes,
    input_tokens: perLicense.input_tokens,
    output_tokens: perLicense.output_tokens,
    cost_usd: Number(perLicense.cost_usd.toFixed(4))
  },
  sample_details: sampleDetails,
  licenses_count: catalog.length,
  avg_cost_per_license_usd: Number(perLicense.cost_usd.toFixed(4)),
  total_cost_usd: Number((perLicense.cost_usd * catalog.length).toFixed(4)),
  note: mode === 'average'
    ? `Order-of-magnitude estimate. Per-license cost is the mean across ${analyzedIds.length} licenses that currently have deep-analysis runs. Total scales that mean up to the full ${catalog.length}-license catalog. Input bytes = license text + features + archived sources; output bytes = tokenized HTML + features + analysis + progress + log. Conversational overhead is approximated with a 2× multiplier on input. The average will refine further as more licenses are analyzed.`
    : `Order-of-magnitude estimate. Only one license (${analyzedIds[0] || BENCHMARK_ID}) has a deep-analysis run yet, so the per-license figure is benchmarked off that single data point. As soon as a second license is analyzed, this estimate will switch automatically to a true mean across all analyzed licenses.`
};

await fs.writeFile('licenses/cost-estimate.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
