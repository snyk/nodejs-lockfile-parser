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
  {
    name: 'Parse yarn.lock with resolutions',
    workspace: 'resolutions',
    includeDev: false,
    strict: false,
  },
];

const SCENARIOS_REJECTED = [
  {
    name: 'Parse yarn.lock with missing dependency',
    workspace: 'missing-deps-in-lock',
    expectedError: new OutOfSyncError('uptime', LockfileType.yarn),
    expectedErrorYarn2: new OutOfSyncError('uptime', LockfileType.yarn2),
  },
  {
    name: 'Parse invalid yarn.lock',
    workspace: 'invalid-files', // invalid lockfiles (no colons on eol)
    expectedError: new InvalidUserInputError(
      'yarn.lock parsing failed with an error',
    ),
    expectedErrorYarn2: new InvalidUserInputError(
      'yarn.lock parsing failed with an error',
    ),
  },
  {
    name: 'Out of sync yarn.lock strict mode',
    workspace: 'out-of-sync',
    expectedError: new OutOfSyncError('lodash', LockfileType.yarn),
    expectedErrorYarn2: new OutOfSyncError('lodash', LockfileType.yarn2),
  },
];

for (const version of ['yarn1', 'yarn2'] as const) {
  for (const scenario of SCENARIOS_WITH_FILES) {
    test(`${scenario.name} (${version})`, async (t) => {
      // yarn 1 & 2 produce different dep trees
      // because yarn 2 now adds additional transitive required when compiling for example, node-gyp
      const expectedPath = path.join(
        scenario.workspace,
        version,
        `expected-tree${scenario.includeDev ? '-with-dev' : ''}.json`,
      );
      const expectedDepTree = load(expectedPath);
      try {
        const depTree = await buildDepTreeFromFiles(
          `${__dirname}/fixtures/${scenario.workspace}/`,
          'package.json',
          `${version}/yarn.lock`,
          scenario.includeDev,
          scenario.strict,
        );

        t.same(depTree, expectedDepTree, 'Tree generated as expected');
      } catch (err) {
        t.fail(err);
      }
    });
  }

  for (const scenario of SCENARIOS_REJECTED) {
    test(`${scenario.name} (${version})`, async (t) => {
      const expectedError =
        version === 'yarn2'
          ? scenario.expectedErrorYarn2
          : scenario.expectedError;
      t.rejects(
        buildDepTreeFromFiles(
          `${__dirname}/fixtures/${scenario.workspace}/`,
          'package.json',
          `${version}/yarn.lock`,
        ),
        expectedError,
        'Error is thrown',
      );
    });
  }

  // buildDepTree
  test(`buildDepTree from string yarn.lock (${version})`, async (t) => {
    // yarn 1 & 2 produce different dep trees
    // because yarn 2 now adds additional transitive required when compiling for example, node-gyp
    const expectedPath = path.join('goof', version, 'expected-tree.json');
    const expectedDepTree = load(expectedPath);

    const manifestFileContents = readFixture('goof/package.json');
    const lockFileContents = readFixture(`goof/${version}/yarn.lock`);

    try {
      const depTree = await buildDepTree(
        manifestFileContents,
        lockFileContents,
        false,
        version === 'yarn2' ? LockfileType.yarn2 : LockfileType.yarn,
      );

      t.same(depTree, expectedDepTree, 'Tree generated as expected');
    } catch (err) {
      t.fail();
    }
  });

  // special case
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

// // Yarn v2 specific test
test('.yarnrc.yaml is missing, but still resolving to yarn2 version', async (t) => {
  const depTree = await buildDepTreeFromFiles(
    `${__dirname}/fixtures/missing-dot-yarnrc-yarn2/`,
    'package.json',
    `yarn.lock`,
  );

  t.equal(depTree.meta?.packageManagerVersion, '2', 'resolved to yarn v2');
});
