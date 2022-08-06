import { DepGraphBuilder } from '@snyk/dep-graph';
import { PackageJsonBase } from '../types';

enum Color {
  GRAY,
  BLACK,
}

type Node = {
  id: string;
  name: string;
  version: string;
  dependencies: Record<string, { version: string; isDev: boolean }>;
  isDev: boolean;
};

export const buildDepGraphYarnLockV1Simple = (
  extractedYarnLockV1Pkgs: Record<
    string,
    {
      version: string;
      dependencies: Record<string, string>;
    }
  >,
  pkgJson: PackageJsonBase,
  options: { includeDevDeps: boolean },
) => {
  const depGraphBuilder = new DepGraphBuilder(
    { name: 'yarn' },
    { name: pkgJson.name, version: pkgJson.version },
  );

  const colorMap: Record<string, Color> = {};

  const topLevelDeps = getTopLevelDeps(pkgJson, {
    includeDevDeps: options.includeDevDeps,
  });
  const rootNode = {
    id: 'root-node',
    name: pkgJson.name,
    version: pkgJson.version,
    dependencies: topLevelDeps,
    isDev: false,
  };

  dfsVisit(rootNode, colorMap, extractedYarnLockV1Pkgs, depGraphBuilder);

  return depGraphBuilder.build();
};

/**
 * Use DFS to add all nodes and edges to the depGraphBuilder and prune cyclic nodes.
 * The colorMap keep track of the state of node during traversal.
 *  - If a node doesn't exist in the map, it means it hasn't been visited.
 *  - If a node is GRAY, it means it has already been discovered but its subtree hasn't been fully traversed.
 *  - If a node is BLACK, it means its subtree has already been fully traversed.
 *  - When first exploring an edge, if it points to a GRAY node, a cycle is found and the GRAY node is pruned.
 *     - A pruned node has id `${originalId}|1`
 */
const dfsVisit = (
  node: Node,
  colorMap: Record<string, Color>,
  extractedYarnLockV1Pkgs: Record<
    string,
    {
      version: string;
      dependencies: Record<string, string>;
    }
  >,
  depGraphBuilder: DepGraphBuilder,
): void => {
  colorMap[node.id] = Color.GRAY;

  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
    const depData = extractedYarnLockV1Pkgs[`${name}@${depInfo.version}`];

    const childNode: Node = {
      id: `${name}@${depData.version}`,
      name: name,
      version: depData.version,
      dependencies: getGraphDependencies(depData.dependencies, depInfo.isDev),
      isDev: depInfo.isDev,
    };

    if (!colorMap.hasOwnProperty(childNode.id)) {
      addPkgNodeToGraph(childNode, false, depGraphBuilder);
      dfsVisit(childNode, colorMap, extractedYarnLockV1Pkgs, depGraphBuilder);
    } else if (colorMap[childNode.id] === Color.GRAY) {
      // cycle detected
      childNode.id = `${childNode.id}|1`;
      addPkgNodeToGraph(childNode, true, depGraphBuilder);
    }

    depGraphBuilder.connectDep(node.id, childNode.id);
  }

  colorMap[node.id] = Color.BLACK;
};

/**
 * Get top level dependencies from the given package json object which is parsed from a package.json file.
 * This includes both prod dependencies and dev dependencies supposing includeDevDeps is supported.
 */
const getTopLevelDeps = (
  pkgJson: PackageJsonBase,
  options: { includeDevDeps: boolean },
): Record<string, { version: string; isDev: boolean }> => {
  const prodDeps = getGraphDependencies(pkgJson.dependencies || {}, false);

  const devDeps = options.includeDevDeps
    ? getGraphDependencies(pkgJson.devDependencies || {}, true)
    : {};

  return { ...prodDeps, ...devDeps };
};

/**
 * Converts dependencies parsed from the yarn.lock file to a dependencies object required by the graph.
 * For example, { 'mime-db': '~1.12.0' } will be converted to { 'mime-db': { version: '~1.12.0', isDev: true/false } }.
 */
const getGraphDependencies = (dependencies: Record<string, string>, isDev) => {
  return Object.entries(dependencies).reduce(
    (
      acc: Record<string, { version: string; isDev: boolean }>,
      [name, semver],
    ) => {
      acc[name] = { version: semver, isDev: isDev };
      return acc;
    },
    {},
  );
};

const addPkgNodeToGraph = (
  node: Node,
  isCyclic: boolean,
  depGraphBuilder: DepGraphBuilder,
): void => {
  depGraphBuilder.addPkgNode(
    { name: node.name, version: node.version },
    node.id,
    {
      labels: {
        scope: node.isDev ? 'dev' : 'prod',
        ...(isCyclic && { pruned: 'cyclic' }),
      },
    },
  );
};
