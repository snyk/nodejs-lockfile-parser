import { join } from 'path';
import { readdirSync, readFileSync } from 'fs';

import { parseYarnLockV1WorkspaceProject } from '../../../lib';

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
      { includeDevDeps: false, includeOptionalDeps: true, pruneCycles: true },
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
      { includeDevDeps: false, includeOptionalDeps: true, pruneCycles: true },
    );

    // Standard Checks
    expect(newDepGraphs).toBeTruthy();
    expect(newDepGraphs.length).toBe(3);

    const depGraphsAsJson = newDepGraphs.map((graph) => graph.toJSON());

    // Check if interdependencies handled well
    const pkgAGraphAsJson = depGraphsAsJson.find((graph) => {
      return graph.graph.nodes.find((node) => {
        return node.nodeId === 'root-node' && node.pkgId === 'pkg-a@1.0.0'
          ? true
          : false;
      });
    });
    const pkgBNode = pkgAGraphAsJson?.graph.nodes.find((node) => {
      return node.nodeId === 'pkg-b@1.0.0' && node.pkgId === 'pkg-b@1.0.0'
        ? true
        : false;
    });
    expect(pkgBNode?.deps.length).toBe(0);
    expect(pkgBNode?.info?.labels?.pruned).toBe('true');
  });
});
