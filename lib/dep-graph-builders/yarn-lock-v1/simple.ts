import { buildDepGraphYarnLockV1Simple } from '.';
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
  } = options;

  const pkgs = extractPkgsFromYarnLockV1(yarnLockContent);

  const pkgJson: PackageJsonBase = parsePkgJson(pkgJsonContent);

  const depGraph =
    pruneLevel === 'cycles'
      ? await buildDepGraphYarnLockV1SimpleCyclesPruned(pkgs, pkgJson, {
          includeDevDeps,
          strictOutOfSync,
          includeOptionalDeps,
        })
      : await buildDepGraphYarnLockV1Simple(pkgs, pkgJson, {
          includeDevDeps,
          includeOptionalDeps,
          includePeerDeps,
          strictOutOfSync,
          pruneWithinTopLevelDeps: pruneLevel === 'withinTopLevelDeps',
        });

  return depGraph;
};
