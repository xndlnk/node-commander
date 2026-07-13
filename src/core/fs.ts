import { readdir, lstat } from 'node:fs/promises';
import { join, parse } from 'node:path';
import type { Entry } from '../types.ts';

// Read a directory into a sorted Entry[]. Directories first, then files, each
// group alphabetical (locale-aware, case-insensitive). A leading `..` row is
// prepended unless cwd is the filesystem root. Directory sizes start at 0 and
// render as <DIR> until computed on demand.
export async function listDir(cwd: string): Promise<Entry[]> {
  const dirents = await readdir(cwd, { withFileTypes: true });
  const entries: Entry[] = [];

  for (const dirent of dirents) {
    const isDir = dirent.isDirectory();
    let size = 0;
    let mtime = new Date(0);
    try {
      // lstat: report the link itself, do not follow symlink targets.
      const st = await lstat(join(cwd, dirent.name));
      size = st.size;
      mtime = st.mtime;
    } catch {
      // Unreadable entry (permissions, race): keep it listed with defaults.
    }
    entries.push({ name: dirent.name, isDir, size: isDir ? 0 : size, mtime });
  }

  entries.sort(compareEntries);

  if (!isRoot(cwd)) {
    entries.unshift({ name: '..', isDir: true, size: 0, mtime: new Date(0) });
  }
  return entries;
}

// Dirs-first, then alphabetical (case-insensitive, locale-aware).
function compareEntries(a: Entry, b: Entry): number {
  if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'accent' });
}

export function isRoot(cwd: string): boolean {
  const { root, dir, base } = parse(cwd);
  // At root, there is no parent: dir === cwd and base is empty.
  return base === '' && dir === root;
}
