import React from 'react';
import { useStdin } from 'ink';
import type { EventEmitter } from 'node:events';
import { decodeFKey } from '../util/fkeys.ts';

// Ink's useInput swallows F-keys (see fkeys.ts), so we tap the raw stdin chunks
// that Ink re-emits on its internal event emitter and decode F-keys ourselves.
// Using this emitter (rather than a second stdin 'data' listener) avoids
// switching Ink's paused/readable stream into flowing mode.
type StdinContextInternal = {
  internal_eventEmitter?: EventEmitter;
  isRawModeSupported: boolean;
};

export function useFKeys(onFKey: (id: string) => void) {
  const stdinCtx = useStdin() as unknown as StdinContextInternal;
  const emitter = stdinCtx.internal_eventEmitter;
  // Keep the latest handler without re-subscribing on every render.
  const handlerRef = React.useRef(onFKey);
  handlerRef.current = onFKey;

  React.useEffect(() => {
    if (!emitter) return;
    const onInput = (chunk: unknown) => {
      const seq = typeof chunk === 'string' ? chunk : String(chunk);
      const id = decodeFKey(seq);
      if (id) handlerRef.current(id);
    };
    emitter.on('input', onInput);
    return () => {
      emitter.off('input', onInput);
    };
  }, [emitter]);
}
