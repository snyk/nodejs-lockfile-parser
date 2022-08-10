import { buildDepGraphYarnLockV1Simple } from '.';
import { PackageJsonBase } from '../types';
import { buildDepGraphYarnLockV1SimpleCyclesPruned } from './build-depgraph-simple-pruned';
import { extractPkgsFromYarnLockV1 } from './extract-yarnlock-v1-pkgs';

export const parseYarnLockV1Project = async (
  pkgJsonContent: string,
  yarnLockContent: string,
  options: {
    includeDevDeps: boolean;
    includeOptionalDeps: boolean;
    pruneCycles: boolean;
  },
) => {
  const { includeDevDeps, includeOptionalDeps, pruneCycles } = options;

  const pkgs = await extractPkgsFromYarnLockV1(yarnLockContent, {
    includeOptionalDeps,
  });
  const pkgJson: PackageJsonBase = JSON.parse(pkgJsonContent);
  const depGraph = pruneCycles
    ? buildDepGraphYarnLockV1SimpleCyclesPruned(pkgs, pkgJson, {
        includeDevDeps,
      })
    : buildDepGraphYarnLockV1Simple(pkgs, pkgJson, { includeDevDeps });

  return depGraph;
};
