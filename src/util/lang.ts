import { supportsLanguage } from 'cli-highlight';

// Map a filename's extension to a highlight.js language id. Returns undefined
// for unknown/unsupported extensions so the viewer highlights with auto-detect
// disabled (plain), avoiding mis-highlighting.
const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  svg: 'xml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  sql: 'sql',
  swift: 'swift',
  kt: 'kotlin',
  lua: 'lua',
  pl: 'perl',
  r: 'r',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
};

export function langForFile(name: string): string | undefined {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  // Files like `Dockerfile`/`Makefile` have no extension: match the whole name.
  const key = dot > 0 ? lower.slice(dot + 1) : lower;
  const lang = EXT_TO_LANG[key];
  if (lang && supportsLanguage(lang)) return lang;
  return undefined;
}
