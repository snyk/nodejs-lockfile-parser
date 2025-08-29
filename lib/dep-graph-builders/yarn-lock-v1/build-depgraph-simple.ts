import { DepGraphBuilder } from '@snyk/dep-graph';
import { getChildNode, getTopLevelDeps, PkgNode } from '../util';
import type { Yarn1DepGraphBuildOptions } from '../types';
import type { NormalisedPkgs, PackageJsonBase } from '../types';
import { eventLoopSpinner } from 'event-loop-spinner';

export const buildDepGraphYarnLockV1Simple = async (
  extractedYarnLockV1Pkgs: NormalisedPkgs,
  pkgJson: PackageJsonBase,
  options: Yarn1DepGraphBuildOptions,
) => {
  const {
    includeDevDeps,
    includeOptionalDeps,
    includePeerDeps,
    strictOutOfSync,
    pruneWithinTopLevelDeps,
  } = options;

  const depGraphBuilder = new DepGraphBuilder(
    { name: 'yarn' },
    { name: pkgJson.name, version: pkgJson.version },
  );

  const topLevelDeps = getTopLevelDeps(pkgJson, {
    includeDevDeps,
    includePeerDeps,
    includeOptionalDeps,
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
    extractedYarnLockV1Pkgs,
    strictOutOfSync,
    includeOptionalDeps,
    pruneWithinTopLevelDeps,
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
  extractedYarnLockV1Pkgs: NormalisedPkgs,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
  pruneWithinTopLevel: boolean,
  visited?: Set<string>,
): Promise<void> => {
  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
    let scopeDepInfo = Object.assign({}, depInfo);
    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
    const localVisited = visited || new Set<string>();
    if (depInfo.version.startsWith('npm:')) {
      scopeDepInfo = {
        ...scopeDepInfo,
        ...{
          alias: {
            aliasName: name,
            aliasTargetDepName: depInfo.version.substring(
              4,
              depInfo.version.lastIndexOf('@'),
            ),
            semver: depInfo.version.substring(
              depInfo.version.lastIndexOf('@') + 1,
              depInfo.version.length,
            ),
            version: null,
          },
        },
      };
    }
    const childNode = getChildNode(
      name,
      scopeDepInfo,
      extractedYarnLockV1Pkgs,
      strictOutOfSync,
      includeOptionalDeps,
    );

    if (localVisited.has(childNode.id)) {
      if (pruneWithinTopLevel) {
        const prunedId = `${childNode.id}:pruned`;
        depGraphBuilder.addPkgNode(
          { name: childNode.name, version: childNode.version },
          prunedId,
          {
            labels: {
              scope: node.isDev ? 'dev' : 'prod',
              pruned: 'true',
              ...(node.missingLockFileEntry && {
                missingLockFileEntry: 'true',
              }),
            },
          },
        );
        depGraphBuilder.connectDep(node.id, prunedId);
      } else {
        depGraphBuilder.connectDep(node.id, childNode.id);
      }
      continue;
    }

    depGraphBuilder.addPkgNode(
      { name: childNode.name, version: childNode.version },
      childNode.id,
      {
        labels: {
          scope: node.isDev ? 'dev' : 'prod',
          ...(node.missingLockFileEntry && {
            missingLockFileEntry: 'true',
          }),
        },
      },
    );
    depGraphBuilder.connectDep(node.id, childNode.id);
    localVisited.add(childNode.id);
    await dfsVisit(
      depGraphBuilder,
      childNode,
      extractedYarnLockV1Pkgs,
      strictOutOfSync,
      includeOptionalDeps,
      pruneWithinTopLevel,
      localVisited,
    );
  }
};
