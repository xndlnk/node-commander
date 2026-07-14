---
date: 2026-07-14T10:55:41+00:00
git_commit: 900dd1a36bac085e3c8563d161da80dd90e693d5
branch: main
topic: "Direct-key execution of menu entries"
tags: [plan, menu, App, MenuDialog, directKey]
status: ready
---

# PLAN: Direct-key execution of menu entries

Let certain F2 user-menu entries be executed **directly from folder navigation**
by a single keypress, without opening the menu first. A menu entry may declare an
optional `directKey`; while navigating (no modal open), pressing that char runs
the entry's command through the exact same hand-off the F2 menu uses.

`directKey` is independent of the existing in-menu `key`, so the top-level
shortcut can be chosen to avoid collisions (e.g. uppercase `G`). Built-in
navigation shortcuts always take precedence; a `directKey` that collides with a
built-in (or duplicates another entry's `directKey`) never fires and is reported
with a transient startup status warning.

## Acceptance Criteria

- A menu entry may declare an optional single-char `directKey`, independent of
  `key`. `loadMenu` validates it exactly like `key` (kept only when it's a
  one-character string); an invalid/multichar `directKey` is dropped while the
  entry itself is kept.
- In folder navigation (no modal open), pressing a char that matches an entry's
  `directKey` runs that entry's command via the **same** path as selecting it in
  the F2 menu: env `NC_CWD` / `NC_SELECTED` / `NC_SELECTED_PATH`, `shell:true`,
  `pause:true`, `setStatus('✓ Ran …')`, then the active pane reloads (cursor kept
  on the selected entry, else same position).
- `directKey` matching is case-sensitive (so `G` = Shift+g is a natural
  collision-free choice).
- Built-in navigation shortcuts (`u v e c m n d r s q`, plus Tab, arrows,
  PgUp/PgDn, Enter) always win: a `directKey` equal to a reserved char never
  fires in navigation.
- If two entries declare the same `directKey`, the first one wins.
- The F2 `MenuDialog` shows each entry's `directKey`, e.g. `[g] Git status ⟨G⟩`.
- On startup, a transient status warning is shown for any `directKey` that is
  shadowed by a built-in or duplicates another entry's `directKey`.

## Technical Key Decisions and Tradeoffs

1. **Separate `directKey` field on `MenuItem`.**
   - Why: decouples the in-menu hotkey (`key`) from the global shortcut, so users
     can pick a free/uppercase key and avoid collisions without changing menu
     behavior.
   - Impact: `types.ts` (new optional field) + `menu.ts` parse/validate.

2. **Built-ins win via input ordering (no reordering of existing handlers).**
   - Why: core file operations (delete, quit, …) must never be shadowable by
     config.
   - Impact: the `directKey` lookup is the **final fallthrough** in the
     normal-navigation block of `useInput`; every built-in `if (input === …)`
     already `return`s before it.

3. **Centralize menu loading in `App`.**
   - Why: `App` needs the items for both direct dispatch and the startup warning;
     loading in both `App` and `MenuDialog` risks divergence and double reads.
   - Impact: `App` calls `loadMenu` once (memoized) and passes the items down to
     `MenuDialog` as a prop; `MenuDialog` stops calling `loadMenu` itself.

4. **Pure `analyzeDirectKeys(items, reservedKeys)` → `{ map, warnings }`.**
   - Why: keeps dispatch + collision/duplicate detection unit-testable, matching
     the repo's convention of testing pure `core`/`util` logic with `node --test`
     (Ink's `useInput` is not unit-testable).
   - Impact: new helper in `core/menu.ts`; a shared `RESERVED_NAV_KEYS` constant.
     Phase 1 consumes `map`; Phase 2 consumes `warnings`.

5. **Extract a shared `runMenuItem(item)` from `onMenuSelect`.**
   - Why: the menu path and the direct-key path must run identically (env,
     hand-off, status, reload).
   - Impact: `runMenuItem` holds the env/`runInTerminal`/status/reload logic;
     `onMenuSelect` becomes `closeModal()` + `runMenuItem(item)`, and the
     direct-key path calls `runMenuItem(item)` with no modal to close.

## Current State

`App.ts` owns all input and modal state. Menu entries are loaded/validated by
`core/menu.ts` and surfaced only through the F2 menu today.

```
menu.json ── loadMenu() ──▶ MenuItem { key?, label, command }
                                   │
   F2 / 'u' ─▶ modal:{type:'menu'} ─▶ MenuDialog  (calls loadMenu itself; owns input)
                                   │        ├ ↑↓ + Enter → onSelect(item)
                                   │        └ press item.key → onSelect(item)   ← hotkey works ONLY inside the open menu
                                   ▼
                        App.onMenuSelect(item)                        (App.ts:308)
                           closeModal()
                           build env {NC_CWD, NC_SELECTED, NC_SELECTED_PATH}   ← inline
                           runInTerminal(cmd, {shell:true, cwd, env, pause:true})
                           setStatus('✓ Ran …'); loadPane(active, …)  ← reload
```

Normal folder navigation — `useInput` (`App.ts:339`), single-letter shortcuts,
each an early `return`:

```
u=menu  v=view  e=edit  c=copy  m=move  n=mkdir  d=delete  r=rename  s=size  q=quit
        (plus Tab, ↑↓, PgUp/PgDn, Enter)
```

`MenuItem = { key?, label, command }` (`types.ts:19`). `parseMenu`
(`menu.ts:57`) already validates `key` as a single-char string. `MenuDialog`
loads its own menu via `useMemo(() => loadMenu(), [])` (`MenuDialog.ts:18`) and
renders `${hotkey}${it.label}` per row.

## Desired End State

```
menu.json  { key?, directKey?, label, command }
     │
   App:  const { items } = useMemo(loadMenu)                       ← single load
         const { map, warnings } = analyzeDirectKeys(items, RESERVED_NAV_KEYS)
              │                         │
              │                         └─ Phase 2: setStatus(warning) on mount
              ▼
   useInput (normal nav):
     …built-in shortcuts (early return)…
     if (input && map.has(input)) { runMenuItem(map.get(input)); return; }   ← NEW final fallthrough
              │
              ▼
   runMenuItem(item)  ← shared with onMenuSelect (env, runInTerminal, status, reload)

   MenuDialog receives items as a prop and renders:
     [g] Git status        ⟨G⟩
     [l] lazygit
     [d] Disk usage        ⟨D⟩
```

Key routing (folder navigation):

```
keypress 'input'
   ├─ Tab / arrows / PgUp/Dn / Enter        → navigation
   ├─ input === u|v|e|c|m|n|d|r|s|q         → built-in op  (return)
   └─ else, map.has(input)                  → runMenuItem  (return)   ← directKey
        (reserved chars never reach here: their built-in returned first)
```

## Abstractions and Code Reuse

- `src/types.ts`
  - `MenuItem` — add optional `directKey?: string`.
- `src/core/menu.ts`
  - `parseMenu` — validate `directKey` like `key` (single char; drop otherwise).
  - `RESERVED_NAV_KEYS` — **new** exported constant: the built-in navigation
    chars (`u v e c m n d r s q`).
  - `analyzeDirectKeys(items, reservedKeys)` — **new** pure helper returning
    `{ map: Map<string, MenuItem>, warnings: string[] }`. Skips reserved chars
    (shadowed) and duplicates (first wins), collecting a human-readable warning
    for each skipped `directKey`.
- `src/ui/App.ts`
  - Load `loadMenu` once (memoized); compute `analyzeDirectKeys`.
  - `runMenuItem(item)` — **extracted** from `onMenuSelect` (env via inline build
    for now, `runInTerminal({shell,cwd,env,pause:true})`, status, reload).
  - `onMenuSelect` — becomes `closeModal()` + `runMenuItem(item)`.
  - `useInput` — add the `directKey` fallthrough at the end of the normal-nav
    block.
  - Pass `items` to `MenuDialog`.
  - Phase 2: `useEffect` surfacing the first `warnings` entry via `setStatus`.
- `src/ui/MenuDialog.ts`
  - Accept `items` (and `path`/`reason`) as props instead of calling `loadMenu`.
  - Render each entry's `directKey` (`⟨X⟩`) when present.
- `menu.json`
  - Add a `directKey` to the sample (e.g. Git status → `"G"`) to demo the feature.
- `test`
  - `menu.test.js` — extend: `directKey` parsed; multichar `directKey` dropped.
  - `directkeys.test.js` — **new**: `analyzeDirectKeys` map + warnings.
- `README.md` — document `directKey`, case-sensitivity, built-ins-win policy, and
  the startup warning.

No changes to `useShell.ts`.

## Logging & Observability

No structured logging in this app. User feedback is the transient status line:
`✓ Ran <label>` on a direct run (already emitted by the shared runner), and the
Phase-2 startup warning, e.g. `⚠ directKey 'd' shadowed by built-in`.

## Implementation

### Phase 1: `directKey` config + direct execution + menu display

Dependencies: None

Deliver the core value: parse/validate `directKey`, centralize menu loading in
`App`, dispatch a matching `directKey` from folder navigation through the shared
menu-run path, and show the `directKey` in the F2 menu. `analyzeDirectKeys`
returns `{ map, warnings }`; only `map` is consumed this phase (`warnings` is
wired in Phase 2).

**Tasks**:

- [x] `src/types.ts`: add `directKey?: string` to `MenuItem`.
- [x] `src/core/menu.ts`: in `parseMenu`, validate `directKey` like `key`:
  ```ts
  const { label, command, key, directKey } = entry;
  …
  if (typeof key === 'string' && key.length === 1) item.key = key;
  if (typeof directKey === 'string' && directKey.length === 1)
    item.directKey = directKey;
  ```
- [x] `src/core/menu.ts`: add the reserved-keys constant and pure analyzer:
  ```ts
  // Single-char nav shortcuts bound in App.useInput; directKeys equal to any of
  // these can never fire (built-ins win). Keep in sync with App.useInput.
  export const RESERVED_NAV_KEYS = ['u','v','e','c','m','n','d','r','s','q'];

  export type DirectKeyAnalysis = {
    map: Map<string, MenuItem>;
    warnings: string[];
  };

  export function analyzeDirectKeys(
    items: MenuItem[],
    reservedKeys: string[] = RESERVED_NAV_KEYS,
  ): DirectKeyAnalysis {
    const reserved = new Set(reservedKeys);
    const map = new Map<string, MenuItem>();
    const warnings: string[] = [];
    for (const it of items) {
      const dk = it.directKey;
      if (!dk) continue;
      if (reserved.has(dk)) {
        warnings.push(`directKey '${dk}' shadowed by built-in`);
        continue;
      }
      if (map.has(dk)) {
        warnings.push(`directKey '${dk}' duplicated`);
        continue; // first wins
      }
      map.set(dk, it);
    }
    return { map, warnings };
  }
  ```
- [x] `src/ui/MenuDialog.ts`: change `Props` to receive the loaded menu
  (`items`, `path`, `reason`) instead of calling `loadMenu`; remove the
  `useMemo(() => loadMenu(), [])`. Render the `directKey` marker on each row,
  e.g. append ` ⟨${it.directKey}⟩` when set (keep the existing `[key]` hotkey
  prefix and dim styling).
- [x] `src/ui/App.ts`: add `useMemo` to the React destructure
  (`const { useState, useEffect, useCallback, useMemo } = React;`) and import
  `loadMenu`, `analyzeDirectKeys`, `RESERVED_NAV_KEYS` from `../core/menu.ts`.
- [x] `src/ui/App.ts`: load the menu once and compute the dispatch map:
  ```ts
  const menu = useMemo(() => loadMenu(), []);
  const directKeys = useMemo(
    () => analyzeDirectKeys(menu.items, RESERVED_NAV_KEYS),
    [menu],
  );
  ```
- [x] `src/ui/App.ts`: extract `runMenuItem(item: MenuItem)` from `onMenuSelect`
  (env build + `runInTerminal({shell:true,cwd,env,pause:true})` + `setStatus` +
  reload with `keepName`/`keepCursor`). Reduce `onMenuSelect` to
  `closeModal(); runMenuItem(item);`.
- [x] `src/ui/App.ts`: at the **end** of the normal-navigation block in
  `useInput` (after all built-in `if (input === …)` returns), add:
  ```ts
  if (input) {
    const hit = directKeys.map.get(input);
    if (hit) { runMenuItem(hit); return; }
  }
  ```
- [x] `src/ui/App.ts`: pass the loaded menu to `MenuDialog`, e.g.
  `<${MenuDialog} items=${menu.items} path=${menu.path} reason=${menu.reason} width=… onSelect=… onClose=… />`.
- [x] `menu.json`: add a `directKey` to the sample (e.g. Git status →
  `"directKey": "G"`) so the feature is demoable out of the box.
- [x] `README.md`: document `directKey` (independent of `key`, single char,
  case-sensitive; runs the entry directly from navigation with the same `$NC_*`
  env and pause behavior as the F2 menu) and the built-ins-win collision policy.

**Automated Verification**:
- [x] `test/menu.test.js` (extended) passes: a valid `directKey` is parsed onto
  the item; a multichar `directKey` is dropped while the entry is kept.
- [x] `test/directkeys.test.js` (new) passes: `analyzeDirectKeys` maps each valid
  `directKey` to its item; a `directKey` in `RESERVED_NAV_KEYS` is excluded from
  the map; a duplicate `directKey` keeps the first item.
- [x] `npm test` passes (whole suite).
- [x] `npm run typecheck` passes.

**Manual Verification**:
- [ ] Run the app; with `menu.json`'s Git-status entry given `directKey "G"`,
  press `Shift+G` in folder navigation — `git status` runs, *"Press any key to
  continue…"* appears, a keypress returns and the active pane refreshes (same as
  running it from the F2 menu).
- [ ] With a file hovered, a `directKey` entry running `echo $NC_SELECTED` prints
  the hovered name.
- [ ] Press `F2` — the menu shows the `⟨G⟩` marker next to entries with a
  `directKey`; selecting via `↑↓`+Enter or the in-menu `key` still works.
- [ ] Set an entry's `directKey` to `d`; press `d` in navigation — the built-in
  delete confirmation appears (the menu entry does **not** run).

### Phase 2: Startup shadow/duplicate warning

Dependencies: Phase 1

Surface the `warnings` already produced by `analyzeDirectKeys` so a
misconfigured `directKey` (shadowed by a built-in, or duplicated) is visible.

**Tasks**:
- [x] `src/ui/App.ts`: on mount, if `directKeys.warnings` is non-empty, show the
  first one via `setStatus`, e.g.
  ```ts
  useEffect(() => {
    if (directKeys.warnings.length) {
      setStatus(`⚠ ${directKeys.warnings[0]}`);
    }
  }, [directKeys]);
  ```
  (Transient: the next keypress clears it via the existing status-clear in
  `useInput`.)
- [x] `README.md`: note that shadowed/duplicate `directKey`s are ignored and
  reported with a transient startup status warning.

**Automated Verification**:
- [x] `test/directkeys.test.js` (extended) passes: a reserved-shadow `directKey`
  yields a `shadowed by built-in` warning; a duplicate yields a `duplicated`
  warning; a clean config yields an empty `warnings` array.
- [x] `npm test` passes.
- [x] `npm run typecheck` passes.

**Manual Verification**:
- [ ] Set an entry's `directKey` to `d` (or give two entries the same
  `directKey`); launch the app — a `⚠ directKey …` warning shows in the status
  line and clears on the next keypress.

## Implementation Notes

During implementation, document user feedback, problems, and decisions here.

- **Design change (post-plan):** dropped the separate `directKey` field. Each
  entry now has a single `key` used both in the F2 menu and for direct
  navigation; a boolean `direct: true` flag opts an entry into direct dispatch.
  Rationale (user): one key per entry is simpler; whether an entry is
  direct-accessible is a property of the entry, so flag it in `menu.json`.
  - `MenuItem`: `directKey?: string` → `direct?: boolean`.
  - `parseMenu`: parse `direct === true` (anything else dropped, entry kept).
  - `analyzeDirectKeys`: builds the map from `it.direct` entries keyed by
    `it.key`; new warning case for a `direct` entry with no `key`
    (`direct entry '<label>' has no key`). Shadow/duplicate warnings reworded to
    `direct key '<k>' …`.
  - `MenuDialog`: marker is now a fixed `⟨direct⟩` (was `⟨<char>⟩`).
  - `menu.json`: Git status + lazygit flagged `"direct": true`.
  - Case-sensitivity/built-ins-win/first-wins behavior is unchanged.

## References

- `src/ui/App.ts:308-337` — `onMenuSelect` (the run/reload flow being shared).
- `src/ui/App.ts:339-400` — `useInput` normal-navigation block (built-in
  shortcuts; new `directKey` fallthrough).
- `src/core/menu.ts:57-89` — `parseMenu` (`key` validation to mirror for
  `directKey`).
- `src/ui/MenuDialog.ts` — menu rendering + own input; gains `items` props and
  the `⟨directKey⟩` marker.
- `src/ui/useShell.ts` — `runInTerminal` hand-off (unchanged).
- `test/menu.test.js` — `node --test` style for the parsing tests.
- `docs/agents/plans/2026-07-14-quick-shell-command.md` — related `buildShellEnv`
  extraction (kept inline here; can be unified later).
