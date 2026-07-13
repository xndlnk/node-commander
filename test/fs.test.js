import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, parse } from 'node:path';
import { listDir, isRoot } from '../src/core/fs.ts';

async function makeTree() {
  const base = await mkdtemp(join(tmpdir(), 'ne-fs-'));
  await mkdir(join(base, 'zebra'));
  await mkdir(join(base, 'Alpha'));
  await writeFile(join(base, 'banana.txt'), 'hello');
  await writeFile(join(base, 'apple.txt'), 'x');
  return base;
}

test('listDir: dirs first, then files, alphabetical', async () => {
  const base = await makeTree();
  try {
    const entries = await listDir(base);
    const names = entries.map((e) => e.name);
    // .. leads, then dirs (Alpha, zebra), then files (apple, banana).
    assert.equal(names[0], '..');
    assert.deepEqual(names.slice(1), ['Alpha', 'zebra', 'apple.txt', 'banana.txt']);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('listDir: directories flagged and file size read', async () => {
  const base = await makeTree();
  try {
    const entries = await listDir(base);
    const byName = Object.fromEntries(entries.map((e) => [e.name, e]));
    assert.equal(byName['Alpha'].isDir, true);
    assert.equal(byName['banana.txt'].isDir, false);
    assert.equal(byName['banana.txt'].size, 5); // 'hello'
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('listDir: no .. at filesystem root', async () => {
  const root = parse(process.cwd()).root;
  const entries = await listDir(root);
  assert.ok(!entries.some((e) => e.name === '..'));
});

test('isRoot: detects filesystem root', () => {
  const root = parse(process.cwd()).root;
  assert.equal(isRoot(root), true);
  assert.equal(isRoot(join(root, 'some', 'dir')), false);
});
