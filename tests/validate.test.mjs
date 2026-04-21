import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFile, validateTextHtml } from '../scripts/validate.mjs';

test('accepts a valid meta.json fixture', async () => {
  const r = await validateFile('tests/fixtures/valid-meta.json', 'meta');
  assert.equal(r.ok, true, r.errors?.join('\n'));
});

test('rejects an invalid meta.json fixture with a clear error', async () => {
  const r = await validateFile('tests/fixtures/invalid-meta.json', 'meta');
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /text_provenance/);
});

test('flags sentence id gaps in text.html', () => {
  const html = '<span id="s-0">A.</span><span id="s-2">C.</span>';
  const r = validateTextHtml(html);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /s-1/);
});

test('accepts contiguous sentence ids', () => {
  const html = '<span id="s-0">A.</span><span id="s-1">B.</span>';
  const r = validateTextHtml(html);
  assert.equal(r.ok, true);
});
