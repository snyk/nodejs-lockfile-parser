import { DepGraphBuilder } from '@snyk/dep-graph';
import { getTopLevelDeps } from '../util';
import type {
  Overrides,
  PnpmProjectParseOptions,
  PnpmWorkspaceArgs,
} from '../types';
import type { PackageJsonBase } from '../types';
import { getPnpmChildNode } from './utils';
import { eventLoopSpinner } from 'event-loop-spinner';
import { PnpmLockfileParser } from './lockfile-parser/lockfile-parser';
import { NormalisedPnpmPkgs, PnpmNode } from './types';

export const buildDepGraphPnpm = async (
  lockFileParser: PnpmLockfileParser,
  pkgJson: PackageJsonBase,
  options: PnpmProjectParseOptions,
  workspaceArgs?: PnpmWorkspaceArgs,
) => {
  const {
    strictOutOfSync,
    includeOptionalDeps,
    includeDevDeps,
    pruneWithinTopLevelDeps,
  } = options;

  const depGraphBuilder = new DepGraphBuilder(
    { name: 'pnpm' },
    { name: pkgJson.name, version: pkgJson.version },
  );

  const extractedPnpmPkgs: NormalisedPnpmPkgs =
    lockFileParser.extractedPackages;

  const topLevelDeps = getTopLevelDeps(pkgJson, options);

  const extractedTopLevelDeps =
    lockFileParser.extractTopLevelDependencies(options) || {};

  for (const name of Object.keys(topLevelDeps)) {
    topLevelDeps[name].version = extractedTopLevelDeps[name].version;
  }

  const rootNode: PnpmNode = {
    id: 'root-node',
    name: pkgJson.name,
    version: pkgJson.version,
    dependencies: topLevelDeps,
    isDev: false,
  };

  await dfsVisit(
    depGraphBuilder,
    rootNode,
    extractedPnpmPkgs,
    strictOutOfSync,
    includeOptionalDeps,
    includeDevDeps,
    // we have rootWorkspaceOverrides if this is workspace pkg with overrides
    // at root - therefore it should take precedent
    // TODO: inspect if this is needed at all, seems like pnpm resolves everything in lockfile
    workspaceArgs?.rootOverrides || pkgJson.pnpm?.overrides || {},
    pruneWithinTopLevelDeps,
    lockFileParser,
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
  node: PnpmNode,
  extractedPnpmPkgs: NormalisedPnpmPkgs,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
  includeDevDeps: boolean,
  overrides: Overrides,
  pruneWithinTopLevel: boolean,
  lockFileParser: PnpmLockfileParser,
  visited?: Set<string>,
): Promise<void> => {
  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }

    const localVisited = visited || new Set<string>();

    const childNode: PnpmNode = getPnpmChildNode(
      name,
      depInfo,
      extractedPnpmPkgs,
      strictOutOfSync,
      includeOptionalDeps,
      includeDevDeps,
      lockFileParser,
    );

    if (localVisited.has(childNode.id)) {
      if (pruneWithinTopLevel) {
        const prunedId = `${childNode.id}:pruned`;
        depGraphBuilder.addPkgNode(
          { name: childNode.name, version: childNode.version },
          prunedId,
          {
            labels: {
              scope: childNode.isDev ? 'dev' : 'prod',
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
          scope: childNode.isDev ? 'dev' : 'prod',
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
      extractedPnpmPkgs,
      strictOutOfSync,
      includeOptionalDeps,
      includeDevDeps,
      overrides,
      pruneWithinTopLevel,
      lockFileParser,
      localVisited,
    );
  }
};
