import {
  parseYarnLockV1Project,
  parseYarnLockV2Project,
} from '../../../lib/dep-graph-builders';
import { OutOfSyncError } from '../../../lib/errors';

// yarn.lock entries are keyed by the exact descriptor (name@range) they were
// resolved for, so a bumped range in package.json can never resolve to a stale
// locked version: the lookup simply finds no entry. That case already surfaces
// as an unresolved node (version = the declared range) or, in strict mode, an
// OutOfSyncError. The `unsatisfiedDeclaredRange` label is therefore
// deliberately not emitted for yarn.
describe('yarn: a stale package.json range is not reported as unsatisfiedDeclaredRange', () => {
  const pkgJson = JSON.stringify({
    name: 'yarn-range-mismatch',
    version: '1.0.0',
    dependencies: { 'left-pad': '^1.3.0' },
  });
  const options = (strictOutOfSync: boolean) =>
    ({
      includeDevDeps: true,
      includeOptionalDeps: true,
      pruneLevel: 'none',
      strictOutOfSync,
    }) as any;

  const yarnV1Lock = `# yarn lockfile v1

left-pad@^1.1.0:
  version "1.1.3"
  resolved "https://registry.yarnpkg.com/left-pad/-/left-pad-1.1.3.tgz#aaaa"
  integrity sha512-AAAA
`;

  const berryLock = `__metadata:
  version: 6

"left-pad@npm:^1.1.0":
  version: 1.1.3
  resolution: "left-pad@npm:1.1.3"
  checksum: aaaa
  languageName: node
  linkType: hard
`;

  const nodes = (depGraph: any) =>
    depGraph.toJSON().graph.nodes.filter((n) => n.nodeId !== 'root-node');

  it.each([
    ['yarn v1', parseYarnLockV1Project, yarnV1Lock],
    ['yarn berry (v2+)', parseYarnLockV2Project, berryLock],
  ])('%s', async (_name, parse: any, lock: string) => {
    const depGraph = await parse(pkgJson, lock, options(false));
    expect(depGraph.getDepPkgs()).toEqual([
      { name: 'left-pad', version: '^1.3.0' },
    ]);
    for (const node of nodes(depGraph)) {
      expect(node.info?.labels).not.toHaveProperty('unsatisfiedDeclaredRange');
    }
    await expect(parse(pkgJson, lock, options(true))).rejects.toThrow(
      OutOfSyncError,
    );
  });
});
