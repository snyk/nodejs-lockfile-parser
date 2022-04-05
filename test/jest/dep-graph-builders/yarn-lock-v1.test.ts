import { join } from 'path';
import { readFileSync } from 'fs';
import { legacy } from '@snyk/dep-graph';

import { parseYarnLockV1 } from '../../../lib/dep-graph-builders';
import { buildDepTree, LockfileType } from '../../../lib/';

describe('dep-graph-builder yarn-lock-v1', () => {
  describe.each(['one-dep'])('project: %s', (fixtureName) => {
    test('regression against tree build', async () => {
      const pkgJsonContent = readFileSync(
        join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/package.json`),
        'utf8',
      );

      const yarnLockContent = readFileSync(
        join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/yarn.lock`),
        'utf8',
      );
      const newDepGraph = parseYarnLockV1(pkgJsonContent, yarnLockContent);
      const oldDepTree = await buildDepTree(
        pkgJsonContent,
        yarnLockContent,
        undefined,
        LockfileType.yarn,
      );
      const oldDepGraph = await legacy.depTreeToGraph(oldDepTree, 'yarn');
      expect(newDepGraph.equals(oldDepGraph)).toBeTruthy();
    });
  });
});
