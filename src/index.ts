#!/usr/bin/env node
import { render } from 'ink';
import { App } from './ui/App.ts';
import { html } from './ui/html.ts';

render(html`<${App} />`);
