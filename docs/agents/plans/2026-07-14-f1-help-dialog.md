---
date: 2026-07-14T12:51:38+00:00
git_commit: f1650de6618ecf2a602948d04925d0fa31349d10
branch: main
topic: "F1 keybindings help dialog"
tags: [plan, ui, HelpDialog, useFKeys, StatusBar, modal]
status: ready
---

# PLAN: F1 keybindings help dialog

Add an in-app help overlay, opened with **F1**, that lists the keybindings and
their meaning. It shows the built-in navigation and action keys (F-key + letter)
plus the user's configured `menu.json` entries, floats centered over the panes
like the F2 user menu, and closes on Esc / any key or a second F1 press.

## Acceptance Criteria

- Pressing **F1** from normal navigation opens a centered "Keybindings" help
  overlay; the panes stay visible around it but do **not** bleed through its
  interior.
- The overlay lists built-in bindings grouped and readable: navigation
  (`Tab`, `↑ ↓`, `PgUp/PgDn`, `Enter`) and actions with both the F-key and the
  letter shortcut (F1 Help, F2/u Menu, F3/v View, F4/e Edit, F5/c Copy,
  F6/m Move, F7/n MkDir, F8/d Delete, `r` Rename, `s` Size, F10/q Quit).
- The overlay also lists the user's configured `menu.json` entries under a
  **Custom** section — each with its `key`, `label`, and a `⟨direct⟩` marker for
  direct entries. The section is omitted entirely when there are no entries.
- The overlay is dismissed by **Esc**, **Enter**, or any character key; pressing
  **F1** again while it is open also closes it (toggle). F1 is **inert** while a
  different modal (confirm / input / viewer / menu) is open.
- The bottom status bar shows **`F1 Help`** ahead of `F2..F10`.
- The README keybindings table documents **F1**.

## Technical Key Decisions and Tradeoffs

1. **Content is hardcoded in `HelpDialog`; the custom section derives from
   `menu.items`:** built-in rows are a static array inside the new component; the
   custom section maps over the `menu.items` already loaded in `App`.
   - Why: smallest diff; avoids introducing a shared keybindings module.
   - Impact: `HelpDialog` becomes a 4th place that lists bindings (alongside
     `StatusBar`, the input handlers, and the README) — an accepted trade-off.

2. **New modal variant `{ type: 'help' }`, rendered like `MenuDialog`:** the
   overlay owns its own `useInput` and paints an opaque space-backdrop to stop
   the panes bleeding through.
   - Why: reuses the proven `CenteredOverlay` + no-bleed pattern and its existing
     test harness.
   - Impact: add the variant to the `Modal` union; add `help` to `App`'s
     modal-routing early-return so the main `useInput` doesn't double-handle keys.

3. **F1 toggle handled in `useFKeys`:** F1 opens when `modal.type === 'none'`,
   closes when `modal.type === 'help'`, and is ignored for any other modal;
   handled before the existing `modal.type !== 'none'` guard so it never falls
   through to the F2..F10 switch.
   - Why: gives a toggle without letting help stack over other dialogs.
   - Impact: a small special-case at the top of the `useFKeys` callback.

4. **`HelpDialog`'s "any key closes" ignores empty input:** it closes on Esc,
   Enter, or any non-empty `input` (mirroring `MenuDialog`'s `else if (input)`).
   - Why: Ink delivers the swallowed F1 keypress as `input === ''` with all flags
     false; ignoring empty input stops that same F1 press from also triggering a
     close (the F1 toggle in `useFKeys` handles closing instead).

## Current State

Keybinding information lives in three hand-maintained places — there is no single
source of truth:

```
src/ui/StatusBar.ts:5-14   HINTS = [2 Menu][3 View][4 Edit][5 Copy]
                                    [6 Move][7 MkDir][8 Del][10 Quit]   ← F-key bar
src/ui/App.ts:412-427      useInput letter shortcuts: u v e c m n d r s q
src/ui/App.ts:445-471      useFKeys switch: F2 F3 F4 F5 F6 F7 F8 F10
README.md:62-77            docs table (F-key / letter / action)
```

F1 is already **decoded but unbound**: `src/util/fkeys.ts:17` maps `\x1bOP → 'F1'`,
but the `useFKeys` switch in `App.ts:445` has no `case 'F1'`, so it does nothing.

Modal system (a discriminated union drives every overlay):

```
types.ts:29-34   Modal = none | confirm | input | viewer | menu
App.ts:43        const [modal, setModal] = useState<Modal>({type:'none'})
App.ts:369-395   useInput modal routing: input/menu/viewer/confirm handled first
App.ts:442-443   useFKeys is INERT while any modal is open (modal.type !== 'none')
App.ts:495-502   render: CenteredOverlay → (MenuDialog | Dialog)
```

Two overlay styles exist to model on:
- `Dialog.ts` — presentational; **App owns its input** (`App.ts:369-395`).
- `MenuDialog.ts` — **owns its own `useInput`** (arrows / Esc / hotkeys) and closes
  via an `onClose` prop. Both use the opaque space-backdrop trick; `overlay.test.js`
  asserts panes never bleed through the interior.

## Desired End State

A 5th modal variant `{ type: 'help' }`, opened by a new `case 'F1'` in `useFKeys`
and rendered through the existing `CenteredOverlay` slot:

```
useFKeys(id):
  if id == 'F1':
     modal none  → open help
     modal help  → close
     else        → ignore (F1 inert over other dialogs)
     return
  if modal != none: return
  switch(id) { F2..F10 }               ← unchanged

App render:
  <Box>
    <Pane/> <Pane/>
    modal is menu|confirm|input|help ?
       <CenteredOverlay>
          menu  → <MenuDialog/>
          help  → <HelpDialog items=menu.items/>   ← NEW
          else  → <Dialog/>
       </CenteredOverlay>
    <StatusBar/>   ← now leads with "F1 Help"
```

Overlay mock (built-ins + a custom section from `menu.json`):

```
        ┌─ Keybindings ─────────────────────────────┐
        │ Navigation                                │
        │   Tab        Switch pane                   │
        │   ↑ ↓        Move cursor                   │
        │   PgUp/PgDn  Page cursor                   │
        │   Enter      Open dir / .. up             │
        │ Actions                                   │
        │   F1   Help                               │
        │   F2 u User menu                          │
        │   F3 v View                               │
        │   F4 e Edit                               │
        │   F5 c Copy                               │
        │   F6 m Move                               │
        │   F7 n MkDir                              │
        │   F8 d Delete                             │
        │      r Rename                             │
        │      s Size                               │
        │   F10 q Quit                              │
        │ Custom (menu.json)                        │
        │   g  Git status  ⟨direct⟩                 │
        │   l  LazyGit     ⟨direct⟩                 │
        │   d  Disk usage of entries                │
        │ Esc / any key to close                    │
        └───────────────────────────────────────────┘
```

## Abstractions and Code Reuse

- Reuse `CenteredOverlay` for positioning and the `MenuDialog` opaque-backdrop +
  `line()` clamping pattern verbatim (copy the interior-cell technique so
  `assertNoBleed` in `overlay.test.js` holds).
- Reuse the already-loaded `menu.items` (from `loadMenu()` in `App.ts:51`) — no new
  loading. `MenuItem` (`types.ts:19`) already carries `key`, `direct`, `label`.

- `src/types.ts`
  - `Modal` — add `| { type: 'help' }` variant.
- `src/ui/HelpDialog.ts` — **new.** Presentational overlay; owns its own `useInput`.
  - built-in `BINDINGS` rows (static) + a Custom section mapped from `items`.
  - opaque space-backdrop; `line()` clamp; `onClose` prop.
- `src/ui/App.ts`
  - `useFKeys` — add F1 open/close/toggle special-case (before the modal guard).
  - `useInput` — add `help` to the `viewer | menu` early-return.
  - render — add `help` to the overlay condition and render `<HelpDialog/>`.
  - `openHelp` — `useCallback(() => setModal({ type: 'help' }), [])`.
- `src/ui/StatusBar.ts`
  - `HINTS` — prepend `['1', 'Help']`.
- `README.md`
  - keybindings table — add the `F1` row; note F1 in the intro line if needed.

No new logging/observability. No config or persistence changes.

## Logging & Observability

No changes. The help dialog is purely presentational and produces no status-line
output (opening/closing it does not set `status`).

## Implementation

### Phase 1: F1 keybindings help dialog

Dependencies: None

Add the `help` modal variant, the `HelpDialog` component, the F1 open/close/toggle
wiring, the status-bar hint, and docs — one vertical slice.

**Tasks**:

- [x] `src/types.ts`: add `| { type: 'help' }` to the `Modal` union
  (after the `menu` variant).

- [x] `src/ui/HelpDialog.ts`: new presentational component modeled on
  `MenuDialog.ts`. Props: `{ width: number; items: MenuItem[]; onClose: () => void }`.
  - Static built-in rows, each a `[fkey, letter, action]` triple; render as
    aligned columns via the `line()` clamp. Include groups "Navigation" and
    "Actions" (bold headers), covering: Tab, ↑ ↓, PgUp/PgDn, Enter; F1 Help,
    F2/u Menu, F3/v View, F4/e Edit, F5/c Copy, F6/m Move, F7/n MkDir, F8/d Delete,
    `r` Rename, `s` Size, F10/q Quit.
  - Custom section: only when `items.length > 0`, a bold "Custom (menu.json)"
    header followed by one row per item: `key`, `label`, and ` ⟨direct⟩` when
    `it.direct`.
  - Footer hint row: `Esc / any key to close`.
  - Copy the opaque space-backdrop (one space-line per content row) and the
    `line()` column-clamp from `MenuDialog` so the interior is fully painted and
    never wraps. Size the box like `MenuDialog` (`Math.min(width, 60)`; widen the
    cap only if the action columns need it).
  - Own `useInput`: `if (key.escape || key.return || input) onClose();` — note the
    `input` check keeps the swallowed-F1 empty keypress from closing it.

  ```ts
  // shape sketch
  const BINDINGS: { group: string; rows: [string, string, string][] }[] = [
    { group: 'Navigation', rows: [['Tab','','Switch pane'], ['↑ ↓','','Move cursor'],
      ['PgUp/PgDn','','Page cursor'], ['Enter','','Open dir / .. up']] },
    { group: 'Actions', rows: [['F1','','Help'], ['F2','u','User menu'],
      ['F3','v','View'], ['F4','e','Edit'], ['F5','c','Copy'], ['F6','m','Move'],
      ['F7','n','MkDir'], ['F8','d','Delete'], ['','r','Rename'], ['','s','Size'],
      ['F10','q','Quit']] },
  ];
  ```

- [x] `src/ui/App.ts`: add `const openHelp = useCallback(() => setModal({ type: 'help' }), []);`
  near `openMenu` (App.ts:324).

- [x] `src/ui/App.ts`: in `useFKeys` (App.ts:442), handle F1 before the modal guard:
  ```ts
  useFKeys((id) => {
    if (id === 'F1') {
      if (modal.type === 'none') openHelp();
      else if (modal.type === 'help') closeModal();
      return;
    }
    if (modal.type !== 'none') return;
    if (status) setStatus('');
    switch (id) { /* unchanged F2..F10 */ }
  });
  ```

- [x] `src/ui/App.ts`: in `useInput` (App.ts:385), extend the owns-its-own-input
  early return to include help:
  `if (modal.type === 'viewer' || modal.type === 'menu' || modal.type === 'help') return;`

- [x] `src/ui/App.ts`: in the render (App.ts:495-502), add `help` to the overlay
  condition and render the component:
  ```ts
  ${modal.type === 'menu' || modal.type === 'confirm' || modal.type === 'input' || modal.type === 'help'
    ? html`<${CenteredOverlay} ...>
        ${modal.type === 'menu' ? html`<${MenuDialog} ... />`
          : modal.type === 'help' ? html`<${HelpDialog} width=${totalWidth} items=${menu.items} onClose=${closeModal} />`
          : html`<${Dialog} modal=${modal} />`}
      </${CenteredOverlay}>` : null}
  ```
  Add the `import { HelpDialog } from './HelpDialog.ts';`.

- [x] `src/ui/StatusBar.ts`: prepend `['1', 'Help']` to `HINTS` (StatusBar.ts:5).

- [x] `README.md`: add an `F1 | | Show this keybindings help` row to the table
  (README.md:62-77) and mention F1 in the "Keybindings" intro if appropriate.

- [x] `test/help.test.js`: new test file mirroring `overlay.test.js`.
  - Render `HelpDialog` (with `FakeStdin`) inside a `#`-packed backdrop scene and
    assert `assertNoBleed(lines)` — no panes bleed through the interior.
  - Assert built-in content present (e.g. frame includes `Copy`, `Rename`, `Help`).
  - Pass `items=[{key:'g',direct:true,label:'Git status'}]` and assert the frame
    includes `Git status` and `⟨direct⟩`.
  - Render with `items=[]` and assert the frame does **not** include
    `Custom (menu.json)`.

**Automated Verification**:
- [x] `npm test` passes (includes the new `test/help.test.js`).
- [x] `npm run typecheck` passes (new `help` variant handled everywhere the
  `Modal` union is matched).
- [x] `test/help.test.js` no-bleed assertion passes.

**Manual Verification**:
- [ ] Run `npm start`; press **F1** — the "Keybindings" overlay appears centered
  with the panes still visible around it and nothing bleeding through its interior.
- [ ] The overlay lists the built-in bindings and, if `./menu.json` exists, a
  "Custom (menu.json)" section with the configured entries and `⟨direct⟩` markers.
- [ ] Press **F1** again → it closes; reopen and press **Esc** or any letter → it
  closes.
- [ ] Open a confirm dialog (e.g. `d` Delete) and press **F1** → nothing happens
  (F1 inert over other modals).
- [ ] The bottom status bar shows **`F1 Help`** before `F2 Menu`.

## Implementation Notes

During implementation, document user feedback, problems, and decisions here.

## References

- `src/ui/MenuDialog.ts` — overlay pattern to model on (own input, opaque backdrop,
  `line()` clamp).
- `src/ui/CenteredOverlay.ts` — centered floating overlay.
- `src/ui/useFKeys.ts` / `src/util/fkeys.ts` — F1 already decoded, currently unbound.
- `src/ui/App.ts:442-472` — `useFKeys` switch; `App.ts:369-395` — `useInput` modal
  routing; `App.ts:495-502` — overlay render slot.
- `src/ui/StatusBar.ts:5-14` — function-key hint bar.
- `test/overlay.test.js` — `FakeStdout`/`FakeStdin` + `assertNoBleed` harness to reuse.
- `README.md:58-92` — keybindings docs.
