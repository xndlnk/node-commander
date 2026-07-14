// Shared type aliases. Type-only module: erased entirely at runtime.

export type Entry = {
  name: string;
  isDir: boolean;
  size: number;
  mtime: Date;
  // true once a directory's recursive size has been computed on demand (via `s`)
  sizeComputed?: boolean;
};

export type PaneState = {
  cwd: string;
  entries: Entry[];
  cursor: number;
  scrollOffset: number;
};

export type MenuItem = {
  key?: string;
  // When true, `key` also runs this entry directly from folder navigation
  // (not just inside the F2 menu).
  direct?: boolean;
  label: string;
  command: string;
};

// Modal state drives the Dialog / Viewer / MenuDialog overlays.
export type Modal =
  | { type: 'none' }
  | { type: 'confirm'; kind: ConfirmKind; message: string; onConfirm: () => void }
  | { type: 'input'; kind: InputKind; label: string; value: string; onSubmit: (value: string) => void }
  | { type: 'viewer'; path: string; name: string }
  | { type: 'menu' };

export type ConfirmKind = 'delete' | 'copy' | 'move' | 'overwrite';
export type InputKind = 'mkdir' | 'rename';
