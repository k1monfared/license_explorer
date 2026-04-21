import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeToHtml, extractSentences, splitSentences } from '../scripts/tokenizer.mjs';

test('splits on period with space', () => {
  const { sentences } = tokenizeToHtml('First. Second. Third.');
  assert.equal(sentences.length, 3);
});

test('does not split on common abbreviations', () => {
  const { sentences } = tokenizeToHtml('See Dr. Smith. Then go.');
  assert.equal(sentences.length, 2);
  assert.equal(sentences[0], 'See Dr. Smith.');
});

test('idempotent: re-tokenizing same text produces same html', () => {
  const t = 'One. Two. Three.';
  const a = tokenizeToHtml(t);
  const b = tokenizeToHtml(t);
  assert.equal(a.html, b.html);
});

test('handles question and exclamation marks', () => {
  const { sentences } = tokenizeToHtml('What? Yes! Go.');
  assert.equal(sentences.length, 3);
});

test('extractSentences pulls plain text back from html', () => {
  const { html } = tokenizeToHtml('Alpha. Beta.');
  assert.deepEqual(extractSentences(html), ['Alpha.', 'Beta.']);
});

test('single sentence without terminator still gets id', () => {
  const { sentences } = tokenizeToHtml('Just one sentence');
  assert.equal(sentences.length, 1);
  assert.equal(sentences[0], 'Just one sentence');
});

test('preserves paragraph breaks between sentences', () => {
  const { html } = tokenizeToHtml('Para one.\n\nPara two.');
  assert.match(html, /id="s-0"[^<]*Para one\./);
  assert.match(html, /id="s-1"[^<]*Para two\./);
  assert.match(html, /<br><br>/);
});

test('emits sequential s-N ids starting at 0', () => {
  const { html } = tokenizeToHtml('A. B. C. D.');
  for (let i = 0; i < 4; i++) assert.match(html, new RegExp(`id="s-${i}"`));
});

test('splitSentences handles empty input', () => {
  assert.deepEqual(splitSentences(''), []);
});

test('splitSentences handles only whitespace', () => {
  assert.deepEqual(splitSentences('   \n\n   '), []);
});

test('paragraph break forces sentence boundary without terminator', () => {
  const s = splitSentences('Title\n\nCopyright holder\n\nBody of text ending with period.');
  assert.equal(s.length, 3);
  assert.equal(s[0], 'Title');
  assert.equal(s[1], 'Copyright holder');
  assert.equal(s[2], 'Body of text ending with period.');
});

test('multiple terminated sentences in one paragraph stay split', () => {
  const s = splitSentences('First sentence. Second sentence.\n\nThird.');
  assert.deepEqual(s, ['First sentence.', 'Second sentence.', 'Third.']);
});
