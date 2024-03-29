import { DepGraphBuilder } from '@snyk/dep-graph';
import { addPkgNodeToGraph, Dependencies, PkgNode } from '../util';
import type { PnpmLockV7ProjectParseOptions } from '../types';
import type { PackageJsonBase } from '../types';
import { eventLoopSpinner } from 'event-loop-spinner';
import { getChildNodePnpmLockV7Workspace } from './utils';
import type { PnpmNormalisedPkgs, PnpmNormalisedProject } from './type';

function mapWorkspaceToNode(
  name: string,
  version: string,
  workspace: PnpmNormalisedPkgs,
): PkgNode {
  const deps: Dependencies = {};
  console.log(`workspace:`, workspace);

  const nodeId = name === '.' ? 'root-node' : name;
  return {
    id: nodeId,
    name,
    version,
    dependencies: deps,
    isDev: false,
  };
}

export const buildDepGraphPnpmLockV7Project = async (
  extractedPnpmLockV7Project: PnpmNormalisedProject,
  pkgJson: PackageJsonBase,
  options: PnpmLockV7ProjectParseOptions,
) => {
  const { includeDevDeps, includeOptionalDeps, strictOutOfSync } = options;

  const depGraphBuilder = new DepGraphBuilder(
    { name: 'pnpm' },
    { name: pkgJson.name, version: pkgJson.version },
  );

  const workspaceNames = Object.keys(extractedPnpmLockV7Project);
  for (const workspaceName of workspaceNames) {
    const workspacePkg = extractedPnpmLockV7Project[workspaceName];
    const workspaceNode = mapWorkspaceToNode(
      pkgJson.name,
      pkgJson.version,
      workspacePkg,
    );

    await dfsVisit(
      depGraphBuilder,
      workspaceNode,
      workspacePkg,
      includeOptionalDeps,
      strictOutOfSync,
    );
  }

  return depGraphBuilder.build();
};

const dfsVisit = async (
  depGraphBuilder: DepGraphBuilder,
  node: PkgNode,
  extractedPnpmLockV7Pkgs: PnpmNormalisedPkgs,
  includeOptionalDeps: boolean,
  strictOutOfSync: boolean,
  visited?: Set<string>,
): Promise<void> => {
  const localVisited = visited || new Set<string>();
  console.log(localVisited);
  console.log(node);
};
