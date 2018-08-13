#!/usr/bin/env node_modules/.bin/ts-node
// Shebang is required, and file *has* to be executable: chmod +x file.test.js
// See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741
 // tslint:disable:max-line-length
// tslint:disable:object-literal-key-quotes
import {test} from 'tap';
import {buildDepTreeFromFiles} from '../../lib';
import * as fs from 'fs';

const load = (filename) => fs.readFileSync(
  `${__dirname}/fixtures/${filename}`, 'utf8');

test('Parse npm package-lock.json', async (t) => {
  const expectedDepTree = load('goof/dep-tree_small.json');

  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/goof/`,
    'package.json',
    'package-lock.json',
  );

  t.deepEqual(depTree, JSON.parse(expectedDepTree), 'Tree generated as expected');
});

test('Parse npm package-lock.json with devDependencies', async (t) => {
  const expectedDepTree = load('goof/dep-tree_small_dev.json');

  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/goof/`,
    'package.json',
    'package-lock.json',
    true,
  );

  t.deepEqual(depTree, JSON.parse(expectedDepTree), 'Tree generated as expected');
});

test('Parse npm package-lock.json with missing dependency', async (t) => {
    t.rejects(buildDepTreeFromFiles(
      `${__dirname}/fixtures/goof/`,
      'package.json',
      'package-lock_missing_dep.json',
    ), null, 'Error is thrown');
});
