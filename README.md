# Node Explorer

A Norton Commander–style two-pane terminal file manager. Built on **Node ≥ 24**
native type stripping — the `.ts` sources run directly, with **no compiler and no
build step**. Ink (React for the terminal) is driven through
[`htm`](https://github.com/developit/htm) tagged templates instead of JSX.

## Requirements

- Node **≥ 24** (native type stripping is on by default).

## Install & run

```sh
npm install
npm start          # node src/index.ts
```

Both panes open on the current working directory. Quit with `F10` or `q`.

## Keybindings

Every action has both a Norton-Commander F-key and a letter shortcut.

| Key         | Letter | Action                                            |
| ----------- | ------ | ------------------------------------------------- |
| `Tab`       |        | Switch the active pane                            |
| `↑` `↓`     |        | Move the cursor                                   |
| `PgUp/PgDn` |        | Page the cursor                                   |
| `Enter`     |        | Descend into a directory / `..` to go up          |
| `F2`        | `u`    | Custom-script user menu                           |
| `F3`        | `v`    | View file (in-app, syntax-highlighted, read-only) |
| `F4`        | `e`    | Edit file in `$EDITOR` (else `vim`)               |
| `F5`        | `c`    | Copy (default dest = the **other** pane's dir)    |
| `F6`        | `m`    | Move (default dest = the **other** pane's dir)    |
| `F7`        | `n`    | Make directory                                    |
| `F8`        | `d`    | Delete (with confirmation)                        |
| `r`         |        | Rename in place                                   |
| `s`         |        | Compute a directory's recursive size on demand    |
| `F10`       | `q`    | Quit                                              |

Notes:

- Directories show `<DIR>` for their size until `s` computes it on demand (the
  result is cached on that pane's entry).
- **Copy / Move** default their destination to the other pane's directory, shown
  in the confirmation dialog. Copying/moving onto an existing name asks to
  overwrite first.
- Operation results and errors appear on a transient **status line** at the
  bottom, cleared on the next keypress.
- **F3 viewer** highlights source files with [`cli-highlight`](https://www.npmjs.com/package/cli-highlight);
  large (> 1 MB) or binary files fall back to plain text. Scroll with `↑/↓` and
  `PgUp/PgDn`; `Esc` closes.
- **F4** hands the terminal to your editor full-screen; on quit you return to the
  same pane/cursor and the file's size refreshes.

## Custom-script user menu (F2)

Press `F2` (or `u`) to open a menu of your own scripts. Choose with `↑/↓` +
`Enter`, or press an entry's single-key hotkey; `Esc` cancels.

The selected script runs in the terminal with the **active pane** as its working
directory, followed by a _Press any key to continue…_ pause, then control returns
to Node Explorer and the pane refreshes.

### Config file

Resolved in order (first existing file wins):

1. `$NODE_EXPLORER_MENU`, if set.
2. `~/.config/node-explorer/menu.json` (per-user default).
3. `./menu.json` in the launch directory (project-local — handy in dev; a sample
   is included in this repo).

A missing or malformed file is handled gracefully — the menu opens empty with a
hint rather than crashing. The file is JSON, either `{ "items": [...] }` or a bare
array. Each entry needs a `label` and a `command`; `key` (a single-character
hotkey) is optional. Invalid entries are dropped.

```json
{
  "items": [
    { "key": "g", "label": "Git status", "command": "git status" },
    { "key": "b", "label": "Build", "command": "npm run build" },
    { "label": "Disk usage here", "command": "du -sh *" }
  ]
}
```

### Environment exposed to scripts

| Variable           | Value                                               |
| ------------------ | --------------------------------------------------- |
| `NE_CWD`           | Active pane's directory (also the script's `cwd`)   |
| `NE_SELECTED`      | Name of the hovered entry (empty on the `..` row)   |
| `NE_SELECTED_PATH` | Absolute path of the hovered entry                  |

Example command using them: `"command": "echo Editing $NE_SELECTED in $NE_CWD"`.

## Development

```sh
npm test           # node --test — unit tests for pure/core logic
npm run typecheck  # tsc --noEmit — confirms all syntax is erasable
```

The type check never builds or runs the app; it only verifies that Node can
strip types from every source unmodified.
