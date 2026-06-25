import { parseJsonFile } from '../../utils';

// Values from the packages key on Npm Lock V2+
export type NpmLockPkg = {
  name?: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  dev?: boolean;
  optional?: boolean;
  resolved?: string;
  integrity?: string;
  license?: string;
  engines?: Record<string, string>;
  inBundle?: boolean;
  bundleDependencies?: string[];
  bundledDependencies?: string[];
};

export const extractPkgsFromNpmLockV2 = (
  pkgLockContent: string,
): Record<string, NpmLockPkg> => {
  return parseJsonFile<{ packages: Record<string, NpmLockPkg> }>(
    pkgLockContent,
    'package-lock.json',
  ).packages;
};
