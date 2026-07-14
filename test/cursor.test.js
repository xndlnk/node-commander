import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCursor } from '../src/core/cursor.ts';

// Minimal Entry-shaped objects; resolveCursor only looks at `name`.
function entries(...names) {
  return names.map((name) => ({ name, isDir: false, size: 0, mtime: new Date(0) }));
}

test('resolveCursor: keepName lands on the matching entry', () => {
  const list = entries('a', 'b', 'c');
  assert.equal(resolveCursor(list, { keepName: 'b' }), 1);
  assert.equal(resolveCursor(list, { keepName: 'c' }), 2);
});

test('resolveCursor: keepName survives reordering', () => {
  // The selected file moved from index 0 to index 2 after a reload.
  assert.equal(resolveCursor(entries('x', 'y', 'target'), { keepName: 'target' }), 2);
});

test('resolveCursor: missing keepName falls back to keepCursor', () => {
  const list = entries('a', 'b', 'c');
  assert.equal(resolveCursor(list, { keepName: 'gone', keepCursor: 2 }), 2);
});

test('resolveCursor: missing keepName with no keepCursor falls back to top', () => {
  assert.equal(resolveCursor(entries('a', 'b'), { keepName: 'gone' }), 0);
});

test('resolveCursor: keepCursor holds the same position', () => {
  assert.equal(resolveCursor(entries('a', 'b', 'c'), { keepCursor: 1 }), 1);
});

test('resolveCursor: keepCursor clamps past the end', () => {
  assert.equal(resolveCursor(entries('a', 'b'), { keepCursor: 9 }), 1);
});

test('resolveCursor: keepCursor clamps negative to 0', () => {
  assert.equal(resolveCursor(entries('a', 'b'), { keepCursor: -3 }), 0);
});

test('resolveCursor: empty listing is always 0', () => {
  assert.equal(resolveCursor([], { keepName: 'a' }), 0);
  assert.equal(resolveCursor([], { keepCursor: 5 }), 0);
});

test('resolveCursor: no hint defaults to top', () => {
  assert.equal(resolveCursor(entries('a', 'b', 'c')), 0);
});
