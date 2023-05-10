import { buildDepGraphYarnLockV1Simple } from '.';
import { PackageJsonBase } from '../types';
import { parsePkgJson } from '../util';
import { extractPkgsFromYarnLockV1 } from './extract-yarnlock-v1-pkgs';
import { ProjectParseOptions } from '../types';

export const parseYarnLockV1Project = async (
  pkgJsonContent: string,
  yarnLockContent: string,
  options: ProjectParseOptions,
) => {
  const { includeDevDeps, includeOptionalDeps, strictOutOfSync } = options;

  const pkgs = extractPkgsFromYarnLockV1(yarnLockContent);

  const pkgJson: PackageJsonBase = parsePkgJson(pkgJsonContent);

  const depGraph = await buildDepGraphYarnLockV1Simple(pkgs, pkgJson, {
    includeDevDeps,
    strictOutOfSync,
    includeOptionalDeps,
  });

  return depGraph;
};
