import { useStdin } from 'ink';
import { spawnSync } from 'node:child_process';
import { readSync } from 'node:fs';

// Options for a single terminal hand-off.
export type RunOpts = {
  args?: string[]; // argv for a plain (non-shell) command, e.g. vim <file>
  shell?: boolean; // run `command` through a shell (custom-script menu)
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  pause?: boolean; // "Press any key to continue…" after the child exits
};

// Block the current thread for `ms` without an event loop turn (we're in a
// synchronous terminal hand-off and can't await).
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Ask the terminal where the cursor is (1-based row/col) via the DSR query
// ESC[6n; the reply comes back as ESC[<row>;<col>R. Raw mode is required so the
// reply isn't line-buffered. Returns null if the terminal doesn't answer.
function readCursorPosition(
  setRawMode: (value: boolean) => void,
): { row: number; col: number } | null {
  try {
    setRawMode(true);
    process.stdout.write('\x1b[6n');
    const buf = Buffer.alloc(32);
    let reply = '';
    // fd 0 may be non-blocking, so readSync throws EAGAIN before the terminal
    // has replied. Spin with a short sleep until the final 'R' arrives, bounded
    // (~200ms) so a terminal that never answers can't wedge us.
    for (let i = 0; i < 100 && !reply.includes('R'); i++) {
      try {
        const n = readSync(0, buf, 0, buf.length, null);
        if (n > 0) reply += buf.toString('latin1', 0, n);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EAGAIN') throw e;
        sleepSync(2); // reply not here yet — wait for it
      }
    }
    const m = /\[(\d+);(\d+)R/.exec(reply);
    return m ? { row: Number(m[1]), col: Number(m[2]) } : null;
  } catch {
    return null;
  } finally {
    setRawMode(false);
  }
}

// useShell exposes runInTerminal(): suspend Ink, hand the real TTY to a child
// process (vim or a shell command), then resume Ink cleanly. This is the
// delicate part — the ordering of raw-mode / pause / bracketed-paste toggles
// matters so no escape sequences leak back into the TUI.
export function useShell() {
  const { setRawMode, isRawModeSupported, stdin } = useStdin();

  return function runInTerminal(command: string, opts: RunOpts = {}): void {
    // Non-TTY (e.g. piped): nothing sensible to hand off to.
    if (!isRawModeSupported) return;

    // Suspend Ink's control of the terminal.
    setRawMode(false);
    stdin.pause();
    // Disable bracketed paste so pasted input inside vim/scripts doesn't leak
    // \x1b[200~ / \x1b[201~ artifacts back into our UI.
    process.stdout.write('\x1b[?2004l');

    // Snapshot the cursor before handing off, so afterwards we can tell whether
    // the child actually left any visible output behind. Declared out here so
    // it's in scope for the pause check in `finally`.
    let before: { row: number; col: number } | null = null;

    try {
      if (opts.pause) {
        // Clear the screen and home the cursor before handing off. This gives the
        // child a clean slate (like mc/ranger) and, crucially, means output
        // always starts at the top — so afterwards we can tell "printed
        // something" (cursor moved off home) from "full-screen app that restored
        // the screen" (cursor back at home) even when the child scrolled.
        //
        // Only do this on the pause path (menu scripts). For a plain hand-off
        // like F4/vim we must NOT clear: vim restores its own screen on exit, so
        // clearing here would leave a blank screen until Ink repaints on the next
        // keypress.
        process.stdout.write('\x1b[2J\x1b[H');
        before = readCursorPosition(setRawMode);
      }

      if (opts.shell) {
        spawnSync(command, {
          shell: true,
          stdio: 'inherit',
          cwd: opts.cwd,
          env: opts.env,
        });
      } else {
        spawnSync(command, opts.args ?? [], {
          stdio: 'inherit',
          cwd: opts.cwd,
          env: opts.env,
        });
      }
    } finally {
      // Pause read happens BEFORE restoring, while stdin is still paused/raw-off,
      // so the child's final output stays readable before the TUI redraws.
      if (opts.pause) {
        // If the cursor is back where it started, the child restored the screen
        // (e.g. lazygit's alternate buffer) and printed nothing — so there's
        // nothing to read and no reason to make the user press a key.
        const after = readCursorPosition(setRawMode);
        const leftOutput =
          !before ||
          !after ||
          before.row !== after.row ||
          before.col !== after.col;
        if (leftOutput) {
          process.stdout.write('\nPress any key to continue…');
          try {
            setRawMode(true);
            const buf = Buffer.alloc(1);
            readSync(0, buf, 0, 1, null);
          } catch {
            // No stdin available — skip the pause rather than crash.
          }
        }
      }
      // Restore last so Ink recaptures stdin only after any pause read.
      process.stdout.write('\x1b[?2004h');
      stdin.resume();
      setRawMode(true);
    }
  };
}
