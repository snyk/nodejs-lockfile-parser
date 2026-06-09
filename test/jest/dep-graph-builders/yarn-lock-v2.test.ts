import { createFromJSON } from '@snyk/dep-graph';
import { readFileSync } from 'fs';
import { join } from 'path';
import { YarnLockV2ProjectParseOptions } from '../../../lib/dep-graph-builders/types';
import { parseYarnLockV2Project } from '../../../lib/dep-graph-builders/yarn-lock-v2/simple';
import { getYarnLockV2ChildNode } from '../../../lib/dep-graph-builders/yarn-lock-v2/utils';
import { PkgNode } from '../../../lib/dep-graph-builders/util';
import { LockfileType, OutOfSyncError } from '../../../lib';

describe('yarn.lock v2 "real" projects', () => {
  describe.each([
    'git-remote-url',
    'goof',
    'resolutions-simple',
    'resolutions-scoped',
    'out-of-sync-resolutions',
  ])('[simple tests] project: %s ', (fixtureName) => {
    test('matches expected - no pruning', async () => {
      const pkgJsonContent = readFileSync(
        join(
          __dirname,
          `./fixtures/yarn-lock-v2/real/${fixtureName}/package.json`,
        ),
        'utf8',
      );
      const yarnLockContent = readFileSync(
        join(
          __dirname,
          `./fixtures/yarn-lock-v2/real/${fixtureName}/yarn.lock`,
        ),
        'utf8',
      );
      const opts: YarnLockV2ProjectParseOptions = {
        includeDevDeps: false,
        includeOptionalDeps: true,
        strictOutOfSync: false,
        pruneWithinTopLevelDeps: false,
      };

      const dg = await parseYarnLockV2Project(
        pkgJsonContent,
        yarnLockContent,
        opts,
      );

      const expectedDepGraphJson = JSON.parse(
        readFileSync(
          join(
            __dirname,
            `./fixtures/yarn-lock-v2/real/${fixtureName}/expected.json`,
          ),
          'utf8',
        ),
      );

      expect(dg).toBeTruthy();

      const expectedDepGraph = createFromJSON(expectedDepGraphJson);
      expect(dg.equals(expectedDepGraph)).toBeTruthy();
    });
  });

  test('project: out-of-sync-resolutions -> throws OutOfSyncError', async () => {
    const fixtureName = 'out-of-sync-resolutions';
    const pkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/yarn-lock-v2/real/${fixtureName}/package.json`,
      ),
      'utf8',
    );
    const yarnLockContent = readFileSync(
      join(__dirname, `./fixtures/yarn-lock-v2/real/${fixtureName}/yarn.lock`),
      'utf8',
    );
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: true,
      strictOutOfSync: true,
      pruneWithinTopLevelDeps: false,
    };

    await expect(
      parseYarnLockV2Project(pkgJsonContent, yarnLockContent, opts),
    ).rejects.toThrow(new OutOfSyncError('ms@1.0.0', LockfileType.yarn2));
  });

  it('Workspace with resolutions', async () => {
    const rootPkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/yarn-lock-v2/real/resolutions-in-workspace/package.json`,
      ),
      'utf8',
    );
    const rootYarnLockContent = readFileSync(
      join(
        __dirname,
        `./fixtures/yarn-lock-v2/real/resolutions-in-workspace/yarn.lock`,
      ),
      'utf8',
    );
    const workspacePkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/yarn-lock-v2/real/resolutions-in-workspace/workspace1/package.json`,
      ),
      'utf8',
    );

    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: true,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };

    const dg = await parseYarnLockV2Project(
      workspacePkgJsonContent,
      rootYarnLockContent,
      opts,
      {
        isRoot: false,
        isWorkspacePkg: true,
        rootResolutions: JSON.parse(rootPkgJsonContent).resolutions || {},
      },
    );

    const expectedDepGraphJson = JSON.parse(
      readFileSync(
        join(
          __dirname,
          `./fixtures/yarn-lock-v2/real/resolutions-in-workspace/workspace1/expected-graph.json`,
        ),
        'utf8',
      ),
    );

    const expectedDepGraph = createFromJSON(expectedDepGraphJson);
    expect(dg.equals(expectedDepGraph)).toBeTruthy();
  });

  describe('Workspace with multiple resolutions for the same dependency', () => {
    const fixtureBasePath = join(
      __dirname,
      './fixtures/yarn-lock-v2/real/resolutions-multiple-versions-same-dependency',
    );

    const rootPkgJsonContent = readFileSync(
      join(fixtureBasePath, 'package.json'),
      'utf8',
    );
    const rootYarnLockContent = readFileSync(
      join(fixtureBasePath, 'yarn.lock'),
      'utf8',
    );

    const rootResolutions = JSON.parse(rootPkgJsonContent).resolutions || {};

    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: true,
      strictOutOfSync: true,
      pruneWithinTopLevelDeps: false,
    };

    const testCases = [
      {
        workspaceName: 'library-a',
        description: 'library-a with its specific dependencies and resolutions',
      },
      {
        workspaceName: 'library-b',
        description: 'library-b with its specific dependencies and resolutions',
      },
    ];

    test.each(testCases)(
      'correctly parses $workspaceName ($description)',
      async ({ workspaceName }) => {
        const workspacePkgJsonContent = readFileSync(
          join(fixtureBasePath, `libraries/${workspaceName}/package.json`),
          'utf8',
        );
        const expectedDepGraphJsonPath = join(
          fixtureBasePath,
          `libraries/${workspaceName}/expected-graph.json`,
        );
        const expectedDepGraphJson = JSON.parse(
          readFileSync(expectedDepGraphJsonPath, 'utf8'),
        );

        const dg = await parseYarnLockV2Project(
          workspacePkgJsonContent,
          rootYarnLockContent,
          opts,
          {
            isRoot: false,
            isWorkspacePkg: true,
            rootResolutions: rootResolutions,
          },
        );

        const expectedDepGraph = createFromJSON(expectedDepGraphJson);
        expect(dg.equals(expectedDepGraph)).toBeTruthy();
      },
    );
  });
});

const getHandRolledYarnLock = (fixture: string) => {
  return readFileSync(
    join(__dirname, `./fixtures/yarn-lock-v2/hand-rolled/${fixture}/yarn.lock`),
    'utf8',
  );
};
const getHandRolledPkgJson = (fixture: string) => {
  return readFileSync(
    join(
      __dirname,
      `./fixtures/yarn-lock-v2/hand-rolled/${fixture}/package.json`,
    ),
    'utf8',
  );
};

describe('yarn.lock v2 parsing', () => {
  it('returns package manager', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('empty');
    const yarnLock = getHandRolledYarnLock('empty');
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.pkgManager).toMatchObject({ name: 'yarn' });
  });

  it('returns root pkg', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('empty');
    const yarnLock = getHandRolledYarnLock('empty');
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.rootPkg).toMatchObject({ name: 'empty', version: '1.0.0' });
  });

  it('returns packages', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-chain');
    const yarnLock = getHandRolledYarnLock('simple-chain');
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.getPkgs()).toMatchObject([
      { name: 'simple-chain', version: '1.0.0' },
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
    ]);
  });

  it('returns pkg deps', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-chain');
    const yarnLock = getHandRolledYarnLock('simple-chain');
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.toJSON().graph.nodes).toMatchObject([
      {
        nodeId: 'root-node',
        pkgId: 'simple-chain@1.0.0',
        deps: [{ nodeId: 'a@1.0.0' }],
      },

      {
        nodeId: 'a@1.0.0',
        pkgId: 'a@1.0.0',
        deps: [{ nodeId: 'b@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'b@1.0.0',
        pkgId: 'b@1.0.0',
        deps: [],
        info: { labels: { scope: 'prod' } },
      },
    ]);
  });

  it('returns packages - cyclic', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const yarnLock = getHandRolledYarnLock('simple-cyclic-chain');
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.getPkgs()).toMatchObject([
      { name: 'simple-cyclic-chain', version: '1.0.0' },
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
    ]);
  });

  it('returns pkg deps - cyclic', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const yarnLock = getHandRolledYarnLock('simple-cyclic-chain');
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.toJSON().graph.nodes).toMatchObject([
      {
        nodeId: 'root-node',
        pkgId: 'simple-cyclic-chain@1.0.0',
        deps: [{ nodeId: 'a@1.0.0' }],
      },

      {
        nodeId: 'a@1.0.0',
        pkgId: 'a@1.0.0',
        deps: [{ nodeId: 'b@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'b@1.0.0',
        pkgId: 'b@1.0.0',
        deps: [{ nodeId: 'a@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
    ]);
  });

  it('returns packages - cyclic - pruned', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: true,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const yarnLock = getHandRolledYarnLock('simple-cyclic-chain');
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.getPkgs()).toMatchObject([
      { name: 'simple-cyclic-chain', version: '1.0.0' },
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
    ]);
  });

  it('returns pkg deps - cyclic - pruned', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: true,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const yarnLock = getHandRolledYarnLock('simple-cyclic-chain');
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.toJSON().graph.nodes).toMatchObject([
      {
        nodeId: 'root-node',
        pkgId: 'simple-cyclic-chain@1.0.0',
        deps: [{ nodeId: 'a@1.0.0' }],
      },
      {
        nodeId: 'a@1.0.0',
        pkgId: 'a@1.0.0',
        deps: [{ nodeId: 'b@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'b@1.0.0',
        pkgId: 'b@1.0.0',
        deps: [{ nodeId: 'a@1.0.0:pruned' }],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'a@1.0.0:pruned',
        pkgId: 'a@1.0.0',
        deps: [],
        info: { labels: { scope: 'prod', pruned: 'true' } },
      },
    ]);
  });

  it('returns pkg deps - repeat node within top level chain', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('repeat-node-within-top-level-chain');
    const yarnLock = getHandRolledYarnLock(
      'repeat-node-within-top-level-chain',
    );
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.toJSON().graph.nodes).toMatchObject([
      {
        nodeId: 'root-node',
        pkgId: 'repeat-node-within-top-level-chain@1.0.0',
        deps: [{ nodeId: 'a@1.0.0' }],
      },
      {
        nodeId: 'a@1.0.0',
        pkgId: 'a@1.0.0',
        deps: [{ nodeId: 'b@1.0.0' }, { nodeId: 'd@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'b@1.0.0',
        pkgId: 'b@1.0.0',
        deps: [{ nodeId: 'c@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'c@1.0.0',
        pkgId: 'c@1.0.0',
        deps: [],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'd@1.0.0',
        pkgId: 'd@1.0.0',
        deps: [{ nodeId: 'b@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
    ]);
  });

  it('returns pkg deps - repeat node within top level chain - pruned', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: true,
    };
    const pkgJson = getHandRolledPkgJson('repeat-node-within-top-level-chain');
    const yarnLock = getHandRolledYarnLock(
      'repeat-node-within-top-level-chain',
    );
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.toJSON().graph.nodes).toMatchObject([
      {
        nodeId: 'root-node',
        pkgId: 'repeat-node-within-top-level-chain@1.0.0',
        deps: [{ nodeId: 'a@1.0.0' }],
      },
      {
        nodeId: 'a@1.0.0',
        pkgId: 'a@1.0.0',
        deps: [{ nodeId: 'b@1.0.0' }, { nodeId: 'd@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'b@1.0.0',
        pkgId: 'b@1.0.0',
        deps: [{ nodeId: 'c@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'c@1.0.0',
        pkgId: 'c@1.0.0',
        deps: [],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'd@1.0.0',
        pkgId: 'd@1.0.0',
        deps: [{ nodeId: 'b@1.0.0:pruned' }],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'b@1.0.0:pruned',
        pkgId: 'b@1.0.0',
        deps: [],
        info: { labels: { scope: 'prod', pruned: 'true' } },
      },
    ]);
  });

  it('returns pkg deps - repeat node in different top level chains', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson(
      'repeat-node-in-different-top-level-chains',
    );
    const yarnLock = getHandRolledYarnLock(
      'repeat-node-in-different-top-level-chains',
    );
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.toJSON().graph.nodes).toMatchObject([
      {
        nodeId: 'root-node',
        pkgId: 'repeat-node-in-different-top-level-chains@1.0.0',
        deps: [{ nodeId: 'a@1.0.0' }, { nodeId: 'd@1.0.0' }],
      },
      {
        nodeId: 'a@1.0.0',
        pkgId: 'a@1.0.0',
        deps: [{ nodeId: 'b@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'b@1.0.0',
        pkgId: 'b@1.0.0',
        deps: [{ nodeId: 'c@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'c@1.0.0',
        pkgId: 'c@1.0.0',
        deps: [],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'd@1.0.0',
        pkgId: 'd@1.0.0',
        deps: [{ nodeId: 'b@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
    ]);
  });

  it('returns pkg deps - repeat node in different top level chains - pruned', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: true,
    };
    const pkgJson = getHandRolledPkgJson(
      'repeat-node-in-different-top-level-chains',
    );
    const yarnLock = getHandRolledYarnLock(
      'repeat-node-in-different-top-level-chains',
    );
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.toJSON().graph.nodes).toMatchObject([
      {
        nodeId: 'root-node',
        pkgId: 'repeat-node-in-different-top-level-chains@1.0.0',
        deps: [{ nodeId: 'a@1.0.0' }, { nodeId: 'd@1.0.0' }],
      },
      {
        nodeId: 'a@1.0.0',
        pkgId: 'a@1.0.0',
        deps: [{ nodeId: 'b@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'b@1.0.0',
        pkgId: 'b@1.0.0',
        deps: [{ nodeId: 'c@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'c@1.0.0',
        pkgId: 'c@1.0.0',
        deps: [],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'd@1.0.0',
        pkgId: 'd@1.0.0',
        deps: [{ nodeId: 'b@1.0.0' }],
        info: { labels: { scope: 'prod' } },
      },
    ]);
  });

  it('returns packages - scoped npm alias', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('scoped-alias');
    const yarnLock = getHandRolledYarnLock('scoped-alias');
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.getPkgs()).toMatchObject([
      { name: 'scoped-alias', version: '1.0.0' },
      { name: 'a', version: '1.0.0' },
      { name: 'lib-types', version: '1.0.0' },
    ]);
  });

  it('returns pkg deps - scoped npm alias', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('scoped-alias');
    const yarnLock = getHandRolledYarnLock('scoped-alias');
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);
    expect(dg.toJSON().graph.nodes).toMatchObject([
      {
        nodeId: 'root-node',
        pkgId: 'scoped-alias@1.0.0',
        deps: [{ nodeId: 'a@1.0.0' }, { nodeId: 'lib-types@1.0.0' }],
      },
      {
        nodeId: 'a@1.0.0',
        pkgId: 'a@1.0.0',
        deps: [],
        info: { labels: { scope: 'prod' } },
      },
      {
        nodeId: 'lib-types@1.0.0',
        pkgId: 'lib-types@1.0.0',
        deps: [],
        info: { labels: { scope: 'prod' } },
      },
    ]);
  });

  it('handles patch protocol with URL-encoded resolutions', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('patch-protocol');
    const yarnLock = getHandRolledYarnLock('patch-protocol');
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts, {
      isWorkspacePkg: true,
      isRoot: true,
      rootResolutions: {
        'lodash@4.17.21': 'patch:lodash@npm%3A4.17.21#./patches/lodash.patch',
      },
    });

    // Verify the package is found and has correct structure
    expect(dg.getPkgs()).toMatchObject([
      { name: 'patch-protocol-test', version: '1.0.0' },
      { name: 'lodash', version: '4.17.21' },
    ]);

    // Verify node IDs use simple version format, not full patch protocol string
    expect(dg.toJSON().graph.nodes).toMatchObject([
      {
        nodeId: 'root-node',
        pkgId: 'patch-protocol-test@1.0.0',
        deps: [{ nodeId: 'lodash@4.17.21' }],
      },
      {
        nodeId: 'lodash@4.17.21',
        pkgId: 'lodash@4.17.21',
        deps: [],
        info: { labels: { scope: 'prod' } },
      },
    ]);

    // Verify no node IDs contain the patch protocol string
    const allNodeIds = dg.toJSON().graph.nodes.map((n) => n.nodeId);
    allNodeIds.forEach((nodeId) => {
      expect(nodeId).not.toContain('patch:');
      expect(nodeId).not.toContain('npm%3A');
    });
  });

  it('creates separate package entries for npm aliases', async () => {
    const opts: YarnLockV2ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('npm-alias-packages');
    const yarnLock = getHandRolledYarnLock('npm-alias-packages');
    const dg = await parseYarnLockV2Project(pkgJson, yarnLock, opts);

    const depGraphJson = dg.toJSON();

    // Verify alias package entries exist with correct names
    const pkgIds = depGraphJson.pkgs.map((p) => p.id);
    expect(pkgIds).toContain('string-width-cjs@4.2.3');
    expect(pkgIds).toContain('strip-ansi-cjs@6.0.1');

    // Verify alias packages have correct name (alias name, not target name)
    const stringWidthCjsPkg = depGraphJson.pkgs.find(
      (p) => p.id === 'string-width-cjs@4.2.3',
    );
    expect(stringWidthCjsPkg?.info.name).toBe('string-width-cjs');
    expect(stringWidthCjsPkg?.info.version).toBe('4.2.3');

    const stripAnsiCjsPkg = depGraphJson.pkgs.find(
      (p) => p.id === 'strip-ansi-cjs@6.0.1',
    );
    expect(stripAnsiCjsPkg?.info.name).toBe('strip-ansi-cjs');
    expect(stripAnsiCjsPkg?.info.version).toBe('6.0.1');

    // Verify nodes reference the correct package IDs (alias package IDs match node IDs)
    const stringWidthCjsNode = depGraphJson.graph.nodes.find(
      (n) => n.nodeId === 'string-width-cjs@4.2.3',
    );
    expect(stringWidthCjsNode?.pkgId).toBe('string-width-cjs@4.2.3');
    expect(stringWidthCjsNode?.nodeId).toBe('string-width-cjs@4.2.3');

    const stripAnsiCjsNode = depGraphJson.graph.nodes.find(
      (n) => n.nodeId === 'strip-ansi-cjs@6.0.1',
    );
    expect(stripAnsiCjsNode?.pkgId).toBe('strip-ansi-cjs@6.0.1');
    expect(stripAnsiCjsNode?.nodeId).toBe('strip-ansi-cjs@6.0.1');

    // Verify the alias metadata is present in node info
    expect(stringWidthCjsNode?.info?.labels?.alias).toContain(
      'string-width-cjs=>string-width@',
    );
    expect(stripAnsiCjsNode?.info?.labels?.alias).toContain(
      'strip-ansi-cjs=>strip-ansi@',
    );
  });
});

// Regression: when a Yarn Berry workspace package is consumed as a production
// dependency, its dev-only tooling must not be promoted into the production graph.
// Yarn merges a workspace member's dependencies + devDependencies into a single
// `dependencies` block in yarn.lock, losing the dev marker; the builder uses the member's
// own package.json (via workspaceArgs.workspacePackages) to prune the dev-only entries.
describe('Workspace consumed as a prod dependency (dev-dep leak)', () => {
  const fixtureBasePath = join(
    __dirname,
    './fixtures/yarn-lock-v2/real/workspace-dev-deps',
  );

  const rootYarnLockContent = readFileSync(
    join(fixtureBasePath, 'yarn.lock'),
    'utf8',
  );
  const myAppPkgJsonContent = readFileSync(
    join(fixtureBasePath, 'apps/my-app/package.json'),
    'utf8',
  );
  const sharedLibManifest = JSON.parse(
    readFileSync(
      join(fixtureBasePath, 'libraries/shared-lib/package.json'),
      'utf8',
    ),
  );
  const privateLibManifest = JSON.parse(
    readFileSync(
      join(fixtureBasePath, 'libraries/private-lib/package.json'),
      'utf8',
    ),
  );

  // shared-lib's dev-only build tooling that was leaking into my-app's prod graph
  const DEV_ONLY_TOOLING = [
    'webpack',
    'webpack-cli',
    '@babel/core',
    '@babel/preset-env',
    'babel-loader',
  ];

  const workspacePackages = {
    '@demo/shared-lib': sharedLibManifest,
    '@demo/private-lib': privateLibManifest,
  };

  const baseOpts: YarnLockV2ProjectParseOptions = {
    includeDevDeps: false,
    includeOptionalDeps: true,
    strictOutOfSync: false,
    pruneWithinTopLevelDeps: false,
  };

  it('leaks shared-lib devDependencies into prod graph WITHOUT workspacePackages (bug)', async () => {
    const dg = await parseYarnLockV2Project(
      myAppPkgJsonContent,
      rootYarnLockContent,
      baseOpts,
      { isRoot: false, isWorkspacePkg: true, rootResolutions: {} },
    );

    const pkgNames = dg.getDepPkgs().map((p) => p.name);
    // Demonstrates the defect: dev-only tooling is present as prod.
    expect(pkgNames).toEqual(expect.arrayContaining(DEV_ONLY_TOOLING));
  });

  it('prunes shared-lib devDependencies WITH workspacePackages (fix)', async () => {
    const dg = await parseYarnLockV2Project(
      myAppPkgJsonContent,
      rootYarnLockContent,
      baseOpts,
      {
        isRoot: false,
        isWorkspacePkg: true,
        rootResolutions: {},
        workspacePackages,
      },
    );

    const pkgNames = dg.getDepPkgs().map((p) => p.name);

    // shared-lib is a real prod dependency of my-app and must remain.
    expect(pkgNames).toContain('@demo/shared-lib');

    // shared-lib has ONLY devDependencies, so none of its tooling should appear.
    for (const devPkg of DEV_ONLY_TOOLING) {
      expect(pkgNames).not.toContain(devPkg);
    }
  });

  it('keeps devDependencies when includeDevDeps is true', async () => {
    const dg = await parseYarnLockV2Project(
      myAppPkgJsonContent,
      rootYarnLockContent,
      { ...baseOpts, includeDevDeps: true },
      {
        isRoot: false,
        isWorkspacePkg: true,
        rootResolutions: {},
        workspacePackages,
      },
    );

    const pkgNames = dg.getDepPkgs().map((p) => p.name);
    // With includeDevDeps the dev tooling is expected to be present again.
    expect(pkgNames).toEqual(expect.arrayContaining(DEV_ONLY_TOOLING));
  });
});

// The workspace dev-dep prune looks up the consumed member's manifest. When the member is
// consumed via an npm alias, the parent knows it by the alias name, but the workspacePackages
// map is keyed by the member's real package name. The lookup must use the resolved (alias
// target) name, otherwise it misses the manifest and skips pruning.
describe('getYarnLockV2ChildNode workspace prune keys by resolved (alias) name', () => {
  const parentNode: PkgNode = {
    id: 'app@1.0.0',
    name: 'app',
    version: '1.0.0',
    dependencies: {},
    isDev: false,
  };

  // `shared-alias` is an npm alias for the workspace package `@acme/shared`, which is resolved
  // to a `@workspace:` node whose merged dependency block contains its dev-only `ms`.
  const depInfo = {
    version: 'npm:@acme/shared@*',
    isDev: false,
    alias: {
      aliasName: 'shared-alias',
      aliasTargetDepName: '@acme/shared',
      semver: '*',
      version: '0.0.0-use.local',
    },
  };

  const pkgs = {
    'shared-alias@npm:@acme/shared@*': {
      version: '0.0.0-use.local',
      resolution: '@acme/shared@workspace:packages/shared',
      dependencies: { ms: 'npm:^2.1.3' },
      optionalDependencies: {},
    },
  } as any;

  // @acme/shared declares `ms` as a dev-only dependency.
  const workspacePackages = {
    '@acme/shared': { dependencies: {}, devDependencies: { ms: '^2.1.3' } },
  };

  it('prunes the dev-only dependency of an aliased workspace package', () => {
    const child = getYarnLockV2ChildNode(
      'shared-alias',
      depInfo,
      pkgs,
      false,
      false,
      {},
      parentNode,
      false,
      workspacePackages,
    );
    expect(Object.keys(child.dependencies)).not.toContain('ms');
  });

  it('keeps the dependency when no workspacePackages map is provided', () => {
    const child = getYarnLockV2ChildNode(
      'shared-alias',
      depInfo,
      pkgs,
      false,
      false,
      {},
      parentNode,
      false,
      undefined,
    );
    expect(Object.keys(child.dependencies)).toContain('ms');
  });
});
