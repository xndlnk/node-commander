import { readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';

// Recursively sum file sizes under a directory. Uses lstat so symlinks are
// counted by their own (tiny) size and never followed — avoids cycles and
// double-counting. Unreadable subtrees are skipped rather than aborting.
export async function dirSize(path: string): Promise<number> {
  let total = 0;
  let dirents;
  try {
    dirents = await readdir(path, { withFileTypes: true });
  } catch {
    return total;
  }
  for (const dirent of dirents) {
    const full = join(path, dirent.name);
    try {
      const st = await lstat(full);
      if (st.isSymbolicLink()) {
        total += st.size;
      } else if (st.isDirectory()) {
        total += await dirSize(full);
      } else {
        total += st.size;
      }
    } catch {
      // Skip entries we cannot stat.
    }
  }
  return total;
}
