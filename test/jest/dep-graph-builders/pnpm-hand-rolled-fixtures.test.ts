import { readFileSync } from 'fs';
import { join } from 'path';
import { PnpmParseOptions } from '../../../lib/dep-graph-builders/types';
import { parsePnpmProject } from '../../../lib/dep-graph-builders/pnpm';

const getHandRolledPnpmLock = (fixture: string) => {
  return readFileSync(
    join(__dirname, `./fixtures/pnpm/hand-rolled/${fixture}/pnpm-lock.yaml`),
    'utf8',
  );
};
const getHandRolledPkgJson = (fixture: string) => {
  return readFileSync(
    join(__dirname, `./fixtures/pnpm/hand-rolled/${fixture}/package.json`),
    'utf8',
  );
};

describe('pnpm-lock.yaml parsing', () => {
  it('returns package manager', async () => {
    const opts: PnpmParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('empty');
    const pnpmLock = getHandRolledPnpmLock('empty');
    const dg = await parsePnpmProject(pkgJson, pnpmLock, opts);
    expect(dg.pkgManager).toMatchObject({ name: 'pnpm' });
  });

  it('returns root pkg', async () => {
    const opts: PnpmParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('empty');
    const pnpmLock = getHandRolledPnpmLock('empty');
    const dg = await parsePnpmProject(pkgJson, pnpmLock, opts);
    expect(dg.rootPkg).toMatchObject({ name: 'empty', version: '1.0.0' });
  });

  it('returns packages', async () => {
    const opts: PnpmParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
    };

    const pkgJson = getHandRolledPkgJson('simple-chain');
    const pnpmLock = getHandRolledPnpmLock('simple-chain');
    const dg = await parsePnpmProject(pkgJson, pnpmLock, opts);
    expect(dg.getPkgs()).toMatchObject([
      { name: 'simple-chain', version: '1.0.0' },
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
    ]);
  });

  it('returns pkg deps', async () => {
    const opts: PnpmParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-chain');
    const pnpmLock = getHandRolledPnpmLock('simple-chain');
    const dg = await parsePnpmProject(pkgJson, pnpmLock, opts);
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
    const opts: PnpmParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const pnpmLock = getHandRolledPnpmLock('simple-cyclic-chain');
    const dg = await parsePnpmProject(pkgJson, pnpmLock, opts);
    expect(dg.getPkgs()).toMatchObject([
      { name: 'simple-cyclic-chain', version: '1.0.0' },
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
    ]);
  });

  it('returns pkg deps - cyclic', async () => {
    const opts: PnpmParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('simple-cyclic-chain');
    const pnpmLock = getHandRolledPnpmLock('simple-cyclic-chain');
    const dg = await parsePnpmProject(pkgJson, pnpmLock, opts);
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

  it('returns pkg deps - repeat node within top level chain - pruned within top level deps', async () => {
    const opts: PnpmParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson('repeat-node-within-top-level-chain');
    const pnpmLock = getHandRolledPnpmLock(
      'repeat-node-within-top-level-chain',
    );
    const dg = await parsePnpmProject(pkgJson, pnpmLock, opts);
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

  it('returns pkg deps - repeat node in different top level chains - pruned within top level deps', async () => {
    const opts: PnpmParseOptions = {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
    };
    const pkgJson = getHandRolledPkgJson(
      'repeat-node-in-different-top-level-chains',
    );
    const pnpmLock = getHandRolledPnpmLock(
      'repeat-node-in-different-top-level-chains',
    );
    const dg = await parsePnpmProject(pkgJson, pnpmLock, opts);
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

  it('missing-transitive-dependency & strictOutOfSync -> throws OutOfSyncError', async () => {
    const pkgJson = getHandRolledPkgJson('missing-transitive-dependency');
    const pnpmLock = getHandRolledPnpmLock('missing-transitive-dependency');

    await expect(
      parsePnpmProject(pkgJson, pnpmLock, {
        includeDevDeps: false,
        includeOptionalDeps: true,
        strictOutOfSync: true,
      }),
    ).rejects.toThrowError(
      'Dependency b@1.0.0 was not found in pnpm-lock.yaml. Your package.json and pnpm-lock.yaml are probably out of sync. Please run "pnpm install" and try again.',
    );
  });
  it('missing-transitive-dependency & NOT strictOutOfSync -> does not throw and creates node for missing dep', async () => {
    const pkgJson = getHandRolledPkgJson('missing-transitive-dependency');
    const pnpmLock = getHandRolledPnpmLock('missing-transitive-dependency');

    const dg = await parsePnpmProject(pkgJson, pnpmLock, {
      includeDevDeps: false,
      includeOptionalDeps: true,
      strictOutOfSync: false,
    });
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
        info: { labels: { scope: 'prod' } },
      },
    ]);
  });
});
