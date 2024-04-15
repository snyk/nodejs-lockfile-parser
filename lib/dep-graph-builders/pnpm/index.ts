import { parsePkgJson } from '../util';
import {
  PackageJsonBase,
  PnpmProjectParseOptions,
  PnpmWorkspaceArgs,
} from '../types';
import { buildDepGraphPnpm } from './build-dep-graph-pnpm';
import { DepGraph } from '@snyk/dep-graph';
import { getPnpmLockfileParser } from './lockfile-parser/index';
import { PnpmLockfileParser } from './lockfile-parser/lockfile-parser';
import { NodeLockfileVersion } from '../../utils';

export const parsePnpmProject = async (
  pkgJsonContent: string,
  pnpmLockContent: string,
  options: PnpmProjectParseOptions,
  lockfileVersion?: NodeLockfileVersion,
  workspaceArgs?: PnpmWorkspaceArgs,
): Promise<DepGraph> => {
  const {
    includeDevDeps,
    includeOptionalDeps,
    strictOutOfSync,
    pruneWithinTopLevelDeps,
  } = options;

  const pkgJson: PackageJsonBase = parsePkgJson(pkgJsonContent);

  const lockFileParser: PnpmLockfileParser = getPnpmLockfileParser(
    pnpmLockContent,
    lockfileVersion,
    workspaceArgs,
  );

  const depgraph = await buildDepGraphPnpm(
    lockFileParser,
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
