import { DepGraphBuilder } from '@snyk/dep-graph';
import {
  createNodeInfo,
  getTopLevelDeps,
  isDevPreferringProd,
  PkgNode,
} from '../util';
import type {
  YarnLockV2ProjectParseOptions,
  YarnLockV2WorkspaceArgs,
} from '../types';
import type { NormalisedPkgs, PackageJsonBase } from '../types';
import { getYarnLockV2ChildNode } from './utils';
import { eventLoopSpinner } from 'event-loop-spinner';
import { parseNpmAlias } from '../../aliasesPreprocessors/pkgJson';

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
    showNpmScope,
  } = options;

  const depGraphBuilder = new DepGraphBuilder(
    { name: 'yarn' },
    { name: pkgJson.name, version: pkgJson.version },
    createNodeInfo(options),
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
    undefined,
    showNpmScope,
    includeDevDeps,
    workspaceArgs?.workspacePackages,
    new Set<string>(),
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
  showNpmScope?: boolean,
  includeDevDeps = false,
  workspacePackages?: YarnLockV2WorkspaceArgs['workspacePackages'],
  prodNodeIds: Set<string> = new Set<string>(),
): Promise<void> => {
  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
    let scopeDepInfo = depInfo;
    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }

    if (
      depInfo.version.startsWith('npm:') &&
      depInfo.version.indexOf('@') > -1
    ) {
      const parsed = parseNpmAlias(depInfo.version);
      if (parsed && parsed.packageName) {
        scopeDepInfo = {
          ...scopeDepInfo,
          ...{
            alias: {
              aliasName: name,
              aliasTargetDepName: parsed.packageName,
              semver: parsed.version,
              version: null,
            },
          },
        };
      }
    }

    const localVisited = visited || new Set<string>();

    const childNode = getYarnLockV2ChildNode(
      name,
      scopeDepInfo,
      extractedYarnLockV2Pkgs,
      strictOutOfSync,
      includeOptionalDeps,
      resolutions,
      node,
      includeDevDeps,
      workspacePackages,
    );

    // A node first reached through a dev path is walked again when a prod path reaches it,
    // so it and its subtree are relabelled prod. Each node flips at most once.
    const upgradesToProd = !childNode.isDev && !prodNodeIds.has(childNode.id);
    if (localVisited.has(childNode.id) && !upgradesToProd) {
      if (pruneWithinTopLevel) {
        const prunedId = `${childNode.id}:pruned`;
        const prunedIsDev = isDevPreferringProd(
          prodNodeIds,
          prunedId,
          childNode.isDev,
        );
        depGraphBuilder.addPkgNode(
          {
            name: childNode.alias ? childNode.alias.aliasName : childNode.name,
            version: childNode.version,
          },
          prunedId,
          {
            labels: {
              scope: prunedIsDev ? 'dev' : 'prod',
              ...(showNpmScope && {
                'npm:scope': prunedIsDev ? 'dev' : 'prod',
              }),
              pruned: 'true',
              ...(childNode.missingLockFileEntry && {
                missingLockFileEntry: 'true',
              }),
              ...(childNode.alias && {
                alias: `${childNode.alias.aliasName}=>${childNode.alias.aliasTargetDepName}@${childNode.version}`,
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

    const childIsDev = isDevPreferringProd(
      prodNodeIds,
      childNode.id,
      childNode.isDev,
    );
    depGraphBuilder.addPkgNode(
      {
        name: childNode.alias ? childNode.alias.aliasName : childNode.name,
        version: childNode.version,
      },
      childNode.id,
      {
        labels: {
          scope: childIsDev ? 'dev' : 'prod',
          ...(showNpmScope && {
            'npm:scope': childIsDev ? 'dev' : 'prod',
          }),
          ...(childNode.missingLockFileEntry && {
            missingLockFileEntry: 'true',
          }),
          ...(childNode.alias && {
            alias: `${childNode.alias.aliasName}=>${childNode.alias.aliasTargetDepName}@${childNode.version}`,
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
      showNpmScope,
      includeDevDeps,
      workspacePackages,
      prodNodeIds,
    );
  }
};
