---
date: 2026-07-14T09:21:08+00:00
git_commit: 900dd1a36bac085e3c8563d161da80dd90e693d5
branch: main
topic: "Quick shell command line"
tags: [plan, ui, useShell, command-line]
status: draft
---

# PLAN: Quick shell command line

Add an mc-style bottom **command line**: while in the file manager the user
presses `!`, types a shell command, runs it, sees its output, presses a key, and
returns to Node Commander with the active pane refreshed. Commands run through a
shell in the active pane's directory with the same `$NC_*` environment the F2
menu scripts get, and previously-run commands can be recalled with ↑/↓ within the
session.

This reuses the existing terminal hand-off already powering the F2 user menu — no
changes to `useShell.ts`.

## Acceptance Criteria

- Pressing `!` in normal mode (no other modal open) opens a one-line command input
  at the very bottom, below the F-key/status bar, prefixed with `!`; the panes
  shift up one row while it is active.
- Typing composes a shell command (printable chars append, Backspace deletes); on
  Enter the command runs through a shell in the **active pane's** directory.
- The command's output is shown; a *"Press any key to continue…"* pause appears
  **only if** the command left output (reusing the existing hand-off), then control
  returns to Node Commander and the active pane reloads (cursor kept on the hovered
  entry / same position).
- Esc, or Enter on an empty/whitespace-only line, cancels without running anything.
- Commands can use `$NC_CWD`, `$NC_SELECTED`, `$NC_SELECTED_PATH` (identical to F2
  menu scripts).
- While the command line is active, ↑/↓ recall previously-run commands from the
  current session; history is in-memory and lost on quit; consecutive duplicates
  are not stored twice.
- F-keys and letter shortcuts are inert while the command line is active.

## Technical Key Decisions and Tradeoffs

1. **Trigger + placement:** `!` opens a bottom command line (mc/ranger/vifm
   convention), rendered only while active.
   - Why: matches the chosen UX and terminal-file-manager conventions.
   - Impact: new `command` Modal variant; a bottom-row component; `viewHeight`
     chrome grows by 1 row while active — an accepted one-row layout shift on
     activate/deactivate.

2. **Execution path:** reuse `runInTerminal(cmd, { shell:true, cwd, env, pause:true })`
   — the exact F2-menu hand-off — via a shared `runShell(command, label)` helper
   that both the menu and the command line call.
   - Why: identical run / screen-clear / skip-pause-on-no-output / reload semantics
     already exist and are battle-tested (`useShell.ts`, `App.onMenuSelect`).
   - Impact: extract `runShell` from `onMenuSelect`; no change to `useShell.ts`.

3. **Environment:** expose the same `$NC_*` variables as menu scripts via a new
   pure `buildShellEnv` helper.
   - Why: consistency; removes the inline env-building duplication in `onMenuSelect`
     and makes it unit-testable.

4. **History:** in-session, in-memory list; ↑/↓ recall while active; consecutive
   duplicates skipped.
   - Why: cheap, high-value recall; cross-session persistence is out of scope for v1.

5. **Testability:** push all command-line behavior into pure functions
   (`reduceCommandLine`, `recordCommand`, `buildShellEnv`) and keep the App wiring
   thin.
   - Why: App's Ink `useInput` is not unit-testable; the repo already tests pure
     core/util logic with `node --test`. Rendering is verified manually.

## Current State

Node Commander is an Ink (React-for-terminal) two-pane file manager. `App.ts` owns
all input and modal state; the terminal hand-off lives in `useShell.ts`.

```
App.ts (owns input + modal state)
 ├─ useInput()  ── routes keys; handles the `input` modal (mkdir/rename)
 ├─ useFKeys()  ── F2..F10 (inert while modal.type !== 'none')
 ├─ modal: Modal ── { none | confirm | input | viewer | menu }
 └─ useShell() → runInTerminal(command, { shell, cwd, env, pause })
```

The F2 menu already does exactly the run-and-return flow we want
(`App.ts:308-337`):

```
onMenuSelect(item):
  build env { ...process.env, NC_CWD, NC_SELECTED, NC_SELECTED_PATH }   ← inline
  runInTerminal(item.command, { shell:true, cwd, env, pause:true })
  setStatus(`✓ Ran ${item.label}`)
  loadPane(active, cwd, keepName|keepCursor)                             ← reload
```

`runInTerminal` with `pause:true` (`useShell.ts:76-128`): clears the screen, runs
the command, detects via cursor position whether output was left, shows
*"Press any key to continue…"* only when it was, then resumes Ink.

The bottom chrome is the `StatusBar` (F-key hints + transient status). Pane height
is `viewHeight = max(3, rows - CHROME_ROWS)` with `CHROME_ROWS = 8` (`App.ts:24-26,88`).

## Desired End State

```
┌ pane A ──────┐┌ pane B ──────┐
│ ...          ││ ...          │   ← panes (1 row shorter while cmd line active)
└──────────────┘└──────────────┘
 F2 Menu  F3 View  ...            ← F-key hints (StatusBar)
 <status line>                    ← existing transient status
! git log --oneline -5▏           ← NEW command line (only while active)
```

```
  '!' ─▶ modal:{command, value:'', histIndex:null}
          │  (bottom row renders; viewHeight -1)
          ▼
      reduceCommandLine(state, key, history)
          ├─ printable/backspace ─▶ update modal.value
          ├─ ↑/↓                 ─▶ recall from history
          ├─ Esc / empty-Enter   ─▶ cancel (closeModal)
          └─ Enter (non-empty)   ─▶ runShell(cmd) ─▶ record history ─▶ reload pane
```

## Abstractions and Code Reuse

- `src/core`
  - `env.ts` — **new.** `buildShellEnv(base, { cwd, selected })` → env with
    `NC_CWD` / `NC_SELECTED` / `NC_SELECTED_PATH`. Reused by menu + command line.
  - `commandLine.ts` — **new.** Pure reducer + history helpers.
    - `CommandLineState` — `{ value: string; histIndex: number | null }`
    - `reduceCommandLine(state, event, history)` → `{ state, action }`,
      `action` ∈ `{ kind:'none' } | { kind:'run', command } | { kind:'cancel' }`
    - `recordCommand(history, command)` → new history array (skip consecutive dup)
- `src/types.ts`
  - `Modal` — add `{ type:'command'; value:string; histIndex:number|null }`
- `src/ui`
  - `CommandLine.ts` — **new.** Presentational bottom row: `! <value>▏` + hint.
  - `App.ts` — add history state, `runShell` helper (extracted from
    `onMenuSelect`), `command` modal routing in `useInput`, `!` trigger,
    `viewHeight` chrome adjustment, render `CommandLine` when active.
- `test`
  - `env.test.js` — **new.**
  - `commandLine.test.js` — **new.**
- `README.md` — document the command line + history.

No changes to `useShell.ts`.

## Logging & Observability

No structured logging in this app. User-facing feedback is the transient status
line: on run, `setStatus('✓ Ran: <command>')` (truncated to a sane width).

## Implementation

### Phase 1: Bottom command line + execution

Dependencies: None

Deliver the whole run-and-return flow: `!` opens a bottom command line, typing
composes a command, Enter runs it via the shared hand-off with `$NC_*` env, Esc /
empty-Enter cancels, and the active pane reloads. History keys (↑/↓) are inert in
this phase (added in Phase 2), but `reduceCommandLine` is written and tested with a
`history` parameter so Phase 2 only wires state.

**Tasks**:

- [ ] Add `src/core/env.ts` with `buildShellEnv`:
  ```ts
  export function buildShellEnv(
    base: NodeJS.ProcessEnv,
    ctx: { cwd: string; selected: string },
  ): NodeJS.ProcessEnv {
    return {
      ...base,
      NC_CWD: ctx.cwd,
      NC_SELECTED: ctx.selected,
      NC_SELECTED_PATH: ctx.selected ? join(ctx.cwd, ctx.selected) : '',
    };
  }
  ```
- [ ] Add `src/core/commandLine.ts` with `CommandLineState`, `reduceCommandLine`,
  and a stub `recordCommand` (append only for now — dedup added in Phase 2).
  The reducer accepts a minimal event `{ input, return, escape, backspace, delete,
  upArrow, downArrow }`:
  - printable (`input` set, not a handled key) → append to `value`, `histIndex=null`
  - `backspace`/`delete` → drop last char, `histIndex=null`
  - `escape` → `action:{kind:'cancel'}`
  - `return` → `value.trim()` empty ? `cancel` : `{kind:'run', command:value.trim()}`
  - `upArrow`/`downArrow` → **no-op this phase** (`action:{kind:'none'}`)
- [ ] `src/types.ts`: add the `command` variant to `Modal`.
- [ ] Add `src/ui/CommandLine.ts` — presentational bottom row rendering
  `! ${value}` with an inverse block cursor and a dim hint
  (`Enter = run  Esc = cancel  ↑↓ = history`), mirroring `Dialog.ts` styling.
- [ ] `App.ts`: extract `runShell(command: string, label: string)` from
  `onMenuSelect` (env via `buildShellEnv`, `runInTerminal({shell:true,cwd,env,pause:true})`,
  `setStatus`, reload with `keepName`/`keepCursor`). Point `onMenuSelect` at it.
- [ ] `App.ts`: add `!` trigger in the normal-navigation section of `useInput`
  (`if (input === '!') { setModal({ type:'command', value:'', histIndex:null }); return; }`).
- [ ] `App.ts`: add a `command` branch in `useInput` (before the normal-nav
  section) that calls `reduceCommandLine`, then dispatches `run` →
  `closeModal()` + `runShell(command, 'Ran: ' + command)`, `cancel` → `closeModal()`,
  `none` → `setModal({type:'command', ...state})`. Pass `[]` as history this phase.
- [ ] `App.ts`: make `viewHeight` (currently the modal-independent `const` at
  `App.ts:88`) depend on the modal — e.g.
  `const chromeRows = CHROME_ROWS + (modal.type === 'command' ? 1 : 0)` and use it
  in `viewHeight`, so panes shrink one row while active (it recomputes on
  `setModal`). Render `<CommandLine value=... />` after the `StatusBar` in the main
  return.
- [ ] Ensure `useFKeys` stays inert (it already guards `modal.type !== 'none'`);
  confirm the `command` modal is covered.
- [ ] `README.md`: add a "Quick shell command" section (the `!` key, cwd,
  `$NC_*` vars, pause behavior) and a `!` row/note near the keybindings table.

**Automated Verification**:
- [ ] `test/env.test.js` passes: `buildShellEnv` sets `NC_CWD`, `NC_SELECTED`,
  `NC_SELECTED_PATH`; empty `selected` → empty `NC_SELECTED` and empty
  `NC_SELECTED_PATH`; base env is preserved.
- [ ] `test/commandLine.test.js` passes: printable appends; Backspace deletes;
  Enter on non-empty → `run` with trimmed command; Enter on empty/whitespace →
  `cancel`; Esc → `cancel`; ↑/↓ → `none` in this phase.
- [ ] `npm test` passes (whole suite).
- [ ] `npm run typecheck` passes.

**Manual Verification**:
- [ ] Run the app; press `!` — a command line appears at the bottom and the panes
  shift up one row.
- [ ] Type `git status`, press Enter — output shows, *"Press any key to continue…"*
  appears, a keypress returns to Node Commander, the pane refreshes.
- [ ] With a file hovered, run `echo $NC_SELECTED` and confirm the hovered name prints.
- [ ] Run a command that prints nothing (e.g. `true`) — control returns with **no**
  "press any key" pause.
- [ ] Press `!` then Esc — cancels with no run; press `!` then Enter on an empty
  line — cancels with no run.

### Phase 2: In-session history recall

Dependencies: Phase 1

Add ↑/↓ recall of commands run during the session.

**Tasks**:
- [ ] `src/core/commandLine.ts`: implement `recordCommand(history, command)` to
  append `command`, skipping when it equals the current last entry.
- [ ] `src/core/commandLine.ts`: extend `reduceCommandLine` ↑/↓ handling using the
  `history` argument and `state.histIndex`:
  - `upArrow`: move toward older (from `null` → last index; clamp at `0`); set
    `value` to that entry.
  - `downArrow`: move toward newer; stepping past the newest returns
    `histIndex=null` and `value=''` (fresh draft).
  - empty history → `none` (no change).
- [ ] `App.ts`: add `const [history, setHistory] = useState<string[]>([])`; pass
  `history` into `reduceCommandLine`; on a `run` action call
  `setHistory((h) => recordCommand(h, command))`.
- [ ] `README.md`: note ↑/↓ history recall (in-session, cleared on quit) in the
  command-line section.

**Automated Verification**:
- [ ] `test/commandLine.test.js` (extended) passes: `recordCommand` appends and
  skips a consecutive duplicate; ↑ from fresh loads the most recent entry; repeated
  ↑ clamps at the oldest; ↓ walks forward and past-newest returns to an empty draft
  (`histIndex=null`); ↑/↓ on empty history is a no-op.
- [ ] `npm test` passes.
- [ ] `npm run typecheck` passes.

**Manual Verification**:
- [ ] Run two different commands; press `!`, then ↑/↓ and confirm both are
  recalled in order and past-newest returns to an empty line.

## Implementation Notes

During implementation, document user feedback, problems, and decisions here.

## References

- `src/ui/useShell.ts` — terminal hand-off (`runInTerminal`, pause / skip-pause).
- `src/ui/App.ts:308-337` — `onMenuSelect` (the flow being generalized).
- `src/ui/Dialog.ts` — input-modal styling to mirror for `CommandLine`.
- `test/menu.test.js`, `test/fkeys.test.js` — `node --test` style for new tests.
- `docs/agents/plans/2026-07-13-centered-menu-overlay.md` — prior modal/overlay work.
