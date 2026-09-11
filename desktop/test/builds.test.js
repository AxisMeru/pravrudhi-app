'use strict';
// This is the product edition of Pravrudhi, built per ADR-0049: a clean-slate platform
// that takes one objective and produces one artifact. It does not build Studio.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {editionOf, PRODUCT} = require('../lib/edition');

const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, '..', name), 'utf8'));
const config = read('electron-builder.json');

test('the product build is configured correctly', () => {
  assert.ok(config.appId);
  assert.ok(config.productName);
  assert.ok(config.directories.output);
});

test('the product build targets the three desktop operating systems', () => {
  assert.ok(config.linux?.target, 'no linux target');
  assert.ok(config.mac?.target, 'no mac target');
  assert.ok(config.win?.target, 'no windows target');
});

test('the windows installer does not demand an administrator', () => {
  // An end user downloading this should not need to elevate.
  assert.equal(config.nsis.perMachine, false);
  assert.equal(config.nsis.oneClick, false, 'a silent one-click install is not what a download should do');
});

test('no build uses extraMetadata, which rewrites this repository\'s own package.json', () => {
  // Not a style preference. With the app directory equal to the project directory, electron-builder writes the
  // transformed package.json back over the source. The edition comes from productName, which needs no stamping.
  assert.equal(config.extraMetadata, undefined);
});

test('the source package.json still has everything a build needs', () => {
  // The canary for the failure above: if a build ever clobbers this file again, this goes red rather than the
  // next build failing with "script not found" and no explanation.
  const pkg = read('package.json');
  assert.ok(pkg.scripts && Object.keys(pkg.scripts).length > 3, 'package.json lost its scripts');
  assert.ok(pkg.devDependencies?.['electron-builder'], 'package.json lost its build dependencies');
  assert.equal(pkg.main, 'main.js');
});

test('all build scripts name electron-builder.json', () => {
  const scripts = read('package.json').scripts;
  for (const [name, command] of Object.entries(scripts)) {
    if (!name.startsWith('dist')) continue;
    assert.match(command, /--config electron-builder\.json/, `${name} does not name the configuration`);
  }
});
