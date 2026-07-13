import { cp, rename as fsRename, rm, mkdir, stat } from 'node:fs/promises';

// Filesystem mutations. Each throws on failure so the caller can surface the
// error on the status line.

// Recursive copy. fs.cp handles files and directory trees.
export async function copy(src: string, dest: string): Promise<void> {
  await cp(src, dest, { recursive: true });
}

// Move via rename, falling back to copy+remove across devices (EXDEV).
export async function move(src: string, dest: string): Promise<void> {
  try {
    await fsRename(src, dest);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
      await cp(src, dest, { recursive: true });
      await rm(src, { recursive: true, force: true });
      return;
    }
    throw err;
  }
}

// Recursive delete; force so a missing path is not an error.
export async function remove(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export async function makeDir(path: string): Promise<void> {
  await mkdir(path);
}

// Rename in place (same directory) — also a plain fs.rename.
export async function rename(src: string, dest: string): Promise<void> {
  await fsRename(src, dest);
}

// Overwrite detection for copy/move destinations.
export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
