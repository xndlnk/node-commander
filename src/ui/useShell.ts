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

    try {
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
        process.stdout.write('\nPress any key to continue…');
        try {
          const buf = Buffer.alloc(1);
          readSync(0, buf, 0, 1, null);
        } catch {
          // No stdin available — skip the pause rather than crash.
        }
      }
      // Restore last so Ink recaptures stdin only after any pause read.
      process.stdout.write('\x1b[?2004h');
      stdin.resume();
      setRawMode(true);
    }
  };
}
