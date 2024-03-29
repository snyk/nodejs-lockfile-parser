#!/usr/bin/env node_modules/.bin/ts-node
// Shebang is required, and file *has* to be executable: chmod +x file.test.js
// See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741
import { test } from 'tap';
import * as path from 'path';

import { load, readFixture } from '../utils';
import { buildDepTree, LockfileType } from '../../lib';

// buildDepTree
test(`buildDepTree from string pnpm-lock.yaml (pnpm7)`, async (t) => {
  // yarn 1 & 2 produce different dep trees
  // because yarn 2 now adds additional transitive required when compiling for example, node-gyp
  const expectedPath = path.join('pnpm-7', 'expected-tree.json');
  const expectedDepTree = load(expectedPath);

  const manifestFileContents = readFixture('pnpm-7/package.json');
  const lockFileContents = readFixture(`pnpm-7/pnpm-lock.yaml`);

  try {
    const depTree = await buildDepTree(
      manifestFileContents,
      lockFileContents,
      false,
      LockfileType.pnpm,
    );

    t.same(depTree, expectedDepTree, 'Tree generated as expected');
  } catch (err) {
    t.fail();
  }
});
