import { DepGraphBuilder } from '@snyk/dep-graph';
import {
  addPkgNodeToGraph,
  getChildNode,
  getTopLevelDeps,
  PkgNode,
} from '../util';
import type { PackageJsonBase } from '../types';
import type { DepGraphBuildOptions, YarnLockPackages } from './types';

enum Color {
  GRAY,
  BLACK,
}

export const buildDepGraphYarnLockV1SimpleCyclesPruned = (
  extractedYarnLockV1Pkgs: YarnLockPackages,
  pkgJson: PackageJsonBase,
  options: DepGraphBuildOptions,
) => {
  const { includeDevDeps, strictOutOfSync } = options;

  const depGraphBuilder = new DepGraphBuilder(
    { name: 'yarn' },
    { name: pkgJson.name, version: pkgJson.version },
  );

  const colorMap: Record<string, Color> = {};

  const topLevelDeps = getTopLevelDeps(pkgJson, { includeDevDeps });

  const rootNode: PkgNode = {
    id: 'root-node',
    name: pkgJson.name,
    version: pkgJson.version,
    dependencies: topLevelDeps,
    isDev: false,
  };

  dfsVisit(
    depGraphBuilder,
    rootNode,
    colorMap,
    extractedYarnLockV1Pkgs,
    strictOutOfSync,
  );

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
  extractedYarnLockV1Pkgs: YarnLockPackages,
  strictOutOfSync: boolean,
): void => {
  colorMap[node.id] = Color.GRAY;

  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
    const childNode = getChildNode(
      name,
      depInfo,
      extractedYarnLockV1Pkgs,
      strictOutOfSync,
    );

    if (!colorMap.hasOwnProperty(childNode.id)) {
      addPkgNodeToGraph(depGraphBuilder, childNode, {});
      dfsVisit(
        depGraphBuilder,
        childNode,
        colorMap,
        extractedYarnLockV1Pkgs,
        strictOutOfSync,
      );
    } else if (colorMap[childNode.id] === Color.GRAY) {
      // cycle detected
      childNode.id = `${childNode.id}|1`;
      addPkgNodeToGraph(depGraphBuilder, childNode, { isCyclic: true });
    }

    depGraphBuilder.connectDep(node.id, childNode.id);
  }

  colorMap[node.id] = Color.BLACK;
};
