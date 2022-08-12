import { DepGraphBuilder } from '@snyk/dep-graph';
import {
  addPkgNodeToGraph,
  getGraphDependencies,
  getTopLevelDeps,
  PkgNode,
} from '../util';

import type { PackageJsonBase } from '../types';
import type { YarnLockPackages } from './types';

export const buildDepGraphYarnLockV1Simple = (
  extractedYarnLockV1Pkgs: YarnLockPackages,
  pkgJson: PackageJsonBase,
  options: { includeDevDeps: boolean },
) => {
  const depGraphBuilder = new DepGraphBuilder(
    { name: 'yarn' },
    { name: pkgJson.name, version: pkgJson.version },
  );

  const visitedMap: Set<string> = new Set();

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

  dfsVisit(depGraphBuilder, rootNode, visitedMap, extractedYarnLockV1Pkgs);

  return depGraphBuilder.build();
};

/**
 * Use DFS to add all nodes and edges to the depGraphBuilder and prune cyclic nodes.
 * The visitedMap keep track of which nodes have already been discovered during traversal.
 *  - If a node doesn't exist in the map, it means it hasn't been visited.
 *  - If a node is already visited, simply connect the new node with this node.
 */
const dfsVisit = (
  depGraphBuilder: DepGraphBuilder,
  node: PkgNode,
  visitedMap: Set<string>,
  extractedYarnLockV1Pkgs: YarnLockPackages,
): void => {
  visitedMap.add(node.id);

  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
    const depData = extractedYarnLockV1Pkgs[`${name}@${depInfo.version}`];

    const childNode: PkgNode = {
      id: `${name}@${depData.version}`,
      name: name,
      version: depData.version,
      dependencies: getGraphDependencies(depData.dependencies, depInfo.isDev),
      isDev: depInfo.isDev,
    };

    if (!visitedMap.has(childNode.id)) {
      addPkgNodeToGraph(depGraphBuilder, childNode, { isCyclic: false });
      dfsVisit(depGraphBuilder, childNode, visitedMap, extractedYarnLockV1Pkgs);
    }

    depGraphBuilder.connectDep(node.id, childNode.id);
  }
};
