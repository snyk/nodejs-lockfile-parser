import { DepGraphBuilder } from '@snyk/dep-graph';
import {
  createNodeInfo,
  getChildNode,
  getTopLevelDeps,
  isDevPreferringProd,
  PkgNode,
} from '../util';
import type { Yarn1DepGraphBuildOptions } from '../types';
import type { NormalisedPkgs, PackageJsonBase } from '../types';
import { eventLoopSpinner } from 'event-loop-spinner';
import { parseNpmAlias } from '../../aliasesPreprocessors/pkgJson';
import { getComponentMetadataLabels } from '../../component-metadata-labels';

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
    showNpmScope,
    includeComponentMetadata,
  } = options;

  const depGraphBuilder = new DepGraphBuilder(
    { name: 'yarn' },
    { name: pkgJson.name, version: pkgJson.version },
    createNodeInfo(options),
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
    undefined,
    showNpmScope,
    includeComponentMetadata,
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
  extractedYarnLockV1Pkgs: NormalisedPkgs,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
  pruneWithinTopLevel: boolean,
  visited?: Set<string>,
  showNpmScope?: boolean,
  includeComponentMetadata?: boolean,
  prodNodeIds: Set<string> = new Set<string>(),
): Promise<void> => {
  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
    let scopeDepInfo = Object.assign({}, depInfo);
    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
    const localVisited = visited || new Set<string>();
    if (depInfo.version.startsWith('npm:')) {
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
    const childNode = getChildNode(
      name,
      scopeDepInfo,
      extractedYarnLockV1Pkgs,
      strictOutOfSync,
      includeOptionalDeps,
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
          { name: childNode.name, version: childNode.version },
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
              ...(includeComponentMetadata &&
                getComponentMetadataLabels(childNode)),
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
      { name: childNode.name, version: childNode.version },
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
          ...(includeComponentMetadata &&
            getComponentMetadataLabels(childNode)),
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
      showNpmScope,
      includeComponentMetadata,
      prodNodeIds,
    );
  }
};
