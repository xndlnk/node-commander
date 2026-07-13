// Formatting helpers for the listing rows: human sizes, dates, and column padding.

const UNITS = ['B', 'K', 'M', 'G', 'T', 'P'];

// Human-readable byte size, e.g. 0 -> "0 B", 1536 -> "1.5 K", 1048576 -> "1.0 M".
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${UNITS[unit]}`;
}

// Compact, fixed-width date: "YYYY-MM-DD HH:MM".
export function formatDate(mtime: Date): string {
  if (!(mtime instanceof Date) || Number.isNaN(mtime.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${mtime.getFullYear()}-${p(mtime.getMonth() + 1)}-${p(mtime.getDate())} ${p(mtime.getHours())}:${p(mtime.getMinutes())}`;
}

// Pad (or truncate-with-ellipsis) a string to an exact display width.
export function padName(name: string, width: number): string {
  if (name.length === width) return name;
  if (name.length < width) return name + ' '.repeat(width - name.length);
  if (width <= 1) return name.slice(0, width);
  return name.slice(0, width - 1) + '…';
}

// Right-align a value (size/date column) to a fixed width.
export function padLeft(value: string, width: number): string {
  if (value.length >= width) return value;
  return ' '.repeat(width - value.length) + value;
}

// Truncate a path in the middle so both ends stay visible: /very/long/…/tail.
export function truncateMiddle(str: string, width: number): string {
  if (str.length <= width) return str;
  if (width <= 1) return str.slice(0, width);
  const keep = width - 1;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return str.slice(0, head) + '…' + str.slice(str.length - tail);
}
