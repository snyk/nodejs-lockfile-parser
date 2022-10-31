import { join } from 'path';
import { readdirSync, readFileSync } from 'fs';
import { createFromJSON } from '@snyk/dep-graph';
import {
  OutOfSyncError,
  parseYarnLockV1Project,
  parseYarnLockV1WorkspaceProject,
} from '../../../lib';

const readWorkspacePkgJsons = (fixtureName: string) => {
  const rootPkgJson = readFileSync(
    join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/package.json`),
    'utf8',
  );

  const pkgDirEntries = readdirSync(
    join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/packages/`),
  );

  const packagesPkgJsons = pkgDirEntries.map((entry) => {
    return readFileSync(
      join(
        __dirname,
        `./fixtures/yarn-lock-v1/${fixtureName}/packages/${entry}/package.json`,
      ),
      'utf8',
    );
  });

  return [rootPkgJson, ...packagesPkgJsons];
};

describe('Dep Graph Builders -> Yarn Lock v1 Workspaces', () => {
  test('project: workspace-isolated-pkgs', async () => {
    const fixtureName = 'workspace-with-isolated-pkgs';
    const yarnLockContent = readFileSync(
      join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/yarn.lock`),
      'utf8',
    );

    const pkgJsons = readWorkspacePkgJsons(fixtureName);

    const newDepGraphs = await parseYarnLockV1WorkspaceProject(
      yarnLockContent,
      pkgJsons,
      {
        includeDevDeps: false,
        includeOptionalDeps: true,
        pruneCycles: true,
        strictOutOfSync: false,
      },
    );

    // Standard Checks
    expect(newDepGraphs).toBeTruthy();
    expect(newDepGraphs.length).toBe(3);
  });

  test('project: workspace-with-cross-ref', async () => {
    const fixtureName = 'workspace-with-cross-ref';
    const yarnLockContent = readFileSync(
      join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/yarn.lock`),
      'utf8',
    );

    const pkgJsons = readWorkspacePkgJsons(fixtureName);

    const newDepGraphs = await parseYarnLockV1WorkspaceProject(
      yarnLockContent,
      pkgJsons,
      {
        includeDevDeps: false,
        includeOptionalDeps: true,
        pruneCycles: true,
        strictOutOfSync: false,
      },
    );

    // Standard Checks
    expect(newDepGraphs).toBeTruthy();
    expect(newDepGraphs.length).toBe(3);

    const depGraphsAsJson = newDepGraphs.map((graph) => graph.toJSON());

    // Check if interdependencies handled well
    const pkgAGraphAsJson = depGraphsAsJson.find((graph) => {
      return graph.graph.nodes.find((node) => {
        return node.nodeId === 'root-node' && node.pkgId === 'pkg-a@1.0.0';
      });
    });
    const pkgBNode = pkgAGraphAsJson?.graph.nodes.find((node) => {
      return node.nodeId === 'pkg-b@1.0.0' && node.pkgId === 'pkg-b@1.0.0';
    });
    expect(pkgBNode?.deps.length).toBe(0);
    expect(pkgBNode?.info?.labels?.pruned).toBe('true');
  });
});

describe('Workspace out of sync tests', () => {
  describe('with simple yarn project parser', () => {
    describe.each(['lock-file-deps-out-of-sync', 'top-level-out-of-sync'])(
      '[workspace] project: %s ',
      (fixtureName) => {
        test('matches expected without throwing OutOfSyncError', async () => {
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/packages/pkg-a/package.json`,
            ),
            'utf8',
          );
          const yarnLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/yarn.lock`,
            ),
            'utf8',
          );

          const depGraph = await parseYarnLockV1Project(
            pkgJsonContent,
            yarnLockContent,
            {
              includeDevDeps: false,
              includeOptionalDeps: true,
              pruneCycles: true,
              strictOutOfSync: false,
            },
          );
          const expectedDepGraphJson = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/expected.json`,
              ),
              'utf8',
            ),
          );

          const expectedDepGraph = createFromJSON(expectedDepGraphJson);

          expect(depGraph.equals(expectedDepGraph)).toBeTruthy();
        });
      },
    );

    describe.each(['file-as-version', 'file-as-version-no-lock-entry'])(
      '[workspace] project: %s ',
      (fixtureName) => {
        test('creates graph node as per in package.json without throwing OutOfSyncError', async () => {
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/packages/pkg-a/package.json`,
            ),
            'utf8',
          );
          const yarnLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/yarn.lock`,
            ),
            'utf8',
          );

          const depGraphAllowOutOfSync = await parseYarnLockV1Project(
            pkgJsonContent,
            yarnLockContent,
            {
              includeDevDeps: false,
              includeOptionalDeps: true,
              pruneCycles: true,
              strictOutOfSync: false,
            },
          );

          const depGraphStrictOutOfSync = await parseYarnLockV1Project(
            pkgJsonContent,
            yarnLockContent,
            {
              includeDevDeps: false,
              includeOptionalDeps: true,
              pruneCycles: true,
              strictOutOfSync: true,
            },
          );

          const expectedDepGraphJson = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/expected.json`,
              ),
              'utf8',
            ),
          );

          const expectedDepGraph = createFromJSON(expectedDepGraphJson);

          expect(depGraphAllowOutOfSync.equals(expectedDepGraph)).toBeTruthy();
          expect(depGraphStrictOutOfSync.equals(expectedDepGraph)).toBeTruthy();
        });
      },
    );

    describe.each(['cross-ref-invalid', 'cross-ref-valid'])(
      '[workspace] project: %s ',
      (fixtureName) => {
        test('throws OutOfSyncError whether cross ref is valid or not', async () => {
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/packages/pkg-a/package.json`,
            ),
            'utf8',
          );
          const yarnLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/yarn.lock`,
            ),
            'utf8',
          );

          try {
            await parseYarnLockV1Project(pkgJsonContent, yarnLockContent, {
              includeDevDeps: false,
              includeOptionalDeps: true,
              pruneCycles: true,
              strictOutOfSync: false,
            });
          } catch (err) {
            expect((err as OutOfSyncError).message).toBe(
              'Dependency pkg-b@1.0.0 was not found in yarn.lock. Your package.json and yarn.lock are probably out of sync. Please run "yarn install" and try again.',
            );
            expect((err as OutOfSyncError).name).toBe('OutOfSyncError');
          }

          try {
            await parseYarnLockV1Project(pkgJsonContent, yarnLockContent, {
              includeDevDeps: false,
              includeOptionalDeps: true,
              pruneCycles: true,
              strictOutOfSync: true,
            });
          } catch (err) {
            expect((err as OutOfSyncError).message).toBe(
              'Dependency pkg-b@1.0.0 was not found in yarn.lock. Your package.json and yarn.lock are probably out of sync. Please run "yarn install" and try again.',
            );
            expect((err as OutOfSyncError).name).toBe('OutOfSyncError');
          }
        });
      },
    );
  });

  describe('with yarn workspace parser', () => {
    describe.each(['lock-file-deps-out-of-sync', 'top-level-out-of-sync'])(
      '[workspace] project: %s ',
      (fixtureName) => {
        test('matches expected without throwing OutOfSyncError', async () => {
          const rootPkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/package.json`,
            ),
            'utf8',
          );
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/packages/pkg-a/package.json`,
            ),
            'utf8',
          );
          const yarnLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/yarn.lock`,
            ),
            'utf8',
          );

          const depGraphs = await parseYarnLockV1WorkspaceProject(
            yarnLockContent,
            [rootPkgJsonContent, pkgJsonContent],
            {
              includeDevDeps: false,
              includeOptionalDeps: true,
              pruneCycles: true,
              strictOutOfSync: false,
            },
          );
          const expectedDepGraphJson = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/expected.json`,
              ),
              'utf8',
            ),
          );

          const depGraph = depGraphs.filter(
            (g) =>
              !(g.getPkgs().length === 1 && g.getPkgs()[0].name === 'root'),
          )[0];

          const expectedDepGraph = createFromJSON(expectedDepGraphJson);

          expect(depGraph.equals(expectedDepGraph)).toBeTruthy();
        });
      },
    );

    describe.each(['file-as-version', 'file-as-version-no-lock-entry'])(
      '[workspace] project: %s ',
      (fixtureName) => {
        test('creates graph node as per in package.json without throwing OutOfSyncError', async () => {
          const rootPkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/package.json`,
            ),
            'utf8',
          );
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/packages/pkg-a/package.json`,
            ),
            'utf8',
          );
          const yarnLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/yarn.lock`,
            ),
            'utf8',
          );

          const depGraphsAllowOutOfSync = await parseYarnLockV1WorkspaceProject(
            yarnLockContent,
            [rootPkgJsonContent, pkgJsonContent],
            {
              includeDevDeps: false,
              includeOptionalDeps: true,
              pruneCycles: true,
              strictOutOfSync: false,
            },
          );

          const depGraphsStrictOutOfSync =
            await parseYarnLockV1WorkspaceProject(
              yarnLockContent,
              [rootPkgJsonContent, pkgJsonContent],
              {
                includeDevDeps: false,
                includeOptionalDeps: true,
                pruneCycles: true,
                strictOutOfSync: true,
              },
            );

          const expectedDepGraphJson = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/expected.json`,
              ),
              'utf8',
            ),
          );

          const depGraphAllowOutOfSync = depGraphsAllowOutOfSync.filter(
            (g) =>
              !(g.getPkgs().length === 1 && g.getPkgs()[0].name === 'root'),
          )[0];
          const depGraphStrictOutOfSync = depGraphsStrictOutOfSync.filter(
            (g) =>
              !(g.getPkgs().length === 1 && g.getPkgs()[0].name === 'root'),
          )[0];

          const expectedDepGraph = createFromJSON(expectedDepGraphJson);

          expect(depGraphAllowOutOfSync.equals(expectedDepGraph)).toBeTruthy();
          expect(depGraphStrictOutOfSync.equals(expectedDepGraph)).toBeTruthy();
        });
      },
    );

    describe.each(['cross-ref-invalid', 'cross-ref-valid'])(
      '[workspace] project: %s ',
      (fixtureName) => {
        test('throws OutOfSyncError whether cross ref is valid or not', async () => {
          const rootPkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/package.json`,
            ),
            'utf8',
          );
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/packages/pkg-a/package.json`,
            ),
            'utf8',
          );
          const yarnLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/out-of-sync-workspaces/${fixtureName}/yarn.lock`,
            ),
            'utf8',
          );

          try {
            await parseYarnLockV1WorkspaceProject(
              yarnLockContent,
              [rootPkgJsonContent, pkgJsonContent],
              {
                includeDevDeps: false,
                includeOptionalDeps: true,
                pruneCycles: true,
                strictOutOfSync: false,
              },
            );
          } catch (err) {
            expect((err as OutOfSyncError).message).toBe(
              'Dependency pkg-b@1.0.0 was not found in yarn.lock. Your package.json and yarn.lock are probably out of sync. Please run "yarn install" and try again.',
            );
            expect((err as OutOfSyncError).name).toBe('OutOfSyncError');
          }

          try {
            await parseYarnLockV1WorkspaceProject(
              yarnLockContent,
              [rootPkgJsonContent, pkgJsonContent],
              {
                includeDevDeps: false,
                includeOptionalDeps: true,
                pruneCycles: true,
                strictOutOfSync: true,
              },
            );
          } catch (err) {
            expect((err as OutOfSyncError).message).toBe(
              'Dependency pkg-b@1.0.0 was not found in yarn.lock. Your package.json and yarn.lock are probably out of sync. Please run "yarn install" and try again.',
            );
            expect((err as OutOfSyncError).name).toBe('OutOfSyncError');
          }
        });
      },
    );
  });
});
