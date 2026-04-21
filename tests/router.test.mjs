import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, serializeCompare } from '../scripts/router.mjs';

test('parses #/ as browse route', () => {
  assert.deepEqual(parseRoute('#/'), { name: 'browse' });
});

test('parses #/license/<id>', () => {
  assert.deepEqual(parseRoute('#/license/mit'), { name: 'detail', id: 'mit' });
});

test('parses #/license/<id>/text', () => {
  assert.deepEqual(parseRoute('#/license/mit/text'), { name: 'text', id: 'mit' });
});

test('parses #/compare?set=mit,gpl-3.0', () => {
  assert.deepEqual(
    parseRoute('#/compare?set=mit,gpl-3.0'),
    { name: 'compare', ids: ['mit', 'gpl-3.0'] }
  );
});

test('serializes compare set back to hash', () => {
  assert.equal(serializeCompare(['mit', 'gpl-3.0']), '#/compare?set=mit,gpl-3.0');
});

test('parseRoute defaults to browse for unknown hashes', () => {
  assert.deepEqual(parseRoute('#/garbage'), { name: 'browse' });
});

test('parses ids that contain dots (SPDX-style)', () => {
  assert.deepEqual(parseRoute('#/license/apache-2.0'),      { name: 'detail', id: 'apache-2.0' });
  assert.deepEqual(parseRoute('#/license/cc-by-sa-4.0/text'),{ name: 'text',   id: 'cc-by-sa-4.0' });
});
