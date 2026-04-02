import { parsePkgJson } from '../util';
import { PackageJsonBase, PnpmProjectParseOptions } from '../types';
import { buildDepGraphPnpm } from './build-dep-graph-pnpm';
import { DepGraph } from '@snyk/dep-graph';
import { getPnpmLockfileParser } from './lockfile-parser/index';
import { NodeLockfileVersion } from '../../utils';

export const parsePnpmProject = async (
  pkgJsonContent: string,
  pnpmLockContent: string | undefined,
  options: PnpmProjectParseOptions,
  lockfileVersion?: NodeLockfileVersion,
): Promise<DepGraph> => {
  const {
    includeDevDeps,
    includePeerDeps,
    includeOptionalDeps,
    strictOutOfSync,
    pruneWithinTopLevelDeps,
    showNpmScope,
  } = options;
  let importer = '';

  const pkgJson: PackageJsonBase = parsePkgJson(pkgJsonContent);

  const lockFileParser = getPnpmLockfileParser(
    pnpmLockContent,
    lockfileVersion,
  );

  // Lockfile V9 simple project has the root importer.
  // Some V6 lockfiles also embed the root importer as '.' inside the
  // top-level dependencies map (normaliseImporters moves it to importers).
  if (lockFileParser.rawPnpmLock.importers?.['.']) {
    importer = '.';
    lockFileParser.workspaceArgs = {
      projectsVersionMap: {
        '.': { name: pkgJson.name, version: pkgJson.version },
      },
      isWorkspace: true,
    };
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
      showNpmScope,
    },
    importer,
  );

  return depgraph;
};
