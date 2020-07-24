#!/usr/bin/env node_modules/.bin/ts-node
// Shebang is required, and file *has* to be executable: chmod +x file.test.js
// See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741
import { test } from 'tap';
import {
  InvalidUserInputError,
  OutOfSyncError,
} from '../../lib/errors';
import { loadDepGraph } from '../utils';
import { buildDepGraphFromFiles, LockfileType, buildDepTreeFromFiles } from '../../lib';
import { legacy, DepGraph } from '@snyk/dep-graph';
import * as fs from 'fs';

function testGraphs(t, actual: DepGraph, expected: DepGraph) {

  t.same(actual.rootPkg, expected.rootPkg, 'root pkg');
  t.same(actual.pkgManager, expected.pkgManager, 'pkgManager');
  t.equals(actual.getPkgs().length, expected.getPkgs().length, 'pkg count');

  const allPkgs = new Set([...expected.getDepPkgs(), ...actual.getDepPkgs()]);
  for (const pkg of allPkgs) {
    const a = actual.pkgPathsToRoot(pkg)
      .map(paths => paths.map((pkg) => `${pkg.name}@${pkg.version}`).join())
      .sort();
    const b = expected.pkgPathsToRoot(pkg)
      .map(paths => paths.map((pkg) => `${pkg.name}@${pkg.version}`).join())
      .sort();
    t.same(a,b,`count paths to root for ${pkg.name}@${pkg.version}`);
  }
  // for (const pkg of allPkgs) {
  //   t.same(
  //     actual.getPkgNodes(pkg),
  //     expected.getPkgNodes(pkg),
  //     `same nodes for ${pkg.name}@${pkg.version}`,
  //   );
  // }
  // tests above give more clues about the differences when not equal
  t.ok(actual.equals(expected), 'dep-graph equal');
}

// // test fixtures with and without dev dependencies
// const fixtures = [
//   'goof',
//   'package-repeated-in-manifest',
//   'missing-deps',
//   'dev-deps-only',
//   'simple-test',
//   'cyclic-dep-simple'
// ];

// for (const fixture of fixtures) {

//   test(fixture, async (t) => {
//     const expected = loadDepGraph(`${fixture}/expected-dep-graph.json`);

//     const actual = await buildDepGraphFromFiles(
//       `${__dirname}/fixtures/${fixture}/`,
//       'package.json',
//       'package-lock.json',
//     );

//     testGraphs(t, actual, expected);
//   });

//   test(`${fixture} with dev dependencies`, async (t) => {
//     const expected = loadDepGraph(`${fixture}/expected-dep-graph-with-dev.json`);

//     const actual = await buildDepGraphFromFiles(
//       `${__dirname}/fixtures/${fixture}/`,
//       'package.json',
//       'package-lock.json',
//       true,
//     );

//     testGraphs(t, actual, expected);
//   });
// }

// test('empty dev dependencies', async (t) => {
//   const expected = loadDepGraph('empty-dev-deps/expected-dep-graph.json');

//   const actual = await buildDepGraphFromFiles(
//     `${__dirname}/fixtures/empty-dev-deps/`,
//     'package.json',
//     'package-lock.json',
//     true,
//   );

//   for (const pkg of actual.getDepPkgs()) {
//     for (const node of actual.getPkgNodes(pkg)) {
//       t.notOk(node?.info?.labels?.scope === 'dev', 'no dev labels');
//     }
//   }

//   testGraphs(t, actual, expected);
// });

// test('missing name in manifest', async (t) => {
//   const expected = loadDepGraph('missing-name/expected-dep-graph.json');

//   const actual = await buildDepGraphFromFiles(
//     `${__dirname}/fixtures/missing-name/`,
//     'package.json',
//     'package-lock.json',
//   );

//   testGraphs(t, actual, expected);
// });

// test('cyclic-dep-self-reference', { skip: true }, async (t) => {
//   const expected = loadDepGraph('cyclic-dep-self-reference/expected-dep-graph.json');

//   const actual = await buildDepGraphFromFiles(
//     `${__dirname}/fixtures/cyclic-dep-self-reference/`,
//     'package.json',
//     'package-lock.json',
//   );

//   testGraphs(t, actual, expected);
// });

// test('cyclic-dep - with dev dependencies', { skip: true }, async (t) => {
//   const expected = loadDepGraph('cyclic-dep/expected-dep-graph.json');

//   const actual = await buildDepGraphFromFiles(
//     `${__dirname}/fixtures/cyclic-dep/`,
//     'package.json',
//     'package-lock.json',
//     true,
//   );

//   testGraphs(t, actual, expected);
// });

// test('invalid package-lock.json', async (t) => {
//   t.rejects(
//     buildDepGraphFromFiles(
//       `${__dirname}/fixtures/invalid-files/`,
//       'package.json',
//       'package-lock.json',
//     ),
//     new InvalidUserInputError('package-lock.json parsing failed with error'),
//     'Expected error is thrown',
//   );
// });

// test('invalid package.json', async (t) => {
//   t.rejects(
//     buildDepGraphFromFiles(
//       `${__dirname}/fixtures/invalid-files/`,
//       'package.json_invalid',
//       'package-lock.json',
//     ),
//     new InvalidUserInputError('package.json parsing failed with error'),
//     'Expected error is thrown',
//   );
// });

// test('out-of-sync-tree', async (t) => {
//   const expected = loadDepGraph('out-of-sync-tree/expected-dep-graph.json');

//   const actual = await buildDepGraphFromFiles(
//     `${__dirname}/fixtures/out-of-sync-tree/`,
//     'package.json',
//     'package-lock.json',
//     false,
//     false,
//   );

//   testGraphs(t, actual, expected);
// });

// test('out-of-sync-tree with dev dependencies', async (t) => {
//   const expected = loadDepGraph('out-of-sync-tree/expected-dep-graph-with-dev.json');

//   const actual = await buildDepGraphFromFiles(
//     `${__dirname}/fixtures/out-of-sync-tree/`,
//     'package.json',
//     'package-lock.json',
//     true,
//     false,
//   );

//   testGraphs(t, actual, expected);
// });

// test('missing-deps-in-lock - error when strict true', async (t) => {
//   t.rejects(
//     buildDepGraphFromFiles(
//       `${__dirname}/fixtures/missing-deps-in-lock/`,
//       'package.json',
//       'package-lock.json',
//     ),
//     new OutOfSyncError('uptime', LockfileType.npm),
//     'OutOfSyncError is thrown',
//   );
// });

// test('missing-deps-in-lock - missing labels when strict false', async (t) => {
//   const expected = loadDepGraph('missing-deps-in-lock/expected-dep-graph.json');

//   const actual = await buildDepGraphFromFiles(
//     `${__dirname}/fixtures/missing-deps-in-lock/`,
//     'package.json',
//     'package-lock.json',
//     true,
//     false,
//   );

//   testGraphs(t, actual, expected);
// });

// test('out-of-sync - error when strict true', async (t) => {
//   t.rejects(
//     buildDepGraphFromFiles(
//       `${__dirname}/fixtures/out-of-sync/`,
//       'package.json',
//       'package-lock.json',
//     ),
//     new OutOfSyncError('lodash', LockfileType.npm),
//   );
// });

// test('out-of-sync - missing labels when strict false', async (t) => {
//   const expected = loadDepGraph('out-of-sync/expected-dep-graph.json');

//   const actual = await buildDepGraphFromFiles(
//     `${__dirname}/fixtures/out-of-sync/`,
//     'package.json',
//     'package-lock.json',
//     true,
//     false,
//   );

//   testGraphs(t, actual, expected);
// });

// test('file-as-version', async (t) => {
//   const expected = loadDepGraph('file-as-version/expected-dep-graph.json');

//   const actual = await buildDepGraphFromFiles(
//     `${__dirname}/fixtures/file-as-version/`,
//     'package.json',
//     'package-lock.json',
//   );

//   testGraphs(t, actual, expected);
// });

test('trucolor', async (t) => {

  const tree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/trucolor/`,
    'package.json',
    'package-lock.json',
  );

  const expected = await legacy.depTreeToGraph(tree, 'npm');

  const actual = await buildDepGraphFromFiles(
    `${__dirname}/fixtures/trucolor/`,
    'package.json',
    'package-lock.json',
  );

  // const expected = loadDepGraph('cyclic-dep/expected-dep-graph.json');

  testGraphs(t, actual, expected);
});
