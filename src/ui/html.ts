import React from 'react';
import htmDefault from 'htm';

// Shared htm binding. Every component renders via this `html` tagged template
// instead of JSX (Node's native type stripping cannot transform JSX).
//
// Typing note: htm ships as CommonJS with an ESM `.d.ts`. Under nodenext,
// TypeScript models the CJS default import as the module *namespace*, so
// `htmDefault.bind` isn't visible on the inferred type even though Node's
// runtime interop hands us the real callable binder. We cast through the
// binder's actual shape to reconcile the two.
type Html = (strings: TemplateStringsArray, ...values: unknown[]) => React.ReactElement;
type Binder = { bind(h: typeof React.createElement): Html };

const htm = htmDefault as unknown as Binder;

export const html: Html = htm.bind(React.createElement);
