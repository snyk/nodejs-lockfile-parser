import { extractPkgsFromPnpmLockV7 } from './extract-pnpmlock-v7-pkgs';
import { parsePkgJson } from '../util';
import { PackageJsonBase, PnpmLockV7ProjectParseOptions } from '../types';
import { buildDepGraphPnpmLockV7Project } from './build-depgraph';
import { DepGraph } from '@snyk/dep-graph';

export const parsePnpmLockV7Project = async (
  pkgJsonContent: string,
  pnpmLockContent: string,
  options: PnpmLockV7ProjectParseOptions,
): Promise<DepGraph> => {
  const {
    includeDevDeps,
    includeOptionalDeps,
    strictOutOfSync,
    pruneWithinTopLevelDeps,
  } = options;

  const pkgs = extractPkgsFromPnpmLockV7(pnpmLockContent);

  const pkgJson: PackageJsonBase = parsePkgJson(pkgJsonContent);

  const depgraph = await buildDepGraphPnpmLockV7Project(pkgs, pkgJson, {
    includeDevDeps,
    includeOptionalDeps,
    strictOutOfSync,
    pruneWithinTopLevelDeps,
  });

  return depgraph;
};
