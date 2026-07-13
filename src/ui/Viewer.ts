import React from 'react';
import { Box, Text, useInput } from 'ink';
import { readFileSync, statSync } from 'node:fs';
import { highlight } from 'cli-highlight';
import { langForFile } from '../util/lang.ts';
import { formatSize } from '../util/format.ts';
import { html } from './html.ts';

const { useState, useMemo } = React;

// Files above this size skip highlighting and render as plain text.
const MAX_HIGHLIGHT = 1024 * 1024; // 1 MB

type Loaded = { lines: string[]; info: string };

function loadFile(path: string, name: string): Loaded {
  let size = 0;
  try {
    size = statSync(path).size;
  } catch {
    // fall through with size 0
  }
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch (err) {
    return { lines: [`Cannot read file: ${(err as Error).message}`], info: '' };
  }

  // Binary sniff: a NUL byte in the first chunk means it's not text.
  const isBinary = buf.subarray(0, 8000).includes(0);
  if (isBinary) {
    return {
      lines: ['[binary file — preview suppressed]', `${formatSize(size)}`],
      info: `${formatSize(size)} · binary`,
    };
  }

  const code = buf.toString('utf8');
  if (size > MAX_HIGHLIGHT) {
    return { lines: code.split('\n'), info: `${formatSize(size)} · plain (large)` };
  }

  const language = langForFile(name);
  let rendered = code;
  try {
    rendered = highlight(code, { language, ignoreIllegals: true });
  } catch {
    rendered = code; // fall back to plain on any highlighter error
  }
  return {
    lines: rendered.split('\n'),
    info: `${formatSize(size)}${language ? ` · ${language}` : ''}`,
  };
}

type Props = {
  path: string;
  name: string;
  height: number;
  width: number;
  onClose: () => void;
};

export function Viewer({ path, name, height, width, onClose }: Props) {
  const { lines, info } = useMemo(() => loadFile(path, name), [path, name]);
  const total = lines.length;
  const bodyHeight = Math.max(1, height - 2); // minus header + hint
  const maxOffset = Math.max(0, total - bodyHeight);
  const [offset, setOffset] = useState(0);

  const clamp = (n: number) => Math.max(0, Math.min(n, maxOffset));

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }
    if (key.upArrow) setOffset((o) => clamp(o - 1));
    else if (key.downArrow) setOffset((o) => clamp(o + 1));
    else if (key.pageUp) setOffset((o) => clamp(o - bodyHeight));
    else if (key.pageDown) setOffset((o) => clamp(o + bodyHeight));
  });

  const visible = lines.slice(offset, offset + bodyHeight);
  const rows = visible.map((line, i) =>
    html`<${Text} key=${offset + i} wrap="truncate-end">${line || ' '}</${Text}>`,
  );

  const pct = total > bodyHeight ? Math.round((offset / maxOffset) * 100) : 100;

  return html`
    <${Box} flexDirection="column" width=${width} height=${height}>
      <${Box} width=${width}>
        <${Text} color="cyan" bold wrap="truncate-middle">${name}</${Text}>
        <${Text} dimColor>  ${info}  ${pct}%  (Esc to close)</${Text}>
      </${Box}>
      <${Box} flexDirection="column">${rows}</${Box}>
    </${Box}>
  `;
}
