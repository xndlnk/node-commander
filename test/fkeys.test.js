import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFKey } from '../src/util/fkeys.ts';

// Ink cannot surface F-keys through useInput, so we decode the raw stdin
// escape sequences ourselves (see src/ui/useFKeys.ts). decodeFKey matches the
// *entire* chunk exactly, so a single keypress maps to an id but pasted text
// containing the same bytes does not.

test('decodeFKey: F1–F4 SS3 sequences', () => {
  assert.equal(decodeFKey('\x1bOP'), 'F1');
  assert.equal(decodeFKey('\x1bOQ'), 'F2');
  assert.equal(decodeFKey('\x1bOR'), 'F3');
  assert.equal(decodeFKey('\x1bOS'), 'F4');
});

test('decodeFKey: F5–F10 CSI sequences', () => {
  assert.equal(decodeFKey('\x1b[15~'), 'F5');
  assert.equal(decodeFKey('\x1b[17~'), 'F6');
  assert.equal(decodeFKey('\x1b[18~'), 'F7');
  assert.equal(decodeFKey('\x1b[19~'), 'F8');
  assert.equal(decodeFKey('\x1b[20~'), 'F9');
  assert.equal(decodeFKey('\x1b[21~'), 'F10');
});

test('decodeFKey: a larger chunk (paste) is not an F-key', () => {
  // The exact bytes embedded in surrounding text must not match.
  assert.equal(decodeFKey('some text \x1b[15~ more'), null);
  assert.equal(decodeFKey('\x1b[15~\x1b[15~'), null);
});

test('decodeFKey: non-F-key input returns null', () => {
  assert.equal(decodeFKey('q'), null);
  assert.equal(decodeFKey(''), null);
  assert.equal(decodeFKey('\x1b[A'), null); // up arrow
});
