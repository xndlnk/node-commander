// Map raw F-key escape sequences to ids.
//
// Ink's useInput cannot surface F-keys at all: its parseKeypress classifies
// them as name 'f1'..'f12' (in nonAlphanumericKeys), so useInput delivers
// input === '' with every key flag false — indistinguishable from noise.
// We therefore read the raw stdin chunks Ink re-emits on its internal event
// emitter (see useFKeys.ts) and decode the sequences ourselves.
//
// Raw wire sequences (as they arrive in a single keypress chunk):
//   F1–F4  -> SS3:  \x1bOP \x1bOQ \x1bOR \x1bOS
//   F5–F10 -> CSI:  \x1b[15~ \x1b[17~ \x1b[18~ \x1b[19~ \x1b[20~ \x1b[21~
//
// We match the *entire* chunk exactly. A single F-key press arrives as its own
// chunk, so pasted text containing these bytes (a larger chunk) never matches.

const SEQUENCES: Record<string, string> = {
  '\x1bOP': 'F1',
  '\x1bOQ': 'F2',
  '\x1bOR': 'F3',
  '\x1bOS': 'F4',
  '\x1b[15~': 'F5',
  '\x1b[17~': 'F6',
  '\x1b[18~': 'F7',
  '\x1b[19~': 'F8',
  '\x1b[20~': 'F9',
  '\x1b[21~': 'F10',
};

// Returns the F-key id ('F5', ...) or null for any non-F-key chunk.
export function decodeFKey(sequence: string): string | null {
  return SEQUENCES[sequence] ?? null;
}
