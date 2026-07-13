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
//   1. $NODE_EXPLORER_MENU, if set
//   2. ~/.config/node-explorer/menu.json  (per-user default)
//   3. ./menu.json in the launch directory (project-local, handy in dev)
export function candidatePaths(): string[] {
  const override = process.env['NODE_EXPLORER_MENU'];
  if (override && override.trim()) return [override];
  return [
    join(homedir(), '.config', 'node-explorer', 'menu.json'),
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
    const { label, command, key } = entry;
    if (typeof label !== 'string' || !label) continue;
    if (typeof command !== 'string' || !command) continue;
    const item: MenuItem = { label, command };
    if (typeof key === 'string' && key.length === 1) item.key = key;
    items.push(item);
  }

  const reason = items.length === 0 ? 'No valid entries in config' : undefined;
  return { items, path, reason };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
