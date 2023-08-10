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
  integrity?: string,
  license?: string;
  engines?: Record<string, string>;
  inBundle?: boolean;
};

export const extractPkgsFromNpmLockV2 = (
  pkgLockContent: string,
): Record<string, NpmLockPkg> => {
  return JSON.parse(pkgLockContent).packages;
};
