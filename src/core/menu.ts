import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { MenuItem } from '../types.ts';

export type MenuResult = {
  items: MenuItem[];
  path: string;
  reason?: string; // set when items is empty and we want to explain why
};

// Config resolution order (first existing file wins):
//   1. $NODE_COMMANDER_MENU, if set
//   2. ~/.config/node-commander/menu.json  (per-user default)
//   3. ./menu.json in the launch directory (project-local, handy in dev)
export function candidatePaths(): string[] {
  const override = process.env['NODE_COMMANDER_MENU'];
  if (override && override.trim()) return [override];
  return [
    join(homedir(), '.config', 'node-commander', 'menu.json'),
    join(process.cwd(), 'menu.json'),
  ];
}

// Load and validate the menu config. Never throws: a missing or malformed file
// yields an empty list with a human-readable reason so the UI can show a hint.
// Pass an explicit path to bypass resolution (used by tests).
export function loadMenu(explicitPath?: string): MenuResult {
  const paths = explicitPath ? [explicitPath] : candidatePaths();
  const searched: string[] = [];

  for (const path of paths) {
    let raw: string;
    try {
      raw = readFileSync(path, 'utf8');
    } catch {
      searched.push(path);
      continue; // file absent — try the next candidate
    }
    // A file exists here: parse/validate it and return (don't fall through,
    // so a malformed file the user created surfaces its error).
    return parseMenu(raw, path);
  }

  // Nothing found. Suggest creating the last (most project-local) candidate.
  const suggest = paths[paths.length - 1] ?? '';
  return {
    items: [],
    path: suggest,
    reason:
      searched.length > 1
        ? `No menu file found (looked in: ${searched.join(', ')})`
        : `No menu file at ${suggest}`,
  };
}

function parseMenu(raw: string, path: string): MenuResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return { items: [], path, reason: `Malformed JSON: ${(err as Error).message}` };
  }

  // Accept either { items: [...] } or a bare array.
  const rawItems = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data['items'])
      ? (data['items'] as unknown[])
      : null;

  if (!rawItems) {
    return { items: [], path, reason: 'Config has no "items" array' };
  }

  const items: MenuItem[] = [];
  for (const entry of rawItems) {
    if (!isRecord(entry)) continue;
    const { label, command, key, direct } = entry;
    if (typeof label !== 'string' || !label) continue;
    if (typeof command !== 'string' || !command) continue;
    const item: MenuItem = { label, command };
    if (typeof key === 'string' && key.length === 1) item.key = key;
    if (direct === true) item.direct = true;
    items.push(item);
  }

  const reason = items.length === 0 ? 'No valid entries in config' : undefined;
  return { items, path, reason };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// Single-char nav shortcuts bound in App.useInput; a direct entry whose `key`
// equals any of these can never fire (built-ins win). Keep in sync with
// App.useInput.
export const RESERVED_NAV_KEYS = ['u', 'v', 'e', 'c', 'm', 'n', 'd', 'r', 's', 'q'];

export type DirectKeyAnalysis = {
  map: Map<string, MenuItem>;
  warnings: string[];
};

// Build the key → item dispatch map for entries flagged `direct`, used to run
// them straight from folder navigation. An entry flagged direct but without a
// `key` can't be dispatched; a `key` equal to a reserved (built-in) char is
// skipped (built-ins win); a duplicate `key` keeps the first entry. Each skipped
// entry is reported in `warnings`.
export function analyzeDirectKeys(
  items: MenuItem[],
  reservedKeys: string[] = RESERVED_NAV_KEYS,
): DirectKeyAnalysis {
  const reserved = new Set(reservedKeys);
  const map = new Map<string, MenuItem>();
  const warnings: string[] = [];
  for (const it of items) {
    if (!it.direct) continue;
    const dk = it.key;
    if (!dk) {
      warnings.push(`direct entry '${it.label}' has no key`);
      continue;
    }
    if (reserved.has(dk)) {
      warnings.push(`direct key '${dk}' shadowed by built-in`);
      continue;
    }
    if (map.has(dk)) {
      warnings.push(`direct key '${dk}' duplicated`);
      continue; // first wins
    }
    map.set(dk, it);
  }
  return { map, warnings };
}
