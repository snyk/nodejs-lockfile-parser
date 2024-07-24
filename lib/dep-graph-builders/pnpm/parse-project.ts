import { parsePkgJson } from '../util';
import { PackageJsonBase, PnpmProjectParseOptions } from '../types';
import { buildDepGraphPnpm } from './build-dep-graph-pnpm';
import { DepGraph } from '@snyk/dep-graph';
import { getPnpmLockfileParser } from './lockfile-parser/index';
import { NodeLockfileVersion } from '../../utils';

export const parsePnpmProject = async (
  pkgJsonContent: string,
  pnpmLockContent: string,
  options: PnpmProjectParseOptions,
  lockfileVersion?: NodeLockfileVersion,
): Promise<DepGraph> => {
  const {
    includeDevDeps,
    includePeerDeps,
    includeOptionalDeps,
    strictOutOfSync,
    pruneWithinTopLevelDeps,
  } = options;
  let importer = '';

  const pkgJson: PackageJsonBase = parsePkgJson(pkgJsonContent);

  const lockFileParser = getPnpmLockfileParser(
    pnpmLockContent,
    lockfileVersion,
  );

  // Lockfile V9 simple project has the root importer
  if (lockFileParser.lockFileVersion.startsWith('9')) {
    importer = '.';
  }

  const depgraph = await buildDepGraphPnpm(
    lockFileParser,
    pkgJson,
    {
      includeDevDeps,
      strictOutOfSync,
      includePeerDeps,
      includeOptionalDeps,
      pruneWithinTopLevelDeps,
    },
    importer,
  );

  return depgraph;
};
