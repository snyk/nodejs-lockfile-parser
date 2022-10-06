import { extractPkgsFromYarnLockV2 } from './extract-yarnlock-v2-pkgs';
import { parsePkgJson } from '../util';
import { PackageJsonBase, ProjectParseOptions } from '../types';
import { buildDepGraphYarnLockV2Simple } from './build-depgraph-simple';

export const parseYarnLockV2Project = (
  pkgJsonContent: string,
  yarnLockContent: string,
  options: ProjectParseOptions,
) => {
  const { includeDevDeps, includeOptionalDeps, strictOutOfSync } = options;

  const pkgs = extractPkgsFromYarnLockV2(yarnLockContent);

  const pkgJson: PackageJsonBase = parsePkgJson(pkgJsonContent);

  const depgraph = buildDepGraphYarnLockV2Simple(pkgs, pkgJson, {
    includeDevDeps,
    strictOutOfSync,
    includeOptionalDeps,
  });

  return depgraph;
};
