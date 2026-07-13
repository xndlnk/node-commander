import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMenu } from '../src/core/menu.ts';

async function withFile(contents, fn) {
  const base = await mkdtemp(join(tmpdir(), 'ne-menu-'));
  const path = join(base, 'menu.json');
  try {
    if (contents !== null) await writeFile(path, contents);
    await fn(path);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

test('loadMenu: valid config parses to entries', async () => {
  const cfg = JSON.stringify({
    items: [
      { key: 'g', label: 'Git status', command: 'git status' },
      { label: 'Build', command: 'npm run build' },
    ],
  });
  await withFile(cfg, (path) => {
    const res = loadMenu(path);
    assert.equal(res.items.length, 2);
    assert.deepEqual(res.items[0], { key: 'g', label: 'Git status', command: 'git status' });
    assert.deepEqual(res.items[1], { label: 'Build', command: 'npm run build' });
    assert.equal(res.reason, undefined);
  });
});

test('loadMenu: bare array is also accepted', async () => {
  const cfg = JSON.stringify([{ label: 'Ls', command: 'ls -la' }]);
  await withFile(cfg, (path) => {
    const res = loadMenu(path);
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].command, 'ls -la');
  });
});

test('loadMenu: malformed JSON → empty with reason', async () => {
  await withFile('{ not valid json', (path) => {
    const res = loadMenu(path);
    assert.equal(res.items.length, 0);
    assert.match(res.reason, /Malformed JSON/);
  });
});

test('loadMenu: missing file → empty with reason', async () => {
  await withFile(null, (path) => {
    const res = loadMenu(path);
    assert.equal(res.items.length, 0);
    assert.match(res.reason, /No menu file/);
  });
});

test('loadMenu: invalid entries are filtered out', async () => {
  const cfg = JSON.stringify({
    items: [
      { label: 'Good', command: 'echo ok' },
      { label: 'No command' }, // missing command
      { command: 'echo nope' }, // missing label
      { label: '', command: 'x' }, // empty label
      'not an object',
      { label: 'Multichar key', command: 'echo', key: 'abc' }, // key dropped, entry kept
    ],
  });
  await withFile(cfg, (path) => {
    const res = loadMenu(path);
    assert.equal(res.items.length, 2);
    assert.equal(res.items[0].label, 'Good');
    assert.equal(res.items[1].label, 'Multichar key');
    assert.equal(res.items[1].key, undefined); // invalid multichar key dropped
  });
});

test('loadMenu: valid file with no valid entries → reason set', async () => {
  const cfg = JSON.stringify({ items: [{ label: 'x' }] });
  await withFile(cfg, (path) => {
    const res = loadMenu(path);
    assert.equal(res.items.length, 0);
    assert.match(res.reason, /No valid entries/);
  });
});
