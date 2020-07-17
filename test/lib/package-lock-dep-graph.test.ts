#!/usr/bin/env node_modules/.bin/ts-node
// Shebang is required, and file *has* to be executable: chmod +x file.test.js
// See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741
import { test } from 'tap';
import * as _isEmpty from 'lodash.isempty';
import { createFromJSON } from '@snyk/dep-graph';

// import {
//   InvalidUserInputError,
//   OutOfSyncError,
//   TreeSizeLimitError,
// } from '../../lib/errors';
import { load } from '../utils';
// import { config } from '../../lib/config';
import { buildDepGraphFromFiles, LockfileType } from '../../lib';

test('simple-test', async (t) => {
  const expectedJSON = load('simple-test/expected-dep-graph.json');
  const expected = createFromJSON(expectedJSON);

  const actual = await buildDepGraphFromFiles(
    `${__dirname}/fixtures/goof/`,
    'package.json',
    'package-lock.json',
    true,
  );

  const equal = actual.equals(expected);
  // if(!equal) {
  //   console.log(JSON.stringify(actual.toJSON(), null, 2));
  //   console.log(JSON.stringify(expected.toJSON(), null, 2));
  // }
  t.ok(equal, 'expected dep-graph');
});

// test('Parse npm package-lock.json with no dev dependencies', async (t) => {
//   const expectedDepGraph = load('goof/dep-graph-no-dev-deps.json');

//   const depGraph = await buildDepGraphFromFiles(
//     `${__dirname}/fixtures/goof/`,
//     'package.json',
//     'package-lock.json',
//   );

//   t.deepEqual(depGraph, expectedDepGraph, 'expected dep-graph');
// });

// test('Parse npm package-lock.json with devDependencies', async (t) => {
//   const expectedDepTree = load('goof/dep-tree-with-dev-deps.json');

//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/goof/`,
//     'package.json',
//     'package-lock.json',
//     true,
//   );

//   t.deepEqual(depTree, expectedDepTree, 'Tree generated as expected');
// });

// test('Parse npm package.json with empty devDependencies', async (t) => {
//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/empty-dev-deps/`,
//     'package.json',
//     'package-lock.json',
//     true,
//   );

//   t.false(depTree.hasDevDependencies, "Package doesn't have devDependencies");
//   t.ok(depTree.dependencies!['adm-zip'], 'Dependencies are reported correctly');
// });

// test('Parse npm package-lock.json with missing dependency', async (t) => {
//   t.rejects(
//     buildDepTreeFromFiles(
//       `${__dirname}/fixtures/missing-deps-in-lock/`,
//       'package.json',
//       'package-lock.json',
//     ),
//     new OutOfSyncError('uptime', LockfileType.npm),
//     'Error is thrown',
//   );
// });

// test('Parse npm package-lock.json with repeated dependency', async (t) => {
//   const expectedDepTree = load(
//     'package-repeated-in-manifest/expected-tree.json',
//   );

//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/package-repeated-in-manifest/`,
//     'package.json',
//     'package-lock.json',
//     false,
//   );

//   t.deepEqual(depTree, expectedDepTree, 'Tree generated as expected');
// });

// test('Parse npm package-lock.json with missing package name', async (t) => {
//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/missing-name/`,
//     'package.json',
//     'package-lock.json',
//     true,
//   );

//   t.false(_isEmpty(depTree.dependencies));
//   t.equals(depTree.name, 'package.json');
// });

// test('Parse npm package-lock.json with empty dependencies and includeDev = false', async (t) => {
//   const expectedDepTree = load('missing-deps/expected-tree.json');
//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/missing-deps/`,
//     'package.json',
//     'package-lock.json',
//     false,
//   );
//   t.deepEqual(depTree, expectedDepTree, 'Tree is created with empty deps');
// });

// test('Parse npm package-lock.json with empty dependencies and includeDev = true', async (t) => {
//   const expectedDepTree = load('missing-deps/expected-tree.json');
//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/missing-deps/`,
//     'package.json',
//     'package-lock.json',
//     true,
//   );
//   t.deepEqual(depTree, expectedDepTree, 'Tree is created with empty deps');
// });

// test('Parse npm package-lock.json with dev deps only', async (t) => {
//   const expectedDepTree = load('dev-deps-only/expected-tree.json');
//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/dev-deps-only/`,
//     'package.json',
//     'package-lock.json',
//     true,
//   );
//   t.deepEqual(depTree, expectedDepTree, 'Tree is created with dev deps only');
// });

// test('Parse npm simple package-lock.json dev and prod deps', async (t) => {
//   const expectedDepTree = load('simple-test/expected-tree.json');
//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/simple-test/`,
//     'package.json',
//     'package-lock.json',
//     true,
//   );

//   t.deepEqual(
//     depTree,
//     expectedDepTree,
//     'Tree is created with dev and prod deps',
//   );
// });

// test('Parse npm package-lock.json with dev deps only', async (t) => {
//   const expectedDepTreeEmpty = load('dev-deps-only/expected-tree-empty.json');
//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/dev-deps-only/`,
//     'package.json',
//     'package-lock.json',
//     false,
//   );
//   t.deepEqual(depTree, expectedDepTreeEmpty, 'Tree is created empty');
// });

// test('Parse npm package-lock.json with cyclic deps', async (t) => {
//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/cyclic-dep-simple/`,
//     'package.json',
//     'package-lock.json',
//   );
//   t.strictEqual(
//     depTree.dependencies!.debug.dependencies!.ms.dependencies!.debug.labels!
//       .pruned,
//     'cyclic',
//     'Cyclic label is set',
//   );
// });

// test('Parse npm package-lock.json with self-reference cyclic deps', async (t) => {
//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/cyclic-dep-self-reference/`,
//     'package.json',
//     'package-lock.json',
//   );
//   t.ok(depTree.dependencies, 'Tree is created');
// });

// test('Performance: Parse big npm package-lock.json with cyclic deps and dev-deps', async (t) => {
//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/cyclic-dep/`,
//     'package.json',
//     'package-lock.json',
//     true,
//   );
//   t.deepEqual(depTree.name, 'trucolor', 'Tree is created correctly');
// });

// test('Parse invalid npm package-lock.json', async (t) => {
//   t.rejects(
//     buildDepTreeFromFiles(
//       `${__dirname}/fixtures/invalid-files/`,
//       'package.json',
//       'package-lock.json',
//     ),
//     new InvalidUserInputError('package-lock.json parsing failed with error'),
//     'Expected error is thrown',
//   );
// });

// test('Parse invalid package.json', async (t) => {
//   t.rejects(
//     buildDepTreeFromFiles(
//       `${__dirname}/fixtures/invalid-files/`,
//       'package.json_invalid',
//       'package-lock.json',
//     ),
//     new InvalidUserInputError('package.json parsing failed with error'),
//     'Expected error is thrown',
//   );
// });

// test('Small Out of sync project package-lock.json generates tree', async (t) => {
//   const expectedDepTree = load('out-of-sync-tree/expected-tree.json');

//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/out-of-sync-tree/`,
//     'package.json',
//     'package-lock.json',
//     false,
//     false,
//   );
//   t.deepEqual(depTree, expectedDepTree, 'Tree generated as expected');
// });

// test('Out of sync package-lock.json strict', async (t) => {
//   t.rejects(
//     buildDepTreeFromFiles(
//       `${__dirname}/fixtures/out-of-sync/`,
//       'package.json',
//       'package-lock.json',
//     ),
//     new OutOfSyncError('lodash', LockfileType.npm),
//   );
// });

// test('Out of sync package-lock.json generates tree', async (t) => {
//   const expectedDepTree = load('out-of-sync/expected-tree.json');
//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/out-of-sync/`,
//     'package.json',
//     'package-lock.json',
//     false,
//     false,
//   );
//   t.deepEqual(depTree, expectedDepTree, 'Tree generated as expected');
// });

// test('`package.json` with file as version', async (t) => {
//   const expectedDepTree = load('file-as-version/expected-tree.json');

//   const depTree = await buildDepTreeFromFiles(
//     `${__dirname}/fixtures/file-as-version/`,
//     'package.json',
//     'package-lock.json',
//   );

//   t.deepEqual(depTree, expectedDepTree, 'Tree generated as expected');
// });

// test('Npm Tree size exceeds the allowed limit of 500 dependencies.', async (t) => {
//   config.NPM_TREE_SIZE_LIMIT = 500;
//   t.rejects(
//     buildDepTreeFromFiles(
//       `${__dirname}/fixtures/goof/`,
//       'package.json',
//       'package-lock.json',
//     ),
//     new TreeSizeLimitError(),
//     'Expected error is thrown',
//   );
// });
