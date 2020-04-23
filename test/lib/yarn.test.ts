#!/usr/bin/env node_modules/.bin/ts-node
// Shebang is required, and file *has* to be executable: chmod +x file.test.js
// See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741
import * as fs from 'fs';
import * as path from 'path';
import * as _isEmpty from 'lodash.isempty';
import { test } from 'tap';
import { buildDepTreeFromFiles, LockfileType } from '../../lib';
import { config } from '../../lib/config';
import getRuntimeVersion from '../../lib/get-node-runtime-version';
import { InvalidUserInputError, OutOfSyncError } from '../../lib/errors';

function readFixture(filePath: string): string {
  return fs.readFileSync(`${__dirname}/fixtures/${filePath}`, 'utf8');
}

function load(filePath: string): any {
  try {
    const contents = readFixture(filePath);
    return JSON.parse(contents);
  } catch (e) {
    throw new Error('Could not find test fixture ' + filePath);
  }
}

for (const version of ['yarn1', 'yarn2']) {
  if (version === 'yarn2' && getRuntimeVersion() === 8) {
    continue; // yarn 2 does not support node 8 (but yarn 1 does)
  }

  test(`Parse yarn.lock (${version})`, async (t) => {
    // yarn 1 & 2 produce different dep trees
    // because yarn 2 now adds additional transitive required when compiling for example, node-gyp
    const expectedPath = path.join('goof', version, 'expected-tree.json');
    const expectedDepTree = load(expectedPath);

    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/goof/`,
      'package.json',
      `${version}/yarn.lock`,
    );

    t.same(depTree, expectedDepTree, 'Tree generated as expected');
  });

  test(`Parse yarn.lock with cyclic deps (${version})`, async (t) => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/cyclic-dep-simple/`,
      'package.json',
      `${version}/yarn.lock`,
    );

    t.strictEqual(
      depTree.dependencies!.debug.dependencies!.ms.dependencies!.debug.labels!
        .pruned,
      'cyclic',
      'Cyclic dependency is found correctly',
    );
  });

  test(`Parse yarn.lock with dev deps only (${version})`, async (t) => {
    const expectedPath = path.join(
      'dev-deps-only',
      version,
      'expected-tree.json',
    );
    const expectedDepTree = load(expectedPath);
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/dev-deps-only/`,
      'package.json',
      `${version}/yarn.lock`,
      true,
    );

    t.same(depTree, expectedDepTree, 'Tree is created with dev deps only');
  });

  test(`Parse yarn.lock with empty devDependencies (${version})`, async (t) => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/empty-dev-deps/`,
      'package.json',
      `${version}/yarn.lock`,
      true,
    );

    t.false(depTree.hasDevDependencies, "Package doesn't have devDependencies");
    t.ok(
      depTree.dependencies!['adm-zip'],
      'Dependencies are reported correctly',
    );
  });

  test(`Parse yarn.lock with devDependencies (${version})`, async (t) => {
    const expectedPath = path.join(
      'goof',
      version,
      'expected-tree-with-dev.json',
    );
    const expectedDepTree = load(expectedPath);

    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/goof/`,
      'package.json',
      `${version}/yarn.lock`,
      true,
    );

    t.same(depTree, expectedDepTree, 'Tree generated as expected');
  });

  test(`Parse yarn.lock with missing dependency (${version})`, async (t) => {
    const lockfileType =
      version === 'yarn1' ? LockfileType.yarn : LockfileType.yarn2;
    t.rejects(
      buildDepTreeFromFiles(
        `${__dirname}/fixtures/missing-deps-in-lock/`,
        'package.json',
        `${version}/yarn.lock`,
      ),
      new OutOfSyncError('uptime', lockfileType),
      'Error is thrown',
    );
  });

  test(`Parse yarn.lock with repeated dependency (${version})`, async (t) => {
    const expectedPath = path.join(
      'package-repeated-in-manifest',
      version,
      'expected-tree.json',
    );
    const expectedDepTree = load(expectedPath);

    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/package-repeated-in-manifest/`,
      'package.json',
      `${version}/yarn.lock`,
      false,
    );

    t.same(depTree, expectedDepTree, 'Tree generated as expected');
  });

  test(`Parse yarn.lock with missing package name (${version})`, async (t) => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/missing-name/`,
      'package.json',
      `${version}/yarn.lock`,
      true,
    );

    t.false(_isEmpty(depTree.dependencies));
    t.equals(depTree.name, 'package.json');
  });

  test(`Parse yarn.lock with empty dependencies and includeDev = false (${version})`, async (t) => {
    const expectedPath = path.join(
      'missing-deps',
      version,
      'expected-tree.json',
    );
    const expectedDepTree = load(expectedPath);

    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/missing-deps/`,
      'package.json',
      `${version}/yarn.lock`,
      false,
    );
    t.same(depTree, expectedDepTree, 'Tree is created with empty deps');
  });

  test(`Parse yarn.lock with empty dependencies and includeDev = true (${version})`, async (t) => {
    const expectedPath = path.join(
      'missing-deps',
      version,
      'expected-tree.json',
    );
    const expectedDepTree = load(expectedPath);
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/missing-deps/`,
      'package.json',
      `${version}/yarn.lock`,
      true,
    );
    t.same(depTree, expectedDepTree, 'Tree is created with empty deps');
  });

  test(`Parse with npm protocol (${version})`, async (t) => {
    const expectedPath = path.join(
      'npm-protocol',
      version,
      'expected-tree.json',
    );
    const expectedDepTree = load(expectedPath);

    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/npm-protocol/`,
      'package.json',
      `${version}/yarn.lock`,
    );

    t.same(depTree, expectedDepTree, 'Tree generated as expected');
  });

  test(`Parse invalid yarn.lock (${version})`, async (t) => {
    t.rejects(
      buildDepTreeFromFiles(
        `${__dirname}/fixtures/invalid-files/`,
        'package.json',
        // invalid lockfiles (no colons on eol)
        `${version}/yarn.lock`,
      ),
      new InvalidUserInputError('yarn.lock parsing failed with an error'),
      'Expected error is thrown',
    );
  });

  test(`Out of sync yarn.lock strict mode (${version})`, async (t) => {
    const lockfileType =
      version === 'yarn1' ? LockfileType.yarn : LockfileType.yarn2;
    t.rejects(
      buildDepTreeFromFiles(
        `${__dirname}/fixtures/out-of-sync/`,
        'package.json',
        `${version}/yarn.lock`,
      ),
      new OutOfSyncError('lodash', lockfileType),
    );
  });

  test(`Out of sync yarn.lock generates tree (${version})`, async (t) => {
    const expectedPath = path.join(
      'out-of-sync',
      version,
      'expected-tree.json',
    );
    const expectedDepTree = load(expectedPath);

    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/out-of-sync/`,
      'package.json',
      `${version}/yarn.lock`,
      false,
      false,
    );
    t.same(depTree, expectedDepTree, 'Tree generated as expected');
  });

  test(`'package.json' with file as version (${version})`, async (t) => {
    const expectedPath = path.join(
      'file-as-version',
      version,
      'expected-tree.json',
    );
    const expectedDepTree = load(expectedPath);

    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/file-as-version/`,
      'package.json',
      `${version}/yarn.lock`,
    );

    t.same(depTree, expectedDepTree, 'Tree generated as expected');
  });

  test(`Parse with 'git url' + 'ssh' (${version})`, async (t) => {
    const expectedPath = path.join(
      'git-ssh-url-deps',
      version,
      'expected-tree.json',
    );
    const expectedDepTree = load(expectedPath);

    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/git-ssh-url-deps/`,
      'package.json',
      `${version}/yarn.lock`,
    );

    t.same(depTree, expectedDepTree, 'Tree generated as expected');
  });

  test(`Parse with external tarball url (${version})`, async (t) => {
    const expectedPath = path.join(
      'external-tarball',
      version,
      'expected-tree.json',
    );
    const expectedDepTree = load(expectedPath);

    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/external-tarball/`,
      'package.json',
      `${version}/yarn.lock`,
    );

    t.same(depTree, expectedDepTree, 'Tree generated as expected');
  });

  test(`Yarn Tree size exceeds the allowed limit of 500 dependencies (${version})`, async (t) => {
    try {
      config.YARN_TREE_SIZE_LIMIT = 500;
      await buildDepTreeFromFiles(
        `${__dirname}/fixtures/goof/`,
        'package.json',
        `${version}/yarn.lock`,
      );
      t.fail('Expected TreeSizeLimitError to be thrown');
    } catch (err) {
      t.equals(err.constructor.name, 'TreeSizeLimitError');
    } finally {
      config.YARN_TREE_SIZE_LIMIT = 6.0e6;
    }
  });
}
