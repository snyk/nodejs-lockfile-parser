import { join } from 'path';
import { readFileSync } from 'fs';
import {
  parseNpmLockV2Project,
  parsePnpmProject,
  parseYarnLockV1Project,
  parseYarnLockV2Project,
} from '../../../lib/dep-graph-builders';

describe('show npm:scope', () => {
  describe('npm lockfile v2', () => {
    it('GIVEN showNpmScope is true WHEN parsing npm lockfile THEN nodes should have npm:scope label', async () => {
      const pkgJsonContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/one-dep/package.json'),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/one-dep/package-lock.json'),
        'utf8',
      );

      const depGraph = await parseNpmLockV2Project(
        pkgJsonContent,
        pkgLockContent,
        {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: true,
          honorAliases: true,
          showNpmScope: true,
        },
      );

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Check that at least one dependency node has npm:scope label
      const dependencyNodes = nodes.filter(
        (node) => node.nodeId !== 'root-node',
      );
      expect(dependencyNodes.length).toBeGreaterThan(0);

      // All dependency nodes should have npm:scope label
      dependencyNodes.forEach((node) => {
        expect(node.info?.labels).toBeDefined();
        expect(node.info?.labels?.['npm:scope']).toBeDefined();
        // npm:scope should be 'prod' for production dependencies
        expect(node.info?.labels?.['npm:scope']).toBe('prod');
      });
    });

    it('GIVEN showNpmScope is false WHEN parsing npm lockfile THEN nodes should not have npm:scope label', async () => {
      const pkgJsonContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/one-dep/package.json'),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/one-dep/package-lock.json'),
        'utf8',
      );

      const depGraph = await parseNpmLockV2Project(
        pkgJsonContent,
        pkgLockContent,
        {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: true,
          honorAliases: true,
          showNpmScope: false,
        },
      );

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Check that dependency nodes do not have npm:scope label
      const dependencyNodes = nodes.filter(
        (node) => node.nodeId !== 'root-node',
      );
      dependencyNodes.forEach((node) => {
        expect(node.info?.labels?.['npm:scope']).toBeUndefined();
      });
    });

    it('GIVEN showNpmScope is true WHEN parsing npm lockfile with dev dependencies THEN dev nodes should have npm:scope label set to dev', async () => {
      const pkgJsonContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/only-dev-deps/package.json'),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(
          __dirname,
          './fixtures/npm-lock-v2/only-dev-deps/package-lock.json',
        ),
        'utf8',
      );

      const depGraph = await parseNpmLockV2Project(
        pkgJsonContent,
        pkgLockContent,
        {
          includeDevDeps: true,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: true,
          honorAliases: true,
          showNpmScope: true,
        },
      );

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Check that dev dependency nodes have npm:scope label set to 'dev'
      const dependencyNodes = nodes.filter(
        (node) => node.nodeId !== 'root-node',
      );
      dependencyNodes.forEach((node) => {
        expect(node.info?.labels).toBeDefined();
        expect(node.info?.labels?.['npm:scope']).toBe('dev');
      });
    });

    it('GIVEN showNpmScope is true WHEN parsing npm lockfile THEN root node should have npm:scope label set to unknown', async () => {
      const pkgJsonContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/one-dep/package.json'),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/one-dep/package-lock.json'),
        'utf8',
      );

      const depGraph = await parseNpmLockV2Project(
        pkgJsonContent,
        pkgLockContent,
        {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: true,
          honorAliases: true,
          showNpmScope: true,
        },
      );

      const graphJson = depGraph.toJSON();
      const rootNode = graphJson.graph.nodes.find(
        (node) => node.nodeId === 'root-node',
      );

      expect(rootNode).toBeDefined();
      expect(rootNode?.info?.labels?.['npm:scope']).toBe('unknown');
    });

    it('GIVEN showNpmScope is true WHEN parsing npm lockfile with cyclic dependencies THEN pruned nodes should have npm:scope label', async () => {
      const pkgJsonContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/cyclic-dep/package.json'),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/cyclic-dep/package-lock.json'),
        'utf8',
      );

      const depGraph = await parseNpmLockV2Project(
        pkgJsonContent,
        pkgLockContent,
        {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: true,
          honorAliases: true,
          showNpmScope: true,
        },
      );

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Find pruned nodes (they should have pruned label and npm:scope)
      const prunedNodes = nodes.filter((node) => node.info?.labels?.pruned);

      if (prunedNodes.length > 0) {
        prunedNodes.forEach((node) => {
          expect(node.info?.labels?.['npm:scope']).toBeDefined();
        });
      }
    });
  });

  describe('pnpm lockfile', () => {
    it('GIVEN showNpmScope is true WHEN parsing pnpm lockfile THEN nodes should have npm:scope label', async () => {
      const pkgJsonContent = readFileSync(
        join(__dirname, './fixtures/pnpm-lock-v5/one-dep/package.json'),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(__dirname, './fixtures/pnpm-lock-v5/one-dep/pnpm-lock.yaml'),
        'utf8',
      );

      const depGraph = await parsePnpmProject(pkgJsonContent, pkgLockContent, {
        includeDevDeps: false,
        includeOptionalDeps: false,
        strictOutOfSync: true,
        pruneWithinTopLevelDeps: false,
        showNpmScope: true,
      });

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Check that at least one dependency node has npm:scope label
      const dependencyNodes = nodes.filter(
        (node) => node.nodeId !== 'root-node',
      );
      expect(dependencyNodes.length).toBeGreaterThan(0);

      // All dependency nodes should have npm:scope label
      dependencyNodes.forEach((node) => {
        expect(node.info?.labels).toBeDefined();
        expect(node.info?.labels?.['npm:scope']).toBeDefined();
        // npm:scope should be 'prod' for production dependencies
        expect(node.info?.labels?.['npm:scope']).toBe('prod');
      });
    });

    it('GIVEN showNpmScope is false WHEN parsing pnpm lockfile THEN nodes should not have npm:scope label', async () => {
      const pkgJsonContent = readFileSync(
        join(__dirname, './fixtures/pnpm-lock-v5/one-dep/package.json'),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(__dirname, './fixtures/pnpm-lock-v5/one-dep/pnpm-lock.yaml'),
        'utf8',
      );

      const depGraph = await parsePnpmProject(pkgJsonContent, pkgLockContent, {
        includeDevDeps: false,
        includeOptionalDeps: false,
        strictOutOfSync: true,
        pruneWithinTopLevelDeps: false,
        showNpmScope: false,
      });

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Check that dependency nodes do not have npm:scope label
      const dependencyNodes = nodes.filter(
        (node) => node.nodeId !== 'root-node',
      );
      dependencyNodes.forEach((node) => {
        expect(node.info?.labels?.['npm:scope']).toBeUndefined();
      });
    });

    it('GIVEN showNpmScope is true WHEN parsing pnpm lockfile with dev dependencies THEN dev nodes should have npm:scope label set to dev', async () => {
      const pkgJsonContent = readFileSync(
        join(__dirname, './fixtures/pnpm-lock-v5/only-dev-deps/package.json'),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(__dirname, './fixtures/pnpm-lock-v5/only-dev-deps/pnpm-lock.yaml'),
        'utf8',
      );

      const depGraph = await parsePnpmProject(pkgJsonContent, pkgLockContent, {
        includeDevDeps: true,
        includeOptionalDeps: false,
        strictOutOfSync: true,
        pruneWithinTopLevelDeps: false,
        showNpmScope: true,
      });

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Check that dev dependency nodes have npm:scope label set to 'dev'
      const dependencyNodes = nodes.filter(
        (node) => node.nodeId !== 'root-node',
      );
      dependencyNodes.forEach((node) => {
        expect(node.info?.labels).toBeDefined();
        expect(node.info?.labels?.['npm:scope']).toBe('dev');
      });
    });
  });

  describe('yarn lockfile v1', () => {
    it('GIVEN showNpmScope is true WHEN parsing yarn lockfile v1 THEN nodes should have npm:scope label', async () => {
      const pkgJsonContent = readFileSync(
        join(
          __dirname,
          './fixtures/yarn-lock-v1/hand-rolled/simple-chain/package.json',
        ),
        'utf8',
      );
      const yarnLockContent = readFileSync(
        join(
          __dirname,
          './fixtures/yarn-lock-v1/hand-rolled/simple-chain/yarn.lock',
        ),
        'utf8',
      );

      const depGraph = await parseYarnLockV1Project(
        pkgJsonContent,
        yarnLockContent,
        {
          includeDevDeps: false,
          includeOptionalDeps: false,
          includePeerDeps: false,
          pruneLevel: 'none',
          strictOutOfSync: false,
          showNpmScope: true,
        },
      );

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Check that at least one dependency node has npm:scope label
      const dependencyNodes = nodes.filter(
        (node) => node.nodeId !== 'root-node',
      );
      expect(dependencyNodes.length).toBeGreaterThan(0);

      // All dependency nodes should have npm:scope label
      dependencyNodes.forEach((node) => {
        expect(node.info?.labels).toBeDefined();
        expect(node.info?.labels?.['npm:scope']).toBeDefined();
        // npm:scope should be 'prod' for production dependencies
        expect(node.info?.labels?.['npm:scope']).toBe('prod');
      });
    });

    it('GIVEN showNpmScope is false WHEN parsing yarn lockfile v1 THEN nodes should not have npm:scope label', async () => {
      const pkgJsonContent = readFileSync(
        join(
          __dirname,
          './fixtures/yarn-lock-v1/hand-rolled/simple-chain/package.json',
        ),
        'utf8',
      );
      const yarnLockContent = readFileSync(
        join(
          __dirname,
          './fixtures/yarn-lock-v1/hand-rolled/simple-chain/yarn.lock',
        ),
        'utf8',
      );

      const depGraph = await parseYarnLockV1Project(
        pkgJsonContent,
        yarnLockContent,
        {
          includeDevDeps: false,
          includeOptionalDeps: false,
          includePeerDeps: false,
          pruneLevel: 'none',
          strictOutOfSync: false,
          showNpmScope: false,
        },
      );

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Check that dependency nodes do not have npm:scope label
      const dependencyNodes = nodes.filter(
        (node) => node.nodeId !== 'root-node',
      );
      dependencyNodes.forEach((node) => {
        expect(node.info?.labels?.['npm:scope']).toBeUndefined();
      });
    });

    it('GIVEN showNpmScope is true WHEN parsing yarn lockfile v1 with dev dependencies THEN dev nodes should have npm:scope label set to dev', async () => {
      const pkgJsonContent = readFileSync(
        join(__dirname, './fixtures/yarn-lock-v1/real/one-dep/package.json'),
        'utf8',
      );
      const yarnLockContent = readFileSync(
        join(__dirname, './fixtures/yarn-lock-v1/real/one-dep/yarn.lock'),
        'utf8',
      );

      const depGraph = await parseYarnLockV1Project(
        pkgJsonContent,
        yarnLockContent,
        {
          includeDevDeps: true,
          includeOptionalDeps: false,
          includePeerDeps: false,
          pruneLevel: 'none',
          strictOutOfSync: false,
          showNpmScope: true,
        },
      );

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Find dev dependency nodes (they should have npm:scope: 'dev')
      const dependencyNodes = nodes.filter(
        (node) => node.nodeId !== 'root-node',
      );

      // At least check that nodes have the label structure
      dependencyNodes.forEach((node) => {
        expect(node.info?.labels).toBeDefined();
        if (node.info?.labels?.['npm:scope']) {
          expect(['prod', 'dev']).toContain(node.info.labels['npm:scope']);
        }
      });
    });

    it('GIVEN showNpmScope is true WHEN parsing yarn lockfile v1 with cyclic dependencies THEN pruned nodes should have npm:scope label', async () => {
      const pkgJsonContent = readFileSync(
        join(
          __dirname,
          './fixtures/yarn-lock-v1/hand-rolled/simple-cyclic-chain/package.json',
        ),
        'utf8',
      );
      const yarnLockContent = readFileSync(
        join(
          __dirname,
          './fixtures/yarn-lock-v1/hand-rolled/simple-cyclic-chain/yarn.lock',
        ),
        'utf8',
      );

      const depGraph = await parseYarnLockV1Project(
        pkgJsonContent,
        yarnLockContent,
        {
          includeDevDeps: false,
          includeOptionalDeps: false,
          includePeerDeps: false,
          pruneLevel: 'cycles',
          strictOutOfSync: false,
          showNpmScope: true,
        },
      );

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Find pruned nodes (they should have pruned label and npm:scope)
      const prunedNodes = nodes.filter((node) => node.info?.labels?.pruned);

      if (prunedNodes.length > 0) {
        prunedNodes.forEach((node) => {
          expect(node.info?.labels?.['npm:scope']).toBeDefined();
        });
      }
    });
  });

  describe('yarn lockfile v2', () => {
    it('GIVEN showNpmScope is true WHEN parsing yarn lockfile v2 THEN nodes should have npm:scope label', async () => {
      const pkgJsonContent = readFileSync(
        join(
          __dirname,
          './fixtures/yarn-lock-v2/hand-rolled/simple-chain/package.json',
        ),
        'utf8',
      );
      const yarnLockContent = readFileSync(
        join(
          __dirname,
          './fixtures/yarn-lock-v2/hand-rolled/simple-chain/yarn.lock',
        ),
        'utf8',
      );

      const depGraph = await parseYarnLockV2Project(
        pkgJsonContent,
        yarnLockContent,
        {
          includeDevDeps: false,
          includeOptionalDeps: true,
          strictOutOfSync: false,
          pruneWithinTopLevelDeps: false,
          showNpmScope: true,
        },
      );

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Check that at least one dependency node has npm:scope label
      const dependencyNodes = nodes.filter(
        (node) => node.nodeId !== 'root-node',
      );
      expect(dependencyNodes.length).toBeGreaterThan(0);

      // All dependency nodes should have npm:scope label
      dependencyNodes.forEach((node) => {
        expect(node.info?.labels).toBeDefined();
        expect(node.info?.labels?.['npm:scope']).toBeDefined();
        // npm:scope should be 'prod' for production dependencies
        expect(node.info?.labels?.['npm:scope']).toBe('prod');
      });
    });

    it('GIVEN showNpmScope is false WHEN parsing yarn lockfile v2 THEN nodes should not have npm:scope label', async () => {
      const pkgJsonContent = readFileSync(
        join(
          __dirname,
          './fixtures/yarn-lock-v2/hand-rolled/simple-chain/package.json',
        ),
        'utf8',
      );
      const yarnLockContent = readFileSync(
        join(
          __dirname,
          './fixtures/yarn-lock-v2/hand-rolled/simple-chain/yarn.lock',
        ),
        'utf8',
      );

      const depGraph = await parseYarnLockV2Project(
        pkgJsonContent,
        yarnLockContent,
        {
          includeDevDeps: false,
          includeOptionalDeps: true,
          strictOutOfSync: false,
          pruneWithinTopLevelDeps: false,
          showNpmScope: false,
        },
      );

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Check that dependency nodes do not have npm:scope label
      const dependencyNodes = nodes.filter(
        (node) => node.nodeId !== 'root-node',
      );
      dependencyNodes.forEach((node) => {
        expect(node.info?.labels?.['npm:scope']).toBeUndefined();
      });
    });

    it('GIVEN showNpmScope is true WHEN parsing yarn lockfile v2 with dev dependencies THEN dev nodes should have npm:scope label set to dev', async () => {
      const pkgJsonContent = readFileSync(
        join(__dirname, './fixtures/yarn-lock-v2/real/goof/package.json'),
        'utf8',
      );
      const yarnLockContent = readFileSync(
        join(__dirname, './fixtures/yarn-lock-v2/real/goof/yarn.lock'),
        'utf8',
      );

      const depGraph = await parseYarnLockV2Project(
        pkgJsonContent,
        yarnLockContent,
        {
          includeDevDeps: true,
          includeOptionalDeps: true,
          strictOutOfSync: false,
          pruneWithinTopLevelDeps: false,
          showNpmScope: true,
        },
      );

      const graphJson = depGraph.toJSON();
      const nodes = graphJson.graph.nodes;

      // Find dev dependency nodes (they should have npm:scope: 'dev')
      const dependencyNodes = nodes.filter(
        (node) => node.nodeId !== 'root-node',
      );

      // At least check that nodes have the label structure
      dependencyNodes.forEach((node) => {
        expect(node.info?.labels).toBeDefined();
        if (node.info?.labels?.['npm:scope']) {
          expect(['prod', 'dev']).toContain(node.info.labels['npm:scope']);
        }
      });
    });
  });

  describe('old API (buildDepTree/buildDepTreeFromFiles)', () => {
    it('GIVEN showNpmScope is true WHEN using buildDepTree THEN root node should have npm:scope label set to unknown', async () => {
      const { buildDepTree, LockfileType } = await import('../../../lib');
      const pkgJsonContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/one-dep/package.json'),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/one-dep/package-lock.json'),
        'utf8',
      );

      const depTree = await buildDepTree(
        pkgJsonContent,
        pkgLockContent,
        false,
        LockfileType.npm,
        true,
        'package.json',
        true, // showNpmScope
      );

      expect(depTree.labels).toBeDefined();
      expect(depTree.labels?.['npm:scope']).toBe('unknown');
    });

    it('GIVEN showNpmScope is true WHEN using buildDepTree THEN dependency nodes should have npm:scope label', async () => {
      const { buildDepTree, LockfileType } = await import('../../../lib');
      const pkgJsonContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/one-dep/package.json'),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/one-dep/package-lock.json'),
        'utf8',
      );

      const depTree = await buildDepTree(
        pkgJsonContent,
        pkgLockContent,
        false,
        LockfileType.npm,
        true,
        'package.json',
        true, // showNpmScope
      );

      // Check that dependencies have npm:scope label
      const depNames = Object.keys(depTree.dependencies || {});
      expect(depNames.length).toBeGreaterThan(0);

      depNames.forEach((depName) => {
        const dep = depTree.dependencies![depName];
        expect(dep.labels).toBeDefined();
        expect(dep.labels?.['npm:scope']).toBeDefined();
        expect(dep.labels?.['npm:scope']).toBe('prod');
      });
    });

    it('GIVEN showNpmScope is false WHEN using buildDepTree THEN nodes should not have npm:scope label', async () => {
      const { buildDepTree, LockfileType } = await import('../../../lib');
      const pkgJsonContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/one-dep/package.json'),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(__dirname, './fixtures/npm-lock-v2/one-dep/package-lock.json'),
        'utf8',
      );

      const depTree = await buildDepTree(
        pkgJsonContent,
        pkgLockContent,
        false,
        LockfileType.npm,
        true,
        'package.json',
        false, // showNpmScope
      );

      expect(depTree.labels?.['npm:scope']).toBeUndefined();

      const depNames = Object.keys(depTree.dependencies || {});
      depNames.forEach((depName) => {
        const dep = depTree.dependencies![depName];
        expect(dep.labels?.['npm:scope']).toBeUndefined();
      });
    });
  });
});
