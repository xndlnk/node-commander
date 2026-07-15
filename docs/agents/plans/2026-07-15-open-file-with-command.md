---
date: 2026-07-15T13:28:20Z
git_commit: 2da86e3e3c6e3a9b818d8f692becb3e6660994cb
branch: main
topic: "Open file on ENTER with a user-defined command"
tags: [plan, menu-config, keybindings, App, useShell]
status: draft
---

# PLAN: Open file on ENTER with a user-defined command

Today, pressing `Enter` on a file is a no-op (`enter()` only handles `..` and
directories). This plan wires `Enter` on a file to run a user-defined shell
command — e.g. on macOS `open $NC_SELECTED_PATH` opens the file with its default
app. The command is configured as a new top-level `openCommand` field in the
existing `menu.json`, and runs through the exact same terminal hand-off path as
the F2 user-menu scripts, so it inherits the `$NC_*` environment, the smart
"Press any key…" pause, and the pane reload.

## Acceptance Criteria

- Pressing `Enter` on a directory or the `..` row behaves exactly as today
  (descend into it / go up one level).
- Pressing `Enter` on a file runs the configured `openCommand` through a shell
  with `$NC_CWD`, `$NC_SELECTED`, and `$NC_SELECTED_PATH` set, the active pane's
  directory as `cwd`, the smart "Press any key…" pause, then reloads the pane
  keeping the cursor on that file.
- `openCommand` is read from the top level of `menu.json` (object form:
  `{ "openCommand": "...", "items": [...] }`).
- When `openCommand` is missing, empty, or not a non-empty string, `Enter` on a
  file shows a transient status hint telling the user to set `openCommand` in
  `menu.json`; nothing else happens.
- `README.md` and the F1 help overlay document the new `Enter`-on-file behavior
  and the `openCommand` config field.
- `menu.json` parsing of `openCommand` is covered by tests (valid, empty string,
  non-string, absent, and bare-array config).

## Technical Key Decisions and Tradeoffs

1. **Config lives in `menu.json` as a top-level `openCommand` string.**
   - Why: single existing config file, reuses `loadMenu`'s resolution order
     (`$NODE_COMMANDER_MENU` → `~/.config/node-commander/menu.json` →
     `./menu.json`).
   - Impact: extend `MenuResult` and `parseMenu`; the bare-array config form
     cannot set `openCommand` (acceptable — it degrades to the status hint).

2. **Execute via the existing menu-item path (`runMenuItem`).**
   - Why: identical semantics to F2 / direct keys — `shell: true`, the same
     `$NC_*` env, the smart pause, and the pane reload. `$NC_SELECTED_PATH` is
     expanded by the shell, so the user's `open $NC_SELECTED_PATH` "just works".
   - Impact: `enter()` builds a synthetic `{ label: 'Open', command: openCommand }`
     and calls `runMenuItem`. Because `runMenuItem` is a `useCallback` const
     referenced in `enter()`'s dependency array, it must be declared **before**
     `enter()` to avoid a temporal-dead-zone error during render.

3. **Unconfigured / invalid `openCommand` → transient status hint, treated as unset.**
   - Why: discoverability without coupling `Enter` to F3; consistent with how
     invalid menu `items` are silently dropped.
   - Impact: `enter()`'s file branch checks for a valid `openCommand` and either
     runs it or sets the hint status.

## Current State

`Enter` handling lives entirely in `src/ui/App.ts`:

```
useInput ──► key.return ──► enter()            (App.ts:413, 135-144)
                              │
        ┌─────────────────────┼─────────────────────┐
   name === '..'          entry.isDir            it's a FILE
   loadPane(up)           loadPane(into)     ► no-op stub  ◄── the gap
```

The wanted mechanism already exists for the F2 menu — `runMenuItem()`
(App.ts:333-361):

```
runMenuItem(item)
  ├─ build env: NC_CWD, NC_SELECTED, NC_SELECTED_PATH
  ├─ runInTerminal(item.command, { shell:true, cwd, env, pause:true })
  ├─ setStatus(`✓ Ran ${item.label}`)
  └─ loadPane(active, cwd, keepName|keepCursor)   // reload
```

`runInTerminal` (`src/ui/useShell.ts`) suspends Ink, hands the TTY to the child,
and on the `pause` path uses a cursor-position probe to skip the "Press any
key…" prompt when the child left no visible output (so macOS `open`, which
returns instantly and prints nothing, produces no pause).

Config is loaded once via `loadMenu()` (`src/core/menu.ts`), memoized in App
(`App.ts:52`). `MenuResult` currently exposes only `{ items, path, reason? }`.
`parseMenu` accepts either `{ items: [...] }` or a bare array and reads only the
`items` array. There is no top-level scalar config field yet.

Ordering note: in `App.ts`, `enter()` is declared at line 135 but `runMenuItem`
at line 333. Referencing `runMenuItem` in `enter()`'s dependency array as-is
would hit a const TDZ, hence decision #2's reorder.

## Desired End State

```
useInput ──► key.return ──► enter()
                              │
   ┌──────────────┬───────────┴─────────────┬───────────────────────┐
 '..'          isDir                    FILE + openCommand      FILE + no openCommand
 loadPane(up)  loadPane(into)   runMenuItem({label:'Open',    setStatus('No open command
                                 command: openCommand})        set — add "openCommand"
                                                               to menu.json')
```

`menu.json` (object form) gains an optional field:

```json
{
  "openCommand": "open $NC_SELECTED_PATH",
  "items": [
    { "key": "g", "direct": true, "label": "Git status", "command": "git status" }
  ]
}
```

## Abstractions and Code Reuse

- `src/core/menu.ts`
  - `MenuResult` — add optional `openCommand?: string`.
  - `parseMenu` — extract & validate top-level `openCommand` (object form only;
    non-string / empty → omit). Bare-array form leaves it `undefined`.
  - `loadMenu` — thread `openCommand` through the not-found / malformed early
    returns (they should carry `openCommand: undefined`, i.e. simply omit it).
- `src/ui/App.ts`
  - Move `runMenuItem` (and nothing else it doesn't already depend on) above
    `enter()` so `enter()` can list it as a dependency without a TDZ.
  - `enter()` — extend the `else`/file branch to run `openCommand` via
    `runMenuItem` or show the hint.
- `src/ui/HelpDialog.ts`
  - Update the `Enter` binding row text to mention opening files.
- `README.md`
  - Keybindings table `Enter` row + a short `openCommand` subsection + the
    sample config.
- `menu.json` (repo sample) — add an `openCommand` example (commented-friendly:
  JSON has no comments, so just include a sensible cross-note in README).
- `test/menu.test.js` — new `openCommand` parsing cases.

No new abstractions are required; this is pure reuse of `runMenuItem` /
`runInTerminal` and an additive config field.

## Logging & Observability

No logging framework in this project. User-facing feedback is the transient
status line:
- Success path reuses `runMenuItem`'s existing `✓ Ran Open` status.
- Unconfigured path sets a hint, e.g.
  `No open command set — add "openCommand" to menu.json`.

## Implementation

### Phase 1: Open file on ENTER with a user-defined command

Dependencies: None.

Parse `openCommand` from config, wire `enter()`'s file branch to run it through
the existing menu-item path (or show a hint), and document the behavior.

**Tasks**:

- [ ] `src/core/menu.ts`: add `openCommand?: string` to the `MenuResult` type.

- [ ] `src/core/menu.ts`: in `parseMenu`, after building `items`, read the
      top-level `openCommand` from the object form and validate it:
  ```ts
  // Object form only; a bare array has no place for a top-level field.
  let openCommand: string | undefined;
  if (isRecord(data) && typeof data['openCommand'] === 'string' && data['openCommand'].trim()) {
    openCommand = data['openCommand'];
  }
  return { items, path, reason, openCommand };
  ```
  (Return `openCommand` alongside the existing fields; leave the malformed-JSON
  and no-items early returns as-is — they omit `openCommand`, i.e. `undefined`.)

- [ ] `src/ui/App.ts`: relocate the `runMenuItem` `useCallback` (App.ts:333-361)
      to above the `enter()` `useCallback` (App.ts:135) so `enter()` can depend on
      it without a const TDZ. Keep `onMenuSelect` where it works (it already sits
      after `runMenuItem`). Verify no other reordering is needed (`runMenuItem`
      depends only on `current`, `activePane`, `active`, `runInTerminal`,
      `loadPane`, all declared earlier).

- [ ] `src/ui/App.ts`: extend `enter()`'s file branch. Replace the
      `// File: no-op stub…` comment with:
  ```ts
  } else {
    // File: run the user-defined open command, if configured.
    if (menu.openCommand) {
      runMenuItem({ label: 'Open', command: menu.openCommand });
    } else {
      setStatus('No open command set — add "openCommand" to menu.json');
    }
  }
  ```
  Update `enter()`'s dependency array to include `menu.openCommand` (or `menu`)
  and `runMenuItem`.

- [ ] `src/ui/HelpDialog.ts`: update the Navigation `Enter` row action text from
      `'Open dir / .. up'` to something like `'Open dir / .. up / open file'`
      (keep within the column width).

- [ ] `menu.json` (repo sample): add a top-level `openCommand` example so `npm
      start` in-repo demonstrates the feature, e.g.
      `"openCommand": "echo Open $NC_SELECTED_PATH"` (portable; avoids assuming
      macOS `open`). Keep the existing `items`.

- [ ] `README.md`: update the Keybindings table `Enter` row to note it opens a
      file via `openCommand`; add an `openCommand` subsection under the config
      docs (object-form only, `$NC_*` expansion, macOS `open $NC_SELECTED_PATH`
      example, and the "hint when unset" behavior); mention `openCommand` in the
      Config-file paragraph that currently lists only `items`.

- [ ] `test/menu.test.js`: add cases —
  - valid `openCommand` string parses onto `res.openCommand`;
  - empty-string `openCommand` → `res.openCommand === undefined`;
  - non-string `openCommand` (e.g. number) → `undefined`;
  - absent `openCommand` → `undefined`;
  - bare-array config → `undefined` (and `items` still parse).

**Automated Verification**:

- [ ] `npm test` passes (includes the new `test/menu.test.js` `openCommand` cases).
- [ ] `npm run typecheck` passes (`MenuResult.openCommand`, `enter()` changes,
      and the `runMenuItem` reorder all type-strip cleanly).

**Manual Verification**:

- [ ] With `menu.json` containing `"openCommand": "open $NC_SELECTED_PATH"` (macOS),
      run `npm start`, hover a file, press `Enter` — the file opens in its default
      app; the panes redraw and the cursor stays on the file.
- [ ] Press `Enter` on a directory and on the `..` row — navigation is unchanged.
- [ ] Remove `openCommand` from `menu.json`, restart, press `Enter` on a file —
      the status line shows the "No open command set…" hint and nothing else happens.
- [ ] Press `F1` — the help overlay's `Enter` row reflects the file-open behavior.

## Implementation Notes

During implementation, document user feedback, problems, and decisions here.

## References

- `src/ui/App.ts` — `enter()` (135-144), `runMenuItem()` (333-361), `useInput`
  return handling (413).
- `src/core/menu.ts` — `MenuResult`, `parseMenu`, `loadMenu`.
- `src/ui/useShell.ts` — `runInTerminal` / smart pause.
- `src/ui/HelpDialog.ts` — keybinding overlay rows.
- `docs/agents/plans/2026-07-14-quick-shell-command.md`,
  `docs/agents/plans/2026-07-14-direct-menu-keys.md` — prior menu/command plans
  establishing the `$NC_*` env and `runMenuItem` pattern.
