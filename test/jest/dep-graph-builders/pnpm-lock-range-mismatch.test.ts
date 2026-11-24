import { join } from 'path';
import { readFileSync } from 'fs';
import { DepGraph } from '@snyk/dep-graph';
import {
  parsePnpmProject,
  parsePnpmWorkspace,
} from '../../../lib/dep-graph-builders';

const LABEL = 'unsatisfiedDeclaredRange';

const readFixture = (lockDir: string, fixture: string) => {
  const dir = join(__dirname, 'fixtures', lockDir, fixture);
  return {
    pkgJson: readFileSync(join(dir, 'package.json'), 'utf8'),
    lock: readFileSync(join(dir, 'pnpm-lock.yaml'), 'utf8'),
  };
};

const parseFixture = (
  lockDir: string,
  fixture: string,
  opts: {
    includeDevDeps?: boolean;
    includePeerDeps?: boolean;
    pruneWithinTopLevelDeps?: boolean;
    strictOutOfSync?: boolean;
  } = {},
): Promise<DepGraph> => {
  const { pkgJson, lock } = readFixture(lockDir, fixture);
  return parsePnpmProject(pkgJson, lock, {
    includeDevDeps: opts.includeDevDeps ?? true,
    includePeerDeps: opts.includePeerDeps ?? false,
    includeOptionalDeps: true,
    pruneWithinTopLevelDeps: opts.pruneWithinTopLevelDeps ?? false,
    strictOutOfSync: opts.strictOutOfSync ?? false,
  });
};

const labelsByNode = (depGraph: DepGraph): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const node of depGraph.toJSON().graph.nodes) {
    const value = node.info?.labels?.[LABEL];
    if (value !== undefined) {
      out[node.nodeId] = value;
    }
  }
  return out;
};

describe.each(['pnpm-lock-v5', 'pnpm-lock-v6', 'pnpm-lock-v9'])(
  'pnpm %s: top-level lockfile/package.json range mismatch',
  (lockDir) => {
    it('flags top-level deps whose locked version does not satisfy the declared range', async () => {
      const depGraph = await parseFixture(lockDir, 'range-mismatch');
      expect(labelsByNode(depGraph)).toEqual({
        'stale-a@1.1.0': '^1.2.0',
        'stale-b@4.17.15': '~4.17.20',
        'stale-dev@2.9.0': '^3.0.0',
        // locked version carries a transitive peer suffix in the lockfile
        'stale-e@2.0.0': '^3.0.0',
      });
    });

    it('keeps the flag when the dep is first reached transitively, without changing its other labels', async () => {
      for (const prune of [false, true]) {
        const depGraph = await parseFixture(lockDir, 'range-mismatch', {
          pruneWithinTopLevelDeps: prune,
        });
        const node = depGraph
          .toJSON()
          .graph.nodes.find((n) => n.nodeId === 'stale-b@4.17.15');
        expect(node?.info?.labels).toEqual({
          scope: 'prod',
          [LABEL]: '~4.17.20',
        });
      }
    });

    it('does not flag satisfied, prerelease-in-range, overridden or peer-only deps', async () => {
      const labels = labelsByNode(
        await parseFixture(lockDir, 'range-mismatch', {
          includePeerDeps: true,
        }),
      );
      expect(Object.keys(labels)).not.toContain('fresh-c@2.3.0');
      expect(Object.keys(labels)).not.toContain('pre-d@1.0.0-beta.3');
      expect(Object.keys(labels)).not.toContain('a-first@1.0.0');
      expect(Object.keys(labels)).not.toContain('override-o@0.9.0');
      expect(Object.keys(labels)).not.toContain('peer-p@4.0.0');
    });

    it('does not flag dev deps when dev deps are excluded', async () => {
      const labels = labelsByNode(
        await parseFixture(lockDir, 'range-mismatch', {
          includeDevDeps: false,
        }),
      );
      expect(Object.keys(labels).sort()).toEqual([
        'stale-a@1.1.0',
        'stale-b@4.17.15',
        'stale-e@2.0.0',
      ]);
    });

    it('does not throw in strict mode and leaves graph structure untouched', async () => {
      const strict = await parseFixture(lockDir, 'range-mismatch', {
        strictOutOfSync: true,
      });
      const lax = await parseFixture(lockDir, 'range-mismatch');
      expect(strict.toJSON()).toEqual(lax.toJSON());
      const stripped = JSON.parse(JSON.stringify(lax.toJSON()));
      for (const n of stripped.graph.nodes) {
        delete n.info?.labels?.[LABEL];
      }
      expect(stripped.pkgs).toEqual(lax.toJSON().pkgs);
    });

    it('skips file:, link:, url, git, workspace:, catalog:, npm: alias, dist-tag, *, x, unparseable specs, lockfile-level overrides and multi-section conflicting ranges', async () => {
      const depGraph = await parseFixture(lockDir, 'range-mismatch-skipped');
      expect(labelsByNode(depGraph)).toEqual({});
      // sanity: the deps are actually in the graph, i.e. we are not passing vacuously
      expect(depGraph.getDepPkgs().map((p) => p.name)).toEqual(
        expect.arrayContaining([
          'tag-dep',
          'star-dep',
          'x-dep',
          'cat-dep',
          'lockfile-override-dep',
          'conflict-dep',
        ]),
      );
    });

    it('does not flag a workspace sibling resolved via link:, even if its version differs from the declared range, but flags a registry dep', async () => {
      const result = await parsePnpmWorkspace(
        __dirname,
        join(__dirname, 'fixtures', lockDir, 'range-mismatch-workspace'),
        {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneWithinTopLevelDeps: true,
          strictOutOfSync: false,
        },
      );
      const pkgA = result.find((r) =>
        r.targetFile
          .replace(/\\/g, '/')
          .endsWith('packages/pkg-a/package.json'),
      );
      if (!pkgA) {
        throw new Error('pkg-a not found in workspace result');
      }
      expect(
        pkgA.depGraph.getDepPkgs().map((p) => `${p.name}@${p.version}`),
      ).toEqual(expect.arrayContaining(['pkg-b@2.0.0', 'stale-a@1.1.0']));
      expect(labelsByNode(pkgA.depGraph)).toEqual({
        'stale-a@1.1.0': '^1.2.0',
      });
    });
  },
);
