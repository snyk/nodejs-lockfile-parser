import { readFileSync } from 'fs';
import { join } from 'path';
import type { DepGraph } from '@snyk/dep-graph';
import {
  parsePnpmProject,
  parseYarnLockV1Project,
  parseYarnLockV2Project,
} from '../../../lib/dep-graph-builders';

// With strictOutOfSync off, a dependency that has no lockfile entry must carry the
// `missingLockFileEntry` label on its own node. The yarn berry, pnpm and non-cycle-pruned
// yarn v1 builders read the flag from the parent node instead, and a node with no lockfile
// entry never has children, so the label was never emitted.

const fixture = (...parts: string[]) =>
  readFileSync(join(__dirname, 'fixtures', ...parts), 'utf8');

const withExtraDep = (pkgJson: string, name: string, range: string) => {
  const parsed = JSON.parse(pkgJson);
  parsed.dependencies = { ...parsed.dependencies, [name]: range };
  return JSON.stringify(parsed);
};

const missingLabelled = (dg: DepGraph) =>
  dg
    .toJSON()
    .graph.nodes.filter((n) => n.info?.labels?.missingLockFileEntry === 'true')
    .map((n) => n.pkgId.replace(/^(@?[^@]+)@.*$/, '$1'));

const MISSING = 'not-in-lockfile';

describe('missingLockFileEntry label', () => {
  describe('yarn.lock v1', () => {
    const dir = [
      'yarn-lock-v1',
      'real',
      'simple-out-of-sync',
      'missing-top-level-deps',
    ];

    it.each(['cycles', 'withinTopLevelDeps'] as const)(
      'labels the deps missing from the lockfile (pruneLevel: %s)',
      async (pruneLevel) => {
        const dg = await parseYarnLockV1Project(
          fixture(...dir, 'package.json'),
          fixture(...dir, 'yarn.lock'),
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            includePeerDeps: false,
            pruneLevel,
            strictOutOfSync: false,
          },
        );
        expect(missingLabelled(dg).sort()).toEqual(['body-parser', 'lodash']);
      },
    );
  });

  describe('yarn.lock v2', () => {
    const dir = ['yarn-lock-v2', 'real', 'resolutions-simple'];

    it.each([false, true])(
      'labels a dep missing from the lockfile (pruneWithinTopLevelDeps: %s)',
      async (pruneWithinTopLevelDeps) => {
        const dg = await parseYarnLockV2Project(
          withExtraDep(fixture(...dir, 'package.json'), MISSING, '^1.0.0'),
          fixture(...dir, 'yarn.lock'),
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            strictOutOfSync: false,
            pruneWithinTopLevelDeps,
          },
        );
        expect(missingLabelled(dg)).toEqual([MISSING]);
      },
    );
  });

  describe('pnpm-lock v9', () => {
    const dir = ['pnpm-lock-v9', 'one-dep'];

    it.each([false, true])(
      'labels a dep missing from the lockfile (pruneWithinTopLevelDeps: %s)',
      async (pruneWithinTopLevelDeps) => {
        const dg = await parsePnpmProject(
          withExtraDep(fixture(...dir, 'package.json'), MISSING, '^1.0.0'),
          fixture(...dir, 'pnpm-lock.yaml'),
          {
            includeDevDeps: false,
            includeOptionalDeps: false,
            strictOutOfSync: false,
            pruneWithinTopLevelDeps,
          },
        );
        expect(missingLabelled(dg)).toEqual([MISSING]);
      },
    );
  });
});
