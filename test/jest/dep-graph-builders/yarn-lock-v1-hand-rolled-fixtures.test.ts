import { readFileSync } from 'fs';
import { join } from 'path';
import { YarnLockV1ProjectParseOptions } from '../../../lib/dep-graph-builders/types';
import { parseYarnLockV1Project } from '../../../lib/dep-graph-builders/yarn-lock-v1/simple';

const getHandRolledYarnLock = (fixture: string) => {
  return readFileSync(
    join(__dirname, `./fixtures/yarn-lock-v1/hand-rolled/${fixture}/yarn.lock`),
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

describe('yarn.lock v1 parsing', () => {
  it('returns package manager', async () => {
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'none',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('empty');
    const yarnLock = getHandRolledYarnLock('empty');
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
    expect(dg.pkgManager).toMatchObject({ name: 'yarn' });
  });

  it('returns root pkg', async () => {
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'none',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('empty');
    const yarnLock = getHandRolledYarnLock('empty');
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
    expect(dg.rootPkg).toMatchObject({ name: 'empty', version: '1.0.0' });
  });

  it('returns packages', async () => {
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'none',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-chain');
    const yarnLock = getHandRolledYarnLock('simple-chain');
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
    expect(dg.getPkgs()).toMatchObject([
      { name: 'simple-chain', version: '1.0.0' },
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
    ]);
  });

  it('returns pkg deps', async () => {
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'none',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-chain');
    const yarnLock = getHandRolledYarnLock('simple-chain');
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
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
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'none',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const yarnLock = getHandRolledYarnLock('simple-cyclic-chain');
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
    expect(dg.getPkgs()).toMatchObject([
      { name: 'simple-cyclic-chain', version: '1.0.0' },
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
    ]);
  });

  it('returns pkg deps - cyclic', async () => {
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'none',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const yarnLock = getHandRolledYarnLock('simple-cyclic-chain');
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
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

  it('returns packages - cyclic - pruned just cycles', async () => {
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'cycles',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const yarnLock = getHandRolledYarnLock('simple-cyclic-chain');
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
    expect(dg.getPkgs()).toMatchObject([
      { name: 'simple-cyclic-chain', version: '1.0.0' },
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
    ]);
  });

  it('returns pkg deps - cyclic - pruned just cycles', async () => {
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'cycles',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const yarnLock = getHandRolledYarnLock('simple-cyclic-chain');
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
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
        info: { labels: { scope: 'prod', pruned: 'cyclic' } },
      },
    ]);
  });

  it('returns packages - cyclic - pruned within top level deps', async () => {
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'withinTopLevelDeps',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const yarnLock = getHandRolledYarnLock('simple-cyclic-chain');
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
    expect(dg.getPkgs()).toMatchObject([
      { name: 'simple-cyclic-chain', version: '1.0.0' },
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
    ]);
  });

  it('returns pkg deps - cyclic - pruned within top level deps', async () => {
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'withinTopLevelDeps',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const yarnLock = getHandRolledYarnLock('simple-cyclic-chain');
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
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
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'none',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('repeat-node-within-top-level-chain');
    const yarnLock = getHandRolledYarnLock(
      'repeat-node-within-top-level-chain',
    );
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
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

  it('returns pkg deps - repeat node within top level chain - pruned within top level deps', async () => {
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'withinTopLevelDeps',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('repeat-node-within-top-level-chain');
    const yarnLock = getHandRolledYarnLock(
      'repeat-node-within-top-level-chain',
    );
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
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
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'none',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson(
      'repeat-node-in-different-top-level-chains',
    );
    const yarnLock = getHandRolledYarnLock(
      'repeat-node-in-different-top-level-chains',
    );
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
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

  it('returns pkg deps - repeat node in different top level chains - pruned within top level deps', async () => {
    const opts: YarnLockV1ProjectParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      includePeerDeps: false,
      pruneLevel: 'withinTopLevelDeps',
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson(
      'repeat-node-in-different-top-level-chains',
    );
    const yarnLock = getHandRolledYarnLock(
      'repeat-node-in-different-top-level-chains',
    );
    const dg = await parseYarnLockV1Project(pkgJson, yarnLock, opts);
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
