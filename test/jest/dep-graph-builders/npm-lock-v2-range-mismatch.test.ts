import { join } from 'path';
import { readFileSync } from 'fs';
import { DepGraph } from '@snyk/dep-graph';
import { parseNpmLockV2Project } from '../../../lib/dep-graph-builders';

const LABEL = 'unsatisfiedDeclaredRange';

const parseFixture = (
  fixture: string,
  opts: { includeDevDeps?: boolean; strictOutOfSync?: boolean } = {},
): Promise<DepGraph> => {
  const dir = join(__dirname, 'fixtures/npm-lock-v2', fixture);
  return parseNpmLockV2Project(
    readFileSync(join(dir, 'package.json'), 'utf8'),
    readFileSync(join(dir, 'package-lock.json'), 'utf8'),
    {
      includeDevDeps: opts.includeDevDeps ?? true,
      includeOptionalDeps: true,
      pruneCycles: true,
      strictOutOfSync: opts.strictOutOfSync ?? false,
    },
  );
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

describe('npm lockfile v2/v3: top-level lockfile/package.json range mismatch', () => {
  it('flags top-level deps whose locked version does not satisfy the declared range', async () => {
    const depGraph = await parseFixture('range-mismatch');
    expect(labelsByNode(depGraph)).toEqual({
      'stale-a@1.1.0': '^1.2.0',
      'stale-b@4.17.15': '~4.17.20',
      'stale-dev@2.9.0': '^3.0.0',
      'stale-opt@0.9.0': '^1.0.0',
    });
  });

  it('flags a top-level dep even when it was first reached transitively, without changing its other labels', async () => {
    const depGraph = await parseFixture('range-mismatch');
    const node = depGraph
      .toJSON()
      .graph.nodes.find((n) => n.nodeId === 'stale-b@4.17.15')!;
    expect(node.info?.labels).toEqual({
      scope: 'prod',
      [LABEL]: '~4.17.20',
    });
  });

  it('does not flag satisfied deps, prereleases within range, peers or transitive deps', async () => {
    const labels = labelsByNode(await parseFixture('range-mismatch'));
    expect(labels).not.toHaveProperty(['fresh-c@2.3.0']);
    expect(labels).not.toHaveProperty(['pre-d@1.0.0-beta.3']);
    expect(labels).not.toHaveProperty(['a-first@1.0.0']);
    expect(labels).not.toHaveProperty(['transitive-e@1.0.0']);
    expect(Object.keys(labels).some((k) => k.startsWith('stale-peer'))).toBe(
      false,
    );
  });

  it('does not flag dev deps when dev deps are excluded', async () => {
    const labels = labelsByNode(
      await parseFixture('range-mismatch', { includeDevDeps: false }),
    );
    expect(Object.keys(labels).sort()).toEqual([
      'stale-a@1.1.0',
      'stale-b@4.17.15',
      'stale-opt@0.9.0',
    ]);
  });

  it('does not throw in strict mode and leaves graph structure untouched', async () => {
    const strict = await parseFixture('range-mismatch', {
      strictOutOfSync: true,
    });
    const lax = await parseFixture('range-mismatch');
    expect(strict.toJSON()).toEqual(lax.toJSON());
    // Everything apart from the new label is identical to a graph without it.
    const stripped = JSON.parse(JSON.stringify(lax.toJSON()));
    for (const n of stripped.graph.nodes) {
      delete n.info?.labels?.[LABEL];
    }
    expect(stripped.pkgs).toEqual(lax.toJSON().pkgs);
    expect(stripped.graph.nodes.map((n) => n.nodeId)).toEqual(
      lax.toJSON().graph.nodes.map((n) => n.nodeId),
    );
  });

  it('skips file:, link:, git, url, workspace:, npm: alias, dist-tag, * , empty and unparseable specs', async () => {
    const depGraph = await parseFixture('range-mismatch-skipped');
    expect(labelsByNode(depGraph)).toEqual({});
    // sanity: the deps are actually in the graph, i.e. we are not passing vacuously
    expect(depGraph.getDepPkgs().map((p) => p.name)).toEqual(
      expect.arrayContaining(['file-dep', 'tag-dep', 'star-dep', 'git-dep']),
    );
  });
});
