#!/usr/bin/env node_modules/.bin/ts-node
// Shebang is required, and file *has* to be executable: chmod +x file.test.js
// See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741
import { test } from 'tap';

import { readFixture } from '../utils';
import { parseYarnLockV1 } from '../../lib/dep-graph-builders/yarn-lock-v1';

// buildDepTree
test(`buildDepTree from string yarn.lock (yarn1)`, async (t) => {
  // yarn 1 & 2 produce different dep trees
  // because yarn 2 now adds additional transitive required when compiling for example, node-gyp

  const manifestFileContents = readFixture('oom/package.json');
  const lockFileContents = readFixture(`oom/yarn.lock`);

  try {
    const depGraph = parseYarnLockV1(manifestFileContents, lockFileContents);

    t.ok(depGraph, 'Tree generated as expected');
  } catch (err) {
    console.log(err);
    t.fail();
  }
});
