import { extractPkgsFromYarnLockV2 } from './extract-yarnlock-v2-pkgs';
import { parsePkgJson } from '../util';
import {
  PackageJsonBase,
  YarnLockV2ProjectParseOptions,
  YarnLockV2WorkspaceArgs,
} from '../types';
import { buildDepGraphYarnLockV2Simple } from './build-depgraph-simple';
import { DepGraph } from '@snyk/dep-graph';

export const parseYarnLockV2Project = async (
  pkgJsonContent: string,
  yarnLockContent: string,
  options: YarnLockV2ProjectParseOptions,
  workspaceArgs?: YarnLockV2WorkspaceArgs,
): Promise<DepGraph> => {
  const {
    includeDevDeps,
    includeOptionalDeps,
    strictOutOfSync,
    pruneWithinTopLevelDeps,
  } = options;

  const pkgs = extractPkgsFromYarnLockV2(yarnLockContent);

  const pkgJson: PackageJsonBase = parsePkgJson(pkgJsonContent);

  const depgraph = await buildDepGraphYarnLockV2Simple(
    pkgs,
    pkgJson,
    {
      includeDevDeps,
      strictOutOfSync,
      includeOptionalDeps,
      pruneWithinTopLevelDeps,
    },
    workspaceArgs,
  );

  return depgraph;
};
