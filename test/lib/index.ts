#!/usr/bin/env node_modules/.bin/ts-node
// Shebang is required, and file *has* to be executable: chmod +x file.test.js
// See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741
// tslint:disable:max-line-length
// tslint:disable:object-literal-key-quotes
import {test} from 'tap';
import {buildDepTreeFromFiles} from '../../lib';
import * as fs from 'fs';
import * as _ from 'lodash';

const load = (filename) => JSON.parse(
  fs.readFileSync(`${__dirname}/fixtures/${filename}`, 'utf8'),
);

test('Parse npm package-lock.json', async (t) => {
  const expectedDepTree = load('goof/dep-tree-no-dev-deps.json');

  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/goof/`,
    'package.json',
    'package-lock.json',
  );

  t.deepEqual(depTree, expectedDepTree, 'Tree generated as expected');
});

test('Parse npm package-lock.json with devDependencies', async (t) => {
  const expectedDepTree = load('goof/dep-tree-with-dev-deps.json');

  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/goof/`,
    'package.json',
    'package-lock.json',
    true,
  );

  t.deepEqual(depTree, expectedDepTree, 'Tree generated as expected');
});

test('Parse npm package-lock.json with devDependencies', async (t) => {
  const expectedDepTree = load('goof/dep-tree-with-dev-deps.json');

  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/goof/`,
    'package.json',
    'package-lock.json',
    true,
  );

  t.deepEqual(depTree, expectedDepTree, 'Tree generated as expected');
});

test('Parse npm package.json with empty devDependencies', async (t) => {
  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/empty-dev-deps/`,
    'package.json',
    'package-lock.json',
    true,
  );

  t.false(depTree.hasDevDependencies, 'Package doesn\'t have devDependencies');
  t.ok(depTree.dependencies['adm-zip'], 'Dependencies are reported correctly');
});

test('Parse npm package-lock.json with missing dependency', async (t) => {
    t.rejects(buildDepTreeFromFiles(
      `${__dirname}/fixtures/goof/`,
      'package.json',
      'package-lock_missing_dep.json',
    ), null, 'Error is thrown');
});

test('Parse npm package-lock.json with repeated dependency', async (t) => {
  const expectedDepTree = load('package-repeated-in-manifest/expected-tree.json');

  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/package-repeated-in-manifest/`,
    'package.json',
    'package-lock.json',
    false,
  );

  t.deepEqual(depTree, expectedDepTree, 'Tree generated as expected');
});

test('Parse npm package-lock.json with missing package name', async (t) => {
  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/missing-name/`,
    'package.json',
    'package-lock.json',
    true,
  );

  t.false(_.isEmpty(depTree.dependencies));
  t.equals(depTree.name, undefined);
});

test('Parse npm package-lock.json with empty dependencies and includeDev = false', async (t) => {
  const expectedDepTree = load('missing-deps/expected-tree.json');
  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/missing-deps/`,
    'package.json',
    'package-lock.json',
    false,
  );
  t.deepEqual(depTree, expectedDepTree, 'Tree is created with empty deps');
});

test('Parse npm package-lock.json with empty dependencies and includeDev = false', async (t) => {
  const expectedDepTree = load('missing-deps/expected-tree.json');
  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/missing-deps/`,
    'package.json',
    'package-lock.json',
    true,
  );
  t.deepEqual(depTree, expectedDepTree, 'Tree is created with empty deps');
});

test('Parse npm package-lock.json with dev deps only', async (t) => {
  const expectedDepTree = load('dev-deps-only/expected-tree.json');
  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/dev-deps-only/`,
    'package.json',
    'package-lock.json',
    true,
  );
  t.deepEqual(depTree, expectedDepTree, 'Tree is created with dev deps only');
});

test('Parse npm package-lock.json with cyclic deps', async (t) => {
  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/cyclic-dep-simple/`,
    'package.json',
    'package-lock.json',
  );
  t.strictEqual(depTree.dependencies.debug.dependencies.ms.dependencies.debug.cyclic, true, 'Cyclic dependency is found correctly');
});

test('Performance: Parse big npm package-lock.json with cyclic deps and dev-deps', async (t) => {
  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/cyclic-dep/`,
    'package.json',
    'package-lock.json',
    true,
  );
  t.deepEqual(depTree.name, 'trucolor', 'Tree is created correctly');
});

test('Parse yarn yarn.lock', async (t) => {
  const expectedDepTree = load('goof/dep-tree-no-dev-deps-yarn.json');

  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/goof/`,
    'package.json',
    'yarn.lock',
  );

  t.deepEqual(depTree, expectedDepTree, 'Tree generated as expected');
});
