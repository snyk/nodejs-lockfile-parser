import { DepGraphBuilder } from '@snyk/dep-graph';
import { addPkgNodeToGraph, getTopLevelDeps, PkgNode } from '../util';
import type { DepGraphBuildOptions } from '../types';
import type { NormalisedPkgs, PackageJsonBase } from '../types';
import { getYarnLockV2ChildNode } from './utils';
import { eventLoopSpinner } from 'event-loop-spinner';

export const buildDepGraphYarnLockV2Simple = async (
  extractedYarnLockV2Pkgs: NormalisedPkgs,
  pkgJson: PackageJsonBase,
  options: DepGraphBuildOptions,
) => {
  const { includeDevDeps, strictOutOfSync, includeOptionalDeps } = options;

  const depGraphBuilder = new DepGraphBuilder(
    { name: 'yarn' },
    { name: pkgJson.name, version: pkgJson.version },
  );

  const visitedMap: Set<string> = new Set();

  const topLevelDeps = getTopLevelDeps(pkgJson, {
    includeDevDeps,
  });

  const rootNode: PkgNode = {
    id: 'root-node',
    name: pkgJson.name,
    version: pkgJson.version,
    dependencies: topLevelDeps,
    isDev: false,
  };

  await dfsVisit(
    depGraphBuilder,
    rootNode,
    visitedMap,
    extractedYarnLockV2Pkgs,
    strictOutOfSync,
    includeOptionalDeps,
    pkgJson.resolutions || {},
  );

  return depGraphBuilder.build();
};

/**
 * Use DFS to add all nodes and edges to the depGraphBuilder and prune cyclic nodes.
 * The visitedMap keep track of which nodes have already been discovered during traversal.
 *  - If a node doesn't exist in the map, it means it hasn't been visited.
 *  - If a node is already visited, simply connect the new node with this node.
 */
const dfsVisit = async (
  depGraphBuilder: DepGraphBuilder,
  node: PkgNode,
  visitedMap: Set<string>,
  extractedYarnLockV2Pkgs: NormalisedPkgs,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
  resolutions: Record<string, string>,
): Promise<void> => {
  visitedMap.add(node.id);

  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }

    const childNode = getYarnLockV2ChildNode(
      name,
      depInfo,
      extractedYarnLockV2Pkgs,
      strictOutOfSync,
      includeOptionalDeps,
      resolutions,
      node,
    );

    if (!visitedMap.has(childNode.id)) {
      addPkgNodeToGraph(depGraphBuilder, childNode, {});
      await dfsVisit(
        depGraphBuilder,
        childNode,
        visitedMap,
        extractedYarnLockV2Pkgs,
        strictOutOfSync,
        includeOptionalDeps,
        resolutions,
      );
    }

    depGraphBuilder.connectDep(node.id, childNode.id);
  }
};
