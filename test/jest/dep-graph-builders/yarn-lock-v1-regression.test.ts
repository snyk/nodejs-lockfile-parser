import { join } from 'path';
import { readFileSync } from 'fs';
import { legacy } from '@snyk/dep-graph';

import {
  parseYarnLockV1Project,
  buildDepTree,
  LockfileType,
} from '../../../lib';

describe('dep-graph-builder yarn-lock-v1', () => {
  describe.each([
    'one-dep',
    'cyclic-dep',
    'cyclic-dep-simple',
    'goof',
    'external-tarball',
  ])('project: %s [non-workspace]', (fixtureName) => {
    test('regression against tree build', async () => {
      const pkgJsonContent = readFileSync(
        join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/package.json`),
        'utf8',
      );

      const yarnLockContent = readFileSync(
        join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/yarn.lock`),
        'utf8',
      );
      const newDepGraph = await parseYarnLockV1Project(
        pkgJsonContent,
        yarnLockContent,
      );
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
