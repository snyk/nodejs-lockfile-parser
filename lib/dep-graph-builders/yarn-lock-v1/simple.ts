import { buildDepGraphYarnLockV1Simple } from '.';
import { rewriteAliasesPkgJson } from '../../aliasesPreprocessors/pkgJson';

import { PackageJsonBase, YarnLockV1ProjectParseOptions } from '../types';
import { parsePkgJson } from '../util';
import { buildDepGraphYarnLockV1SimpleCyclesPruned } from './build-depgraph-simple-pruned';
import { extractPkgsFromYarnLockV1 } from './extract-yarnlock-v1-pkgs';

export const parseYarnLockV1Project = async (
  pkgJsonContent: string,
  yarnLockContent: string,
  options: YarnLockV1ProjectParseOptions,
) => {
  const {
    includeDevDeps,
    includeOptionalDeps,
    includePeerDeps,
    pruneLevel,
    strictOutOfSync,
    honorAliases,
    showNpmScope,
  } = options;

  const pkgs = extractPkgsFromYarnLockV1(yarnLockContent);

  const pkgJson: PackageJsonBase = parsePkgJson(
    honorAliases ? rewriteAliasesPkgJson(pkgJsonContent) : pkgJsonContent,
  );

  const depGraph =
    pruneLevel === 'cycles'
      ? await buildDepGraphYarnLockV1SimpleCyclesPruned(pkgs, pkgJson, {
          includeDevDeps,
          strictOutOfSync,
          includeOptionalDeps,
          showNpmScope,
        })
      : await buildDepGraphYarnLockV1Simple(pkgs, pkgJson, {
          includeDevDeps,
          includeOptionalDeps,
          includePeerDeps,
          strictOutOfSync,
          pruneWithinTopLevelDeps: pruneLevel === 'withinTopLevelDeps',
          showNpmScope,
        });

  return depGraph;
};
