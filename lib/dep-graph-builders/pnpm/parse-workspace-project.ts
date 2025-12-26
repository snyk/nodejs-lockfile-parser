import { parsePkgJson } from '../util';
import { PackageJsonBase, PnpmProjectParseOptions } from '../types';
import { buildDepGraphPnpm } from './build-dep-graph-pnpm';
import { DepGraph } from '@snyk/dep-graph';
import { getPnpmLockfileParser } from './lockfile-parser/index';
import { PnpmLockfileParser } from './lockfile-parser/lockfile-parser';
import { NodeLockfileVersion } from '../../utils';
import { UNDEFINED_VERSION } from './constants';

export const parsePnpmWorkspaceProject = async (
  pkgJsonContent: string,
  pnpmLockfileContents: string,
  options: PnpmProjectParseOptions,
  importer: string,
  lockfileVersion?: NodeLockfileVersion,
) => {
  const {
    includeDevDeps,
    includePeerDeps,
    includeOptionalDeps,
    strictOutOfSync,
    pruneWithinTopLevelDeps,
    showNpmScope,
  } = options;

  const lockFileParser: PnpmLockfileParser = getPnpmLockfileParser(
    pnpmLockfileContents,
    lockfileVersion,
  );

  const pkgJson: PackageJsonBase = parsePkgJson(pkgJsonContent);

  lockFileParser.workspaceArgs = {
    isWorkspace: true,
    projectsVersionMap: {
      [importer]: {
        name: pkgJson.name,
        version: pkgJson.version || UNDEFINED_VERSION,
      },
    },
  };
  const depGraph: DepGraph = await buildDepGraphPnpm(
    lockFileParser,
    pkgJson,
    {
      includeDevDeps,
      includePeerDeps,
      strictOutOfSync,
      includeOptionalDeps,
      pruneWithinTopLevelDeps,
      showNpmScope,
    },
    importer,
  );

  return depGraph;
};
