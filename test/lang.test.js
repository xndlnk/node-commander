import { test } from 'node:test';
import assert from 'node:assert/strict';
import { langForFile } from '../src/util/lang.ts';

test('langForFile: maps common extensions to highlight.js ids', () => {
  assert.equal(langForFile('App.ts'), 'typescript');
  assert.equal(langForFile('index.js'), 'javascript');
  assert.equal(langForFile('data.json'), 'json');
  assert.equal(langForFile('style.css'), 'css');
  assert.equal(langForFile('main.py'), 'python');
});

test('langForFile: extensionless known filenames', () => {
  assert.equal(langForFile('Dockerfile'), 'dockerfile');
  assert.equal(langForFile('Makefile'), 'makefile');
});

test('langForFile: unknown extension returns undefined', () => {
  assert.equal(langForFile('notes.xyz'), undefined);
  assert.equal(langForFile('README'), undefined);
  assert.equal(langForFile('archive.zip'), undefined);
});
