---
date: 2026-07-13T21:19:41+00:00
git_commit: 0d6413a9e0d9b6fa4cbb38829772270bff022ae0
branch: main
topic: "Center modal overlays (F2 menu + confirm/input) on screen"
tags: [plan, ui, App, MenuDialog, Dialog, CenteredOverlay]
status: ready
---

# PLAN: Center modal overlays on screen

Show the F2 user menu — and the Confirm / Create-dir / Rename dialogs — centered in
the middle of the screen, floating on top of the two panes (which stay visible),
instead of the current inline, left-aligned placement above the status bar.

## Acceptance Criteria

- The F2 user menu renders centered both horizontally and vertically, floating over
  the panes, with the panes still visible around it.
- The Confirm (copy/move/delete/overwrite) and input (mkdir/rename) dialogs render
  centered the same way.
- The menu/dialog box is opaque where it sits (no pane content bleeds through inside
  the box); the surrounding overlay area does **not** blank the panes.
- The Viewer (F3) full-screen takeover and all modal input routing are unchanged.
- `npm run typecheck` and `node --test` pass, including a new render test that asserts
  centering and that the panes remain visible underneath.

## Technical Key Decisions and Tradeoffs

1. **Overlay via `position="absolute"`, not a full-screen replace.**
   - Why: the panes must remain visible behind the menu. Verified empirically that Ink
     5.2.1 composites a centered absolute box over the panes without blanking them —
     the centering box emits nothing for its empty area (panes show through) while the
     bordered dialog box paints opaque cells where it sits.
   - Impact: add one absolute centering wrapper rendered as a sibling after the panes;
     panes and `StatusBar` stay in normal flow.

2. **One shared centering wrapper for all modals (menu + confirm + input).**
   - Why: the user chose consistent centering for every modal. A single wrapper with
     `justifyContent`/`alignItems="center"` wraps whichever modal element is active.
   - Impact: extract a small presentational `CenteredOverlay` component
     (`src/ui/CenteredOverlay.ts`) used by `App.ts`; keeps `App`'s JSX tidy and gives
     the render test a clean, isolated unit.

3. **Wrapper sized to the full terminal (`width=columns`, `height=rows`).**
   - Why: centering needs a known area. `App` already reads `process.stdout.columns`
     (`totalWidth`); the Viewer already reads `process.stdout.rows` the same way.
   - Impact: read `rows` alongside the existing `totalWidth` in `App.ts`.

4. **Automated render test via a fake-stdout harness (no new dependency) + manual smoke check.**
   - Why: the current suite (`test/*.test.js`, `node --test`) has no Ink-render coverage.
     A fake `stdout` that captures the final frame is dependency-free and proven to work.
   - Impact: new `test/overlay.test.js`; introduces a tiny Ink-render test pattern in
     the repo.

## Current State

All UI lives in one vertical column in `src/ui/App.ts:430-444`. The active modal is
rendered **inline**, right after the panes row and just above the status bar, so it
appears flush-left near the bottom:

```
┌ Box flexDirection="column" ─────────────────────────┐
│ ┌ Box (row) ───────────────────────────────────────┐│
│ │  <Pane 0>            <Pane 1>                     ││
│ └───────────────────────────────────────────────────┘│
│ <Dialog> / <MenuDialog>   ← inline, LEFT-ALIGNED     │
│ <StatusBar>                                          │
└───────────────────────────────────────────────────────┘
```

- `src/ui/App.ts:436-441` — chooses between `<Dialog>` (confirm/input) and
  `<MenuDialog>` (menu) inline.
- `src/ui/App.ts:75-77` — reads `viewHeight` (which already uses `process.stdout.rows`)
  and `totalWidth`, but does not expose a full-terminal `rows` value; the modal render
  site has no rows in scope, and the Viewer branch (`:421`) reads `process.stdout.rows`
  inline. The new overlay needs a full-terminal `rows` value at the modal render site.
- `src/ui/MenuDialog.ts:54-66` — the menu Box: `width={Math.min(width, 60)}`,
  `borderStyle="round"`, owns its own input.
- `src/ui/Dialog.ts:11-47` — presentational confirm/input boxes, no width set.
- `src/types.ts:26-31` — `Modal` union: `none | confirm | input | viewer | menu`.

Input routing is already modal-aware (`src/ui/App.ts:319-347`): confirm/input handled
in `App`, while `viewer` and `menu` own their own input — this does not change.

Verified overlay behaviour (fake-stdout render of a panes stub + absolute centered
box) produced:

```
┌──────────────────┐┌──────────────────┐
│file1             ││fileA             │
│file2             ││fileB             │
│file3             ││fileC             │
│             ╭───────────╮            │   ← menu paints opaque here
│             │ User menu │            │
│             │ [b] Build │            │
│             │ [t] Test  │            │
│             ╰───────────╯            │
└──────────────────┘└──────────────────┘   ← panes intact around it
statusbar here
```

## Desired End State

```
<Box flexDirection="column">              ← root (unchanged)
  <Box row> <Pane/> <Pane/> </Box>        ← unchanged, stays visible
  {modal is confirm|input|menu &&         ← NEW absolute centering sibling
    <CenteredOverlay width={cols} height={rows}>
      {menu ? <MenuDialog/> : <Dialog modal/>}
    </CenteredOverlay>}
  <StatusBar/>                            ← unchanged
</Box>
```

`CenteredOverlay` is:

```
<Box position="absolute" width={width} height={height}
     justifyContent="center" alignItems="center">
  {children}
</Box>
```

The `viewer` branch (`src/ui/App.ts:415-428`) is untouched — it remains a separate
full-screen takeover.

## Abstractions and Code Reuse

- `src/ui`
  - `CenteredOverlay.ts` — **new** presentational wrapper. Props `{ width, height, children }`.
    Renders one `position="absolute"` Box that centers its children. No input, no state.
  - `App.ts` — replace the two inline modal branches (`:436-441`) with a single
    `CenteredOverlay` wrapping the active modal element. Read `rows` from
    `process.stdout.rows` (mirroring the Viewer branch at `:421`).
    - `App` — modal render section only; input routing untouched.
  - `MenuDialog.ts` / `Dialog.ts` — unchanged (already self-contained boxes).
- `test`
  - `overlay.test.js` — **new** `node --test` file using a fake stdout to render
    `CenteredOverlay` over a panes stub and assert centering + panes visibility.

## Logging & Observability

None. This is a pure presentational/layout change with no logging.

## Implementation

Single phase — one vertical slice delivering the centered overlays plus its test.

### Phase 1: Centered modal overlays

Dependencies: None.

Add a reusable centering wrapper, route all non-viewer modals through it, and cover
the behaviour with a render test.

**Tasks**:

- [ ] Add `src/ui/CenteredOverlay.ts`: a presentational component that renders an
  absolute, full-area centering Box.
  ```ts
  import { Box } from 'ink';
  import { html } from './html.ts';

  type Props = { width: number; height: number; children: unknown };

  // Floats its children centered over whatever is already on screen. Uses
  // position="absolute" so the panes underneath stay visible (Ink composites the
  // opaque child box over them; the empty area around it emits nothing).
  export function CenteredOverlay({ width, height, children }: Props) {
    return html`
      <${Box}
        position="absolute"
        width=${width}
        height=${height}
        justifyContent="center"
        alignItems="center"
      >
        ${children}
      </${Box}>
    `;
  }
  ```
- [ ] In `src/ui/App.ts`, import `CenteredOverlay` (alongside the other `./` imports at
  `:8-16`).
- [ ] In `src/ui/App.ts`, add a full-terminal rows value near the existing size reads
  (`:75-77`), reusing the same `|| 24` fallback that `viewHeight` and the Viewer branch
  already use:
  ```ts
  const totalRows = process.stdout.rows || 24;
  ```
- [ ] In `src/ui/App.ts`, replace the two inline modal branches (`:436-441`) with a
  single centered overlay wrapping the active modal element:
  ```ts
  ${modal.type === 'menu' || modal.type === 'confirm' || modal.type === 'input'
    ? html`
        <${CenteredOverlay} width=${totalWidth} height=${totalRows}>
          ${modal.type === 'menu'
            ? html`<${MenuDialog} width=${totalWidth} onSelect=${onMenuSelect} onClose=${closeModal} />`
            : html`<${Dialog} modal=${modal} />`}
        </${CenteredOverlay}>`
    : null}
  ```
- [ ] Add `test/overlay.test.js`: render `CenteredOverlay` (with a bordered child box)
  over a two-pane stub through a fake stdout, then assert on the captured frame:
  - pane marker text (e.g. `file1`, `fileA`) is still present → panes visible;
  - the child box's content line has leading whitespace before its left border and the
    box is not flush-left → horizontally centered;
  - the child box does not start on the first or last row → vertically centered.
  Use the `node:test` + `assert/strict` style of `test/menu.test.js`. Strip ANSI with
  `frame.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')`. Fake stdout shape:
  ```js
  import { EventEmitter } from 'node:events';
  class FakeStdout extends EventEmitter {
    constructor(cols, rows) { super(); this.columns = cols; this.rows = rows; this.frames = []; }
    write(d) { this.frames.push(d); }
  }
  // render(tree, { stdout, patchConsole: false }); read last frame after a tick; unmount.
  ```
- [ ] Update `README.md` (F2 section around `:57-75`) to note the user menu now appears
  centered over the panes.

**Automated Verification**:
- [ ] `npm run typecheck` passes (`tsc --noEmit`).
- [ ] `node --test` passes, including the new `test/overlay.test.js`.
- [ ] `test/overlay.test.js` asserts panes text is present in the rendered frame.
- [ ] `test/overlay.test.js` asserts the centered box is offset from both the left edge
  and the top edge (i.e. centered, not inline).

**Manual Verification**:
- [ ] Run `npm start`; press `F2` (or `u`) — the user menu appears centered over both
  panes, panes still visible around it; `↑/↓` + Enter and Esc still work.
- [ ] Press `F7` (create directory) and `F8` (delete) — the input and confirm dialogs
  appear centered; typing/Enter/Esc still work.
- [ ] Press `F3` on a file — the Viewer still opens as a full-screen takeover
  (unchanged).

## Implementation Notes

During implementation, document user feedback, problems, and decisions here.

## References

- `src/ui/App.ts:415-444` — modal render section (viewer branch + inline modals).
- `src/ui/MenuDialog.ts:54-66` — menu box.
- `src/ui/Dialog.ts:11-47` — confirm/input boxes.
- `src/types.ts:26-31` — `Modal` union.
- Ink 5.2.1 absolute positioning: `node_modules/ink/build/styles.js:2-8`; buffer
  compositing: `node_modules/ink/build/render-node-to-output.js:24-98`.
- `test/menu.test.js` — `node --test` conventions.
