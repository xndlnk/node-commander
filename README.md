# Node Commander

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

## Change directory on quit

A program can't change the directory of the shell that launched it, so — like
`ranger`/`nnn`/`yazi` — Node Commander writes the active pane's directory to the
file named by `$NC_CWD_FILE` on quit, and a small shell wrapper `cd`s there.

The wrapper is shell-specific (only the `$NC_CWD_FILE` contract is shared).
Adjust the path to `src/index.ts` for your checkout.

**bash / zsh** — add to `~/.bashrc` / `~/.zshrc`:

```sh
nc() {
  local tmp; tmp="$(mktemp)"
  NC_CWD_FILE="$tmp" node /path/to/node-commander/src/index.ts "$@"
  local dir; dir="$(cat "$tmp")"
  rm -f "$tmp"
  [ -n "$dir" ] && [ -d "$dir" ] && cd "$dir"
}
```

**fish** — save as `~/.config/fish/functions/nc.fish` (autoloaded):

```fish
function nc
    set -l tmp (mktemp)
    env NC_CWD_FILE=$tmp node /path/to/node-commander/src/index.ts $argv
    set -l dir (cat $tmp)
    rm -f $tmp
    test -n "$dir"; and test -d "$dir"; and cd $dir
end
```

Now run `nc`, navigate around, quit — your shell lands in the last directory you
were in. Without `$NC_CWD_FILE` set (e.g. plain `npm start`), quitting behaves as
before and leaves your shell where it was.

## Keybindings

Every action has both a Norton-Commander F-key and a letter shortcut.

| Key         | Letter | Action                                            |
| ----------- | ------ | ------------------------------------------------- |
| `Tab`       |        | Switch the active pane                            |
| `↑` `↓`     |        | Move the cursor                                   |
| `PgUp/PgDn` |        | Page the cursor                                   |
| `Enter`     |        | Descend into a directory / `..` to go up          |
| `F1`        |        | Show this keybindings help overlay                |
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

Press `F2` (or `u`) to open a menu of your own scripts. The menu appears centered
over the panes (which stay visible around it). Choose with `↑/↓` + `Enter`, or
press an entry's single-key hotkey; `Esc` cancels.

The selected script runs in the terminal with the **active pane** as its working
directory, followed by a _Press any key to continue…_ pause, then control returns
to Node Commander and the pane refreshes.

### Config file

Resolved in order (first existing file wins):

1. `$NODE_COMMANDER_MENU`, if set.
2. `~/.config/node-commander/menu.json` (per-user default).
3. `./menu.json` in the launch directory (project-local — handy in dev; a sample
   is included in this repo).

A missing or malformed file is handled gracefully — the menu opens empty with a
hint rather than crashing. The file is JSON, either `{ "items": [...] }` or a bare
array. Each entry needs a `label` and a `command`; `key` (a single-character
hotkey) and `direct` (see below) are optional. Invalid entries are dropped.

```json
{
  "items": [
    { "key": "g", "direct": true, "label": "Git status", "command": "git status" },
    { "key": "b", "label": "Build", "command": "npm run build" },
    { "label": "Disk usage here", "command": "du -sh *" }
  ]
}
```

### Direct entries — run without opening the menu

Add `"direct": true` to an entry to make its `key` run the command **directly
from folder navigation**, without opening the F2 menu first. There is just one
`key` per entry: it selects the entry inside the F2 menu and — when `direct` is
set — also triggers it from navigation. It runs through the exact same path as
selecting it in the menu — same `$NC_*` env, working directory, `Press any key to
continue…` pause, and pane refresh.

Key matching is **case-sensitive**, so if a lowercase key would collide you can
use an uppercase one (e.g. `G` = Shift-g). Built-in navigation shortcuts always
win: a direct entry whose `key` is a reserved char (`u v e c m n d r s q`) never
fires from navigation (it still works inside the menu). If two direct entries
share a `key`, the first one wins. The F2 menu shows a `⟨direct⟩` marker next to
direct entries.

A direct entry that is shadowed by a built-in, duplicated, or missing a `key` is
ignored for direct dispatch and reported with a transient warning on the status
line at startup (cleared on the next keypress).

### Environment exposed to scripts

| Variable           | Value                                               |
| ------------------ | --------------------------------------------------- |
| `NC_CWD`           | Active pane's directory (also the script's `cwd`)   |
| `NC_SELECTED`      | Name of the hovered entry (empty on the `..` row)   |
| `NC_SELECTED_PATH` | Absolute path of the hovered entry                  |

Example command using them: `"command": "echo Editing $NC_SELECTED in $NC_CWD"`.

## Development

```sh
npm test           # node --test — unit tests for pure/core logic
npm run typecheck  # tsc --noEmit — confirms all syntax is erasable
```

The type check never builds or runs the app; it only verifies that Node can
strip types from every source unmodified.
