import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copy, move, remove, makeDir, rename, exists } from '../src/core/ops.ts';
import { dirSize } from '../src/core/dirSize.ts';

async function tmp() {
  return mkdtemp(join(tmpdir(), 'ne-ops-'));
}

test('full round-trip: mkdir → copy → rename → move → delete', async () => {
  const base = await tmp();
  try {
    // makeDir
    const sub = join(base, 'sub');
    await makeDir(sub);
    assert.equal((await stat(sub)).isDirectory(), true);

    // copy a file
    const srcFile = join(base, 'a.txt');
    await writeFile(srcFile, 'content');
    const copied = join(sub, 'a.txt');
    await copy(srcFile, copied);
    assert.equal(await readFile(copied, 'utf8'), 'content');

    // rename in place
    const renamed = join(sub, 'b.txt');
    await rename(copied, renamed);
    assert.equal(await exists(copied), false);
    assert.equal(await exists(renamed), true);

    // move to another dir
    const dest2 = join(base, 'b.txt');
    await move(renamed, dest2);
    assert.equal(await exists(renamed), false);
    assert.equal(await readFile(dest2, 'utf8'), 'content');

    // delete
    await remove(dest2);
    assert.equal(await exists(dest2), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('copy: recursive directory tree', async () => {
  const base = await tmp();
  try {
    const src = join(base, 'tree');
    await mkdir(join(src, 'nested'), { recursive: true });
    await writeFile(join(src, 'nested', 'deep.txt'), 'x');
    const dest = join(base, 'tree-copy');
    await copy(src, dest);
    assert.equal(await readFile(join(dest, 'nested', 'deep.txt'), 'utf8'), 'x');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('move: same-device rename path', async () => {
  const base = await tmp();
  try {
    const src = join(base, 'x.txt');
    await writeFile(src, 'y');
    const dest = join(base, 'moved.txt');
    await move(src, dest);
    assert.equal(await exists(src), false);
    assert.equal(await exists(dest), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('exists: reports presence', async () => {
  const base = await tmp();
  try {
    assert.equal(await exists(join(base, 'nope')), false);
    await writeFile(join(base, 'yes'), '');
    assert.equal(await exists(join(base, 'yes')), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('dirSize: sums a known tree', async () => {
  const base = await tmp();
  try {
    // 5 + 3 + 4 = 12 bytes across two levels.
    await writeFile(join(base, 'a'), 'hello'); // 5
    await mkdir(join(base, 'd'));
    await writeFile(join(base, 'd', 'b'), 'abc'); // 3
    await writeFile(join(base, 'd', 'c'), 'wxyz'); // 4
    assert.equal(await dirSize(base), 12);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
