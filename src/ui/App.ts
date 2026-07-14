import React from 'react';
import { Box, useApp, useInput } from 'ink';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Modal, PaneState, Entry, MenuItem } from '../types.ts';
import { listDir } from '../core/fs.ts';
import { copy, move, remove, makeDir, rename, exists } from '../core/ops.ts';
import { dirSize } from '../core/dirSize.ts';
import { resolveCursor } from '../core/cursor.ts';
import type { CursorHint } from '../core/cursor.ts';
import { Pane } from './Pane.ts';
import { StatusBar } from './StatusBar.ts';
import { Dialog } from './Dialog.ts';
import { Viewer } from './Viewer.ts';
import { MenuDialog } from './MenuDialog.ts';
import { CenteredOverlay } from './CenteredOverlay.ts';
import { useFKeys } from './useFKeys.ts';
import { useShell } from './useShell.ts';
import { formatSize } from '../util/format.ts';
import { html } from './html.ts';

const { useState, useEffect, useCallback } = React;

// Rows consumed by chrome: pane border (2) + header (1) + footer w/ margin (2)
// + status bar (2). Leaves the rest for the file listing.
const CHROME_ROWS = 8;

function emptyPane(cwd: string): PaneState {
  return { cwd, entries: [], cursor: 0, scrollOffset: 0 };
}

type LoadOpts = CursorHint;

export function App() {
  const { exit } = useApp();
  const initialCwd = process.cwd();
  const [panes, setPanes] = useState<[PaneState, PaneState]>([
    emptyPane(initialCwd),
    emptyPane(initialCwd),
  ]);
  const [active, setActive] = useState<0 | 1>(0);
  const [modal, setModal] = useState<Modal>({ type: 'none' });
  const [status, setStatus] = useState('');

  const closeModal = useCallback(() => setModal({ type: 'none' }), []);
  const runInTerminal = useShell();

  // Quit, first recording the active pane's directory so a shell wrapper can
  // `cd` there. The child can't change the parent shell's cwd itself, so we
  // write it to the file named by $NC_CWD_FILE (set by the wrapper function).
  const quit = useCallback(() => {
    const cwdFile = process.env['NC_CWD_FILE'];
    if (cwdFile) {
      try {
        writeFileSync(cwdFile, panes[active].cwd);
      } catch {
        // Best-effort: still quit even if we can't write the file.
      }
    }
    exit();
  }, [panes, active, exit]);

  // Load a directory into a pane. Cursor placement: onto keepName if found,
  // else clamped to keepCursor, else 0.
  const loadPane = useCallback(
    async (which: 0 | 1, cwd: string, opts: LoadOpts = {}) => {
      try {
        const entries = await listDir(cwd);
        setPanes((prev) => {
          const next: [PaneState, PaneState] = [prev[0], prev[1]];
          const cursor = resolveCursor(entries, opts);
          next[which] = { cwd, entries, cursor, scrollOffset: 0 };
          return next;
        });
      } catch (err) {
        setStatus(`Cannot open ${cwd}: ${(err as Error).message}`);
      }
    },
    [],
  );

  // Initial listing for both panes.
  useEffect(() => {
    loadPane(0, initialCwd);
    loadPane(1, initialCwd);
  }, [loadPane, initialCwd]);

  const viewHeight = Math.max(3, (process.stdout.rows || 24) - CHROME_ROWS);
  const totalWidth = process.stdout.columns || 80;
  const totalRows = process.stdout.rows || 24;
  const paneWidth = Math.floor(totalWidth / 2);

  const activePane = panes[active];
  const otherIndex: 0 | 1 = active === 0 ? 1 : 0;
  const otherPane = panes[otherIndex];
  const current: Entry | undefined = activePane.entries[activePane.cursor];

  const moveCursor = useCallback(
    (delta: number) => {
      setPanes((prev) => {
        const pane = prev[active];
        const total = pane.entries.length;
        if (total === 0) return prev;
        let cursor = pane.cursor + delta;
        if (cursor < 0) cursor = 0;
        if (cursor > total - 1) cursor = total - 1;
        if (cursor === pane.cursor) return prev;
        const next: [PaneState, PaneState] = [prev[0], prev[1]];
        next[active] = { ...pane, cursor };
        return next;
      });
    },
    [active],
  );

  const enter = useCallback(() => {
    const entry = activePane.entries[activePane.cursor];
    if (!entry) return;
    if (entry.name === '..') {
      loadPane(active, dirname(activePane.cwd), { keepName: baseName(activePane.cwd) });
    } else if (entry.isDir) {
      loadPane(active, join(activePane.cwd, entry.name));
    }
    // File: no-op stub until Phase 3 (F3 view / F4 edit).
  }, [activePane, active, loadPane]);

  // True when there is a real (non-`..`) selection to operate on.
  const hasSelection = (): boolean => !!current && current.name !== '..';

  const refreshBoth = useCallback(
    async (keepActive?: LoadOpts) => {
      await loadPane(active, panes[active].cwd, keepActive);
      await loadPane(otherIndex, panes[otherIndex].cwd);
    },
    [active, otherIndex, panes, loadPane],
  );

  // ── Copy / Move ─────────────────────────────────────────────────────────
  const copyOrMove = useCallback(
    (op: (s: string, d: string) => Promise<void>, verb: string) => {
      if (!hasSelection() || !current) {
        setStatus('Nothing to ' + verb.toLowerCase());
        return;
      }
      const name = current.name;
      const src = join(activePane.cwd, name);
      const destDir = otherPane.cwd;
      const dest = join(destDir, name);

      const run = async () => {
        try {
          await op(src, dest);
          setStatus(`✓ ${verb}d ${name} → ${destDir}`);
          await refreshBoth();
        } catch (err) {
          setStatus(`${verb} failed: ${(err as Error).message}`);
        }
      };

      setModal({
        type: 'confirm',
        kind: verb === 'Copy' ? 'copy' : 'move',
        message: `${verb} "${name}" → ${destDir}?`,
        onConfirm: async () => {
          if (await exists(dest)) {
            setModal({
              type: 'confirm',
              kind: 'overwrite',
              message: `"${name}" exists in ${destDir}. Overwrite?`,
              onConfirm: run,
            });
          } else {
            await run();
          }
        },
      });
    },
    [current, activePane, otherPane, refreshBoth],
  );

  // ── Delete ──────────────────────────────────────────────────────────────
  const doDelete = useCallback(() => {
    if (!hasSelection() || !current) {
      setStatus('Nothing to delete');
      return;
    }
    const name = current.name;
    const target = join(activePane.cwd, name);
    const cursorPos = activePane.cursor;
    setModal({
      type: 'confirm',
      kind: 'delete',
      message: `Delete "${name}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await remove(target);
          setStatus(`✓ Deleted ${name}`);
          await loadPane(active, activePane.cwd, { keepCursor: cursorPos });
        } catch (err) {
          setStatus(`Delete failed: ${(err as Error).message}`);
        }
      },
    });
  }, [current, activePane, active, loadPane]);

  // ── Make directory ──────────────────────────────────────────────────────
  const doMkdir = useCallback(() => {
    setModal({
      type: 'input',
      kind: 'mkdir',
      label: 'Create directory:',
      value: '',
      onSubmit: async (raw) => {
        const name = raw.trim();
        if (!name) return;
        try {
          await makeDir(join(activePane.cwd, name));
          setStatus(`✓ Created ${name}`);
          await loadPane(active, activePane.cwd, { keepName: name });
        } catch (err) {
          setStatus(`MkDir failed: ${(err as Error).message}`);
        }
      },
    });
  }, [activePane, active, loadPane]);

  // ── Rename ──────────────────────────────────────────────────────────────
  const doRename = useCallback(() => {
    if (!hasSelection() || !current) {
      setStatus('Nothing to rename');
      return;
    }
    const oldName = current.name;
    setModal({
      type: 'input',
      kind: 'rename',
      label: `Rename "${oldName}" to:`,
      value: oldName,
      onSubmit: async (raw) => {
        const name = raw.trim();
        if (!name || name === oldName) return;
        try {
          await rename(join(activePane.cwd, oldName), join(activePane.cwd, name));
          setStatus(`✓ Renamed ${oldName} → ${name}`);
          await loadPane(active, activePane.cwd, { keepName: name });
        } catch (err) {
          setStatus(`Rename failed: ${(err as Error).message}`);
        }
      },
    });
  }, [current, activePane, active, loadPane]);

  // ── Directory size on demand ────────────────────────────────────────────
  const doSize = useCallback(async () => {
    if (!current || current.name === '..' || !current.isDir) {
      setStatus('Not a directory');
      return;
    }
    const name = current.name;
    setStatus(`Computing size of ${name}…`);
    try {
      const total = await dirSize(join(activePane.cwd, name));
      setPanes((prev) => {
        const pane = prev[active];
        const entries = pane.entries.map((e) =>
          e.name === name ? { ...e, size: total, sizeComputed: true } : e,
        );
        const next: [PaneState, PaneState] = [prev[0], prev[1]];
        next[active] = { ...pane, entries };
        return next;
      });
      setStatus(`✓ ${name} = ${formatSize(total)}`);
    } catch (err) {
      setStatus(`Size failed: ${(err as Error).message}`);
    }
  }, [current, activePane, active]);

  // ── View (F3) — in-app read-only viewer ─────────────────────────────────
  const doView = useCallback(() => {
    if (!current || current.name === '..' || current.isDir) {
      setStatus('Not a viewable file');
      return;
    }
    setModal({
      type: 'viewer',
      path: join(activePane.cwd, current.name),
      name: current.name,
    });
  }, [current, activePane]);

  // ── Edit (F4) — hand off to $EDITOR / vim ───────────────────────────────
  const doEdit = useCallback(() => {
    if (!current || current.name === '..' || current.isDir) {
      setStatus('Not an editable file');
      return;
    }
    const name = current.name;
    const abs = join(activePane.cwd, name);
    const editor = process.env['EDITOR'] || 'vim';
    runInTerminal(editor, { args: [abs] });
    // Back from the editor: the file's size/mtime may have changed.
    loadPane(active, activePane.cwd, { keepName: name });
  }, [current, activePane, active, runInTerminal, loadPane]);

  // ── User menu (F2) ──────────────────────────────────────────────────────
  const openMenu = useCallback(() => setModal({ type: 'menu' }), []);

  const onMenuSelect = useCallback(
    (item: MenuItem) => {
      closeModal();
      const sel = current;
      const selected = sel && sel.name !== '..' ? sel.name : '';
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        NC_CWD: activePane.cwd,
        NC_SELECTED: selected,
        NC_SELECTED_PATH: selected ? join(activePane.cwd, selected) : '',
      };
      // shell + pause: run the script, then "Press any key to continue…".
      runInTerminal(item.command, {
        shell: true,
        cwd: activePane.cwd,
        env,
        pause: true,
      });
      setStatus(`✓ Ran ${item.label}`);
      // The script may have changed the directory contents. Reload, but keep the
      // cursor where it was — on the selected entry if there is one, otherwise at
      // the same position.
      loadPane(
        active,
        activePane.cwd,
        selected ? { keepName: selected } : { keepCursor: activePane.cursor },
      );
    },
    [current, activePane, active, runInTerminal, loadPane, closeModal],
  );

  useInput((input, key) => {
    // ── Modal routing ───────────────────────────────────────────────────
    if (modal.type === 'input') {
      if (key.return) {
        const submit = modal.onSubmit;
        const value = modal.value;
        closeModal();
        submit(value);
      } else if (key.escape) {
        closeModal();
      } else if (key.backspace || key.delete) {
        setModal({ ...modal, value: modal.value.slice(0, -1) });
      } else if (input && !key.ctrl && !key.meta) {
        setModal({ ...modal, value: modal.value + input });
      }
      return;
    }
    // The Viewer and MenuDialog own their own input; don't double-handle here.
    if (modal.type === 'viewer' || modal.type === 'menu') return;
    if (modal.type === 'confirm') {
      if (key.return || input === 'y') {
        const confirm = modal.onConfirm;
        closeModal();
        confirm();
      } else if (key.escape || input === 'n') {
        closeModal();
      }
      return;
    }

    // ── Normal navigation: any keypress clears a transient status. ────────
    if (status) setStatus('');

    if (key.tab) {
      setActive((a) => (a === 0 ? 1 : 0));
      return;
    }
    if (key.upArrow) return moveCursor(-1);
    if (key.downArrow) return moveCursor(1);
    if (key.pageUp) return moveCursor(-viewHeight);
    if (key.pageDown) return moveCursor(viewHeight);
    if (key.return) return enter();

    // Letter shortcuts (F-keys are handled separately via useFKeys — Ink's
    // useInput cannot surface them).
    if (input === 'u') return openMenu();
    if (input === 'v') return doView();
    if (input === 'e') return doEdit();
    if (input === 'c') return copyOrMove(copy, 'Copy');
    if (input === 'm') return copyOrMove(move, 'Move');
    if (input === 'n') return doMkdir();
    if (input === 'd') return doDelete();
    if (input === 'r') return doRename();
    if (input === 's') {
      doSize();
      return;
    }
    if (input === 'q') {
      quit();
      return;
    }
  });

  // F-keys: decoded from raw stdin chunks. Inert while a dialog is open.
  useFKeys((id) => {
    if (modal.type !== 'none') return;
    if (status) setStatus('');
    switch (id) {
      case 'F2':
        openMenu();
        break;
      case 'F3':
        doView();
        break;
      case 'F4':
        doEdit();
        break;
      case 'F5':
        copyOrMove(copy, 'Copy');
        break;
      case 'F6':
        copyOrMove(move, 'Move');
        break;
      case 'F7':
        doMkdir();
        break;
      case 'F8':
        doDelete();
        break;
      case 'F10':
        quit();
        break;
      // F2 (menu) is wired in Phase 4.
    }
  });

  if (modal.type === 'viewer') {
    return html`
      <${Box} flexDirection="column">
        <${Viewer}
          path=${modal.path}
          name=${modal.name}
          height=${Math.max(3, (process.stdout.rows || 24) - 2)}
          width=${totalWidth}
          onClose=${closeModal}
        />
        <${StatusBar} status=${status} />
      </${Box}>
    `;
  }

  return html`
    <${Box} flexDirection="column">
      <${Box}>
        <${Pane} pane=${panes[0]} active=${active === 0} height=${viewHeight} width=${paneWidth} />
        <${Pane} pane=${panes[1]} active=${active === 1} height=${viewHeight} width=${paneWidth} />
      </${Box}>
      ${modal.type === 'menu' || modal.type === 'confirm' || modal.type === 'input'
        ? html`
            <${CenteredOverlay} width=${totalWidth} height=${totalRows}>
              ${modal.type === 'menu'
                ? html`<${MenuDialog} width=${totalWidth} onSelect=${onMenuSelect} onClose=${closeModal} />`
                : html`<${Dialog} modal=${modal} />`}
            </${CenteredOverlay}>`
        : null}
      <${StatusBar} status=${status} />
    </${Box}>
  `;
}

function baseName(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? '';
}
