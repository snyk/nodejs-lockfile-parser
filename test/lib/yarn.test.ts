#!/usr/bin/env node_modules/.bin/ts-node
// Shebang is required, and file *has* to be executable: chmod +x file.test.js
// See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741
import { test } from 'tap';
import * as path from 'path';

import { load, readFixture } from '../utils';
import { config } from '../../lib/config';
import { buildDepTreeFromFiles, buildDepTree, LockfileType } from '../../lib';
import { InvalidUserInputError, OutOfSyncError } from '../../lib/errors';

const SCENARIOS_WITH_FILES = [
  {
    name: 'Parse yarn.lock',
    workspace: 'goof',
    includeDev: false,
  },
  {
    name: 'Parse yarn.lock with dev deps only',
    workspace: 'dev-deps-only',
    includeDev: true,
  },
  {
    name: 'Parse yarn.lock with devDependencies',
    workspace: 'goof',
    includeDev: true,
  },
  {
    name: 'Parse yarn.lock with repeated dependency',
    workspace: 'package-repeated-in-manifest',
    includeDev: false,
  },
  {
    name: 'Parse yarn.lock with empty dependencies and includeDev = false',
    workspace: 'missing-deps',
    includeDev: false,
  },
  {
    name: 'Parse yarn.lock with empty dependencies and includeDev = true',
    workspace: 'missing-deps',
    includeDev: true,
  },
  {
    name: 'Parse with npm protocol',
    workspace: 'npm-protocol',
    includeDev: false,
  },
  {
    name: 'Out of sync yarn.lock generates tree',
    workspace: 'out-of-sync',
    includeDev: false,
    strict: false,
  },
  {
    name: "'package.json' with file as version",
    workspace: 'file-as-version',
    includeDev: false,
  },
  {
    name: "Parse with 'git url' + 'ssh'",
    workspace: 'git-ssh-url-deps',
    includeDev: false,
  },
  {
    name: 'Parse with external tarball url',
    workspace: 'external-tarball',
    includeDev: false,
  },
  {
    name: 'Parse yarn.lock with empty devDependencies',
    workspace: 'empty-dev-deps',
    includeDev: true,
  },
  {
    name: 'Parse yarn.lock with cyclic deps',
    workspace: 'cyclic-dep-simple',
    includeDev: false,
  },
  {
    name: 'Parse yarn.lock with missing package name',
    workspace: 'missing-name',
    includeDev: false,
  },
];

const SCENARIOS_REJECTED = [
  {
    name: 'Parse yarn.lock with missing dependency',
    workspace: 'missing-deps-in-lock',
    expectedError: new OutOfSyncError('uptime', LockfileType.yarn),
  },
  {
    name: 'Parse invalid yarn.lock',
    workspace: 'invalid-files', // invalid lockfiles (no colons on eol)
    expectedError: new InvalidUserInputError(
      'yarn.lock parsing failed with an error',
    ),
  },
  {
    name: 'Out of sync yarn.lock strict mode',
    workspace: 'out-of-sync',
    expectedError: new OutOfSyncError('lodash', LockfileType.yarn),
  },
];

for (const scenario of SCENARIOS_WITH_FILES) {
  test(`${scenario.name} (yarn1)`, async (t) => {
    // yarn 1 & 2 produce different dep trees
    // because yarn 2 now adds additional transitive required when compiling for example, node-gyp
    const expectedPath = path.join(
      scenario.workspace,
      'yarn1',
      `expected-tree${scenario.includeDev ? '-with-dev' : ''}.json`,
    );
    const expectedDepTree = load(expectedPath);
    try {
      const depTree = await buildDepTreeFromFiles(
        `${__dirname}/../fixtures/${scenario.workspace}/`,
        'package.json',
        `yarn1/yarn.lock`,
        scenario.includeDev,
        scenario.strict,
      );

      t.same(depTree, expectedDepTree, 'Tree generated as expected');
    } catch (err) {
      const error = err as Error;
      t.fail(error);
    }
  });
}

for (const scenario of SCENARIOS_REJECTED) {
  test(`${scenario.name} (yarn1)`, async (t) => {
    const expectedError = scenario.expectedError;
    t.rejects(
      buildDepTreeFromFiles(
        `${__dirname}/../fixtures/${scenario.workspace}/`,
        'package.json',
        `yarn1/yarn.lock`,
      ),
      expectedError,
      'Error is thrown',
    );
  });
}

// buildDepTree
test(`buildDepTree from string yarn.lock (yarn1)`, async (t) => {
  // yarn 1 & 2 produce different dep trees
  // because yarn 2 now adds additional transitive required when compiling for example, node-gyp
  const expectedPath = path.join('goof', 'yarn1', 'expected-tree.json');
  const expectedDepTree = load(expectedPath);

  const manifestFileContents = readFixture('goof/package.json');
  const lockFileContents = readFixture(`goof/yarn1/yarn.lock`);

  try {
    const depTree = await buildDepTree(
      manifestFileContents,
      lockFileContents,
      false,
      LockfileType.yarn,
    );

    t.same(depTree, expectedDepTree, 'Tree generated as expected');
  } catch (err) {
    t.fail();
  }
});

// special case
test(`Yarn Tree size exceeds the allowed limit of 500 dependencies (yarn1)`, async (t) => {
  try {
    config.YARN_TREE_SIZE_LIMIT = 500;
    await buildDepTreeFromFiles(
      `${__dirname}/../fixtures/goof/`,
      'package.json',
      `yarn1/yarn.lock`,
    );
    t.fail('Expected TreeSizeLimitError to be thrown');
  } catch (err) {
    const error = err as Error;
    t.equals(error.constructor.name, 'TreeSizeLimitError');
  } finally {
    config.YARN_TREE_SIZE_LIMIT = 6.0e6;
  }
});
