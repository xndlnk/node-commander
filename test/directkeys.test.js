import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDirectKeys, RESERVED_NAV_KEYS } from '../src/core/menu.ts';

test('analyzeDirectKeys: maps each direct entry by its key', () => {
  const items = [
    { key: 'g', direct: true, label: 'Git status', command: 'git status' },
    { key: 'l', direct: true, label: 'lazygit', command: 'lazygit' },
    { key: 'b', label: 'Not direct', command: 'echo' },
  ];
  const { map, warnings } = analyzeDirectKeys(items, RESERVED_NAV_KEYS);
  assert.equal(map.size, 2);
  assert.equal(map.get('g').label, 'Git status');
  assert.equal(map.get('l').label, 'lazygit');
  assert.equal(map.has('b'), false); // not flagged direct
  assert.deepEqual(warnings, []);
});

test('analyzeDirectKeys: reserved key is excluded from the map', () => {
  const items = [{ key: 'd', direct: true, label: 'Delete-ish', command: 'echo' }];
  const { map } = analyzeDirectKeys(items, RESERVED_NAV_KEYS);
  assert.equal(map.has('d'), false);
});

test('analyzeDirectKeys: duplicate direct key keeps the first item', () => {
  const items = [
    { key: 'g', direct: true, label: 'First', command: 'echo first' },
    { key: 'g', direct: true, label: 'Second', command: 'echo second' },
  ];
  const { map } = analyzeDirectKeys(items, RESERVED_NAV_KEYS);
  assert.equal(map.get('g').label, 'First');
});

test('analyzeDirectKeys: reserved-shadow direct key yields a warning', () => {
  const items = [{ key: 'd', direct: true, label: 'Delete-ish', command: 'echo' }];
  const { warnings } = analyzeDirectKeys(items, RESERVED_NAV_KEYS);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /shadowed by built-in/);
});

test('analyzeDirectKeys: duplicate direct key yields a warning', () => {
  const items = [
    { key: 'g', direct: true, label: 'First', command: 'echo first' },
    { key: 'g', direct: true, label: 'Second', command: 'echo second' },
  ];
  const { warnings } = analyzeDirectKeys(items, RESERVED_NAV_KEYS);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /duplicated/);
});

test('analyzeDirectKeys: direct entry without a key yields a warning', () => {
  const items = [{ direct: true, label: 'Keyless', command: 'echo' }];
  const { map, warnings } = analyzeDirectKeys(items, RESERVED_NAV_KEYS);
  assert.equal(map.size, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /has no key/);
});

test('analyzeDirectKeys: clean config yields no warnings', () => {
  const items = [
    { key: 'g', direct: true, label: 'Git status', command: 'git status' },
    { key: 'l', direct: true, label: 'lazygit', command: 'lazygit' },
  ];
  const { warnings } = analyzeDirectKeys(items, RESERVED_NAV_KEYS);
  assert.deepEqual(warnings, []);
});
