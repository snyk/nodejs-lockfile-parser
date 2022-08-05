import { PackageJsonBase } from '../types';
import { buildDepGraphYarnLockV1Simple } from './build-depgraph-simple';
import { extractPkgsFromYarnLockV1 } from './extract-yarnlock-v1-pkgs';

export const parseYarnLockV1Project = async (
  pkgJsonContent: string,
  yarnLockContent: string,
) => {
  // These to be extracted to options
  const includeDevDeps = false;
  const includeOptionalDeps = true;

  const pkgs = await extractPkgsFromYarnLockV1(yarnLockContent, {
    includeOptionalDeps,
  });
  const pkgJson: PackageJsonBase = JSON.parse(pkgJsonContent);
  const depGraph = buildDepGraphYarnLockV1Simple(pkgs, pkgJson, {
    includeDevDeps,
  });
  return depGraph;
};
