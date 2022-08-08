import { DepGraphBuilder } from '@snyk/dep-graph';
import { PackageJsonBase } from '../types';
import {
  addPkgNodeToGraph,
  getGraphDependencies,
  getTopLevelDeps,
  PkgNode,
} from '../util';

enum Color {
  GRAY,
  BLACK,
}

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

  const rootNode: PkgNode = {
    id: 'root-node',
    name: pkgJson.name,
    version: pkgJson.version,
    dependencies: topLevelDeps,
    isDev: false,
  };

  dfsVisit(depGraphBuilder, rootNode, colorMap, extractedYarnLockV1Pkgs);

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
  depGraphBuilder: DepGraphBuilder,
  node: PkgNode,
  colorMap: Record<string, Color>,
  extractedYarnLockV1Pkgs: Record<
    string,
    {
      version: string;
      dependencies: Record<string, string>;
    }
  >,
): void => {
  colorMap[node.id] = Color.GRAY;

  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
    const depData = extractedYarnLockV1Pkgs[`${name}@${depInfo.version}`];

    const childNode: PkgNode = {
      id: `${name}@${depData.version}`,
      name: name,
      version: depData.version,
      dependencies: getGraphDependencies(depData.dependencies, depInfo.isDev),
      isDev: depInfo.isDev,
    };

    if (!colorMap.hasOwnProperty(childNode.id)) {
      addPkgNodeToGraph(depGraphBuilder, childNode, false);
      dfsVisit(depGraphBuilder, childNode, colorMap, extractedYarnLockV1Pkgs);
    } else if (colorMap[childNode.id] === Color.GRAY) {
      // cycle detected
      childNode.id = `${childNode.id}|1`;
      addPkgNodeToGraph(depGraphBuilder, childNode, true);
    }

    depGraphBuilder.connectDep(node.id, childNode.id);
  }

  colorMap[node.id] = Color.BLACK;
};
