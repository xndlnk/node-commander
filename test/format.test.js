import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSize,
  formatDate,
  padName,
  padLeft,
  truncateMiddle,
} from '../src/util/format.ts';

test('formatSize: bytes under 1K', () => {
  assert.equal(formatSize(0), '0 B');
  assert.equal(formatSize(512), '512 B');
  assert.equal(formatSize(1023), '1023 B');
});

test('formatSize: KB/MB/GB', () => {
  assert.equal(formatSize(1024), '1.0 K');
  assert.equal(formatSize(1536), '1.5 K');
  assert.equal(formatSize(1024 * 1024), '1.0 M');
  assert.equal(formatSize(1024 * 1024 * 1024), '1.0 G');
});

test('formatSize: invalid input', () => {
  assert.equal(formatSize(-1), '');
  assert.equal(formatSize(NaN), '');
});

test('formatDate: fixed width', () => {
  const d = new Date(2026, 6, 13, 9, 5); // 2026-07-13 09:05
  assert.equal(formatDate(d), '2026-07-13 09:05');
});

test('padName: pad and truncate', () => {
  assert.equal(padName('ab', 5), 'ab   ');
  assert.equal(padName('abcde', 5), 'abcde');
  assert.equal(padName('abcdef', 5), 'abcd…');
});

test('padLeft: right-align', () => {
  assert.equal(padLeft('12', 5), '   12');
  assert.equal(padLeft('12345', 3), '12345');
});

test('truncateMiddle: keeps both ends', () => {
  assert.equal(truncateMiddle('/a/b/c', 10), '/a/b/c');
  const out = truncateMiddle('/very/long/path/to/somewhere', 12);
  assert.equal(out.length, 12);
  assert.ok(out.includes('…'));
  assert.ok(out.startsWith('/'));
});
