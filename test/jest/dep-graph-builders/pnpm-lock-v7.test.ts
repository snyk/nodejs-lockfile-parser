import { createFromJSON } from '@snyk/dep-graph';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PnpmLockV7ProjectParseOptions } from '../../../lib/dep-graph-builders/types';
import { parsePnpmLockV7Project } from '../../../lib/dep-graph-builders/pnpm-lock/simple';

describe.only('pnpm-lock.yaml v7 "real" projects', () => {
  describe.each([
    // 'git-remote-url',
    'goof',
    // 'resolutions-simple',
    // 'resolutions-scoped',
  ])('[simple tests] project: %s ', (fixtureName) => {
    test('matches expected - no pruning', async () => {
      const pkgJsonContent = readFileSync(
        join(
          __dirname,
          `./fixtures/pnpm-lock-v7/real/${fixtureName}/package.json`,
        ),
        'utf8',
      );
      const pnpmLockContent = readFileSync(
        join(
          __dirname,
          `./fixtures/pnpm-lock-v7/real/${fixtureName}/pnpm-lock.yaml`,
        ),
        'utf8',
      );
      const opts: PnpmLockV7ProjectParseOptions = {
        includeDevDeps: true,
        includeOptionalDeps: true,
        strictOutOfSync: false,
        pruneWithinTopLevelDeps: false,
      };

      const dg = await parsePnpmLockV7Project(
        pkgJsonContent,
        pnpmLockContent,
        opts,
      );
      console.log(`dgJson:`, JSON.stringify(dg.toJSON(), null, 2));

      const expectedDepGraphJson = JSON.parse(
        readFileSync(
          join(
            __dirname,
            `./fixtures/pnpm-lock-v7/real/${fixtureName}/expected.json`,
          ),
          'utf8',
        ),
      );

      expect(dg).toBeTruthy();

      const expectedDepGraph = createFromJSON(expectedDepGraphJson);
      expect(dg.equals(expectedDepGraph)).toBeTruthy();
    });
  });

  it('Workspace with resolutions', async () => {
    const rootPkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/pnpm-lock-v7/real/resolutions-in-workspace/package.json`,
      ),
      'utf8',
    );
    const rootpnpmLockContent = readFileSync(
      join(
        __dirname,
        `./fixtures/pnpm-lock-v7/real/resolutions-in-workspace/pnpm-lock.yaml`,
      ),
      'utf8',
    );
    const workspacePkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/pnpm-lock-v7/real/resolutions-in-workspace/workspace1/package.json`,
      ),
      'utf8',
    );

    const opts: PnpmLockV7ProjectParseOptions = {
      includeDevDeps: true,
      includeOptionalDeps: true,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };

    const dg = await parsePnpmLockV7Project(
      workspacePkgJsonContent,
      rootpnpmLockContent,
      opts,
    );

    const expectedDepGraphJson = JSON.parse(
      readFileSync(
        join(
          __dirname,
          `./fixtures/pnpm-lock-v7/real/resolutions-in-workspace/workspace1/expected-graph.json`,
        ),
        'utf8',
      ),
    );

    const expectedDepGraph = createFromJSON(expectedDepGraphJson);
    expect(dg.equals(expectedDepGraph)).toBeTruthy();
  });
});

const getHandRolledPnpmLock = (fixture: string) => {
  return readFileSync(
    join(
      __dirname,
      `./fixtures/pnpm-lock-v7/hand-rolled/${fixture}/pnpm-lock.yaml`,
    ),
    'utf8',
  );
};
const getHandRolledPkgJson = (fixture: string) => {
  return readFileSync(
    join(
      __dirname,
      `./fixtures/pnpm-lock-v7/hand-rolled/${fixture}/package.json`,
    ),
    'utf8',
  );
};

describe.skip('pnpm-lock.yaml v7 parsing', () => {
  it('returns package manager', async () => {
    const opts: PnpmLockV7ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('empty');
    const pnpmLock = getHandRolledPnpmLock('empty');
    const dg = await parsePnpmLockV7Project(pkgJson, pnpmLock, opts);
    expect(dg.pkgManager).toMatchObject({ name: 'pnpm' });
  });

  it('returns root pkg', async () => {
    const opts: PnpmLockV7ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('empty');
    const pnpmLock = getHandRolledPnpmLock('empty');
    const dg = await parsePnpmLockV7Project(pkgJson, pnpmLock, opts);
    expect(dg.rootPkg).toMatchObject({ name: 'empty', version: '1.0.0' });
  });

  it('returns packages', async () => {
    const opts: PnpmLockV7ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-chain');
    const pnpmLock = getHandRolledPnpmLock('simple-chain');
    const dg = await parsePnpmLockV7Project(pkgJson, pnpmLock, opts);
    expect(dg.getPkgs()).toMatchObject([
      { name: 'simple-chain', version: '1.0.0' },
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
    ]);
  });

  it('returns pkg deps', async () => {
    const opts: PnpmLockV7ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-chain');
    const pnpmLock = getHandRolledPnpmLock('simple-chain');
    const dg = await parsePnpmLockV7Project(pkgJson, pnpmLock, opts);
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
    const opts: PnpmLockV7ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const pnpmLock = getHandRolledPnpmLock('simple-cyclic-chain');
    const dg = await parsePnpmLockV7Project(pkgJson, pnpmLock, opts);
    expect(dg.getPkgs()).toMatchObject([
      { name: 'simple-cyclic-chain', version: '1.0.0' },
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
    ]);
  });

  it('returns pkg deps - cyclic', async () => {
    const opts: PnpmLockV7ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const pnpmLock = getHandRolledPnpmLock('simple-cyclic-chain');
    const dg = await parsePnpmLockV7Project(pkgJson, pnpmLock, opts);
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
    const opts: PnpmLockV7ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: true,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const pnpmLock = getHandRolledPnpmLock('simple-cyclic-chain');
    const dg = await parsePnpmLockV7Project(pkgJson, pnpmLock, opts);
    expect(dg.getPkgs()).toMatchObject([
      { name: 'simple-cyclic-chain', version: '1.0.0' },
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
    ]);
  });

  it('returns pkg deps - cyclic - pruned', async () => {
    const opts: PnpmLockV7ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: true,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const pnpmLock = getHandRolledPnpmLock('simple-cyclic-chain');
    const dg = await parsePnpmLockV7Project(pkgJson, pnpmLock, opts);
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
    const opts: PnpmLockV7ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson('repeat-node-within-top-level-chain');
    const pnpmLock = getHandRolledPnpmLock(
      'repeat-node-within-top-level-chain',
    );
    const dg = await parsePnpmLockV7Project(pkgJson, pnpmLock, opts);
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
    const opts: PnpmLockV7ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: true,
    };
    const pkgJson = getHandRolledPkgJson('repeat-node-within-top-level-chain');
    const pnpmLock = getHandRolledPnpmLock(
      'repeat-node-within-top-level-chain',
    );
    const dg = await parsePnpmLockV7Project(pkgJson, pnpmLock, opts);
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
    const opts: PnpmLockV7ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    };
    const pkgJson = getHandRolledPkgJson(
      'repeat-node-in-different-top-level-chains',
    );
    const pnpmLock = getHandRolledPnpmLock(
      'repeat-node-in-different-top-level-chains',
    );
    const dg = await parsePnpmLockV7Project(pkgJson, pnpmLock, opts);
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
    const opts: PnpmLockV7ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: true,
    };
    const pkgJson = getHandRolledPkgJson(
      'repeat-node-in-different-top-level-chains',
    );
    const pnpmLock = getHandRolledPnpmLock(
      'repeat-node-in-different-top-level-chains',
    );
    const dg = await parsePnpmLockV7Project(pkgJson, pnpmLock, opts);
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
});
