import { DepGraphBuilder } from '@snyk/dep-graph';
import { getTopLevelDeps, PkgNode } from '../util';
import type {
  YarnLockV2ProjectParseOptions,
  YarnLockV2WorkspaceArgs,
} from '../types';
import type { NormalisedPkgs, PackageJsonBase } from '../types';
import { getYarnLockV2ChildNode } from './utils';
import { eventLoopSpinner } from 'event-loop-spinner';

export const buildDepGraphYarnLockV2Simple = async (
  extractedYarnLockV2Pkgs: NormalisedPkgs,
  pkgJson: PackageJsonBase,
  options: YarnLockV2ProjectParseOptions,
  workspaceArgs?: YarnLockV2WorkspaceArgs,
) => {
  const {
    includeDevDeps,
    strictOutOfSync,
    includeOptionalDeps,
    pruneWithinTopLevelDeps,
  } = options;

  const depGraphBuilder = new DepGraphBuilder(
    { name: 'yarn' },
    { name: pkgJson.name, version: pkgJson.version },
  );

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
    extractedYarnLockV2Pkgs,
    strictOutOfSync,
    includeOptionalDeps,
    // we have rootWorkspaceResolutions if this is workspace pkg with resolutions
    // at root - therefore it should take precedent
    workspaceArgs?.rootResolutions || pkgJson.resolutions || {},
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
  extractedYarnLockV2Pkgs: NormalisedPkgs,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
  resolutions: Record<string, string>,
  pruneWithinTopLevel: boolean,
  visited?: Set<string>,
): Promise<void> => {
  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }

    const localVisited = visited || new Set<string>();

    const childNode = getYarnLockV2ChildNode(
      name,
      depInfo,
      extractedYarnLockV2Pkgs,
      strictOutOfSync,
      includeOptionalDeps,
      resolutions,
      node,
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
      extractedYarnLockV2Pkgs,
      strictOutOfSync,
      includeOptionalDeps,
      resolutions,
      pruneWithinTopLevel,
      localVisited,
    );
  }
};
