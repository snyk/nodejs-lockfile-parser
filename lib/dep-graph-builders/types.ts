// Common types
export type PackageJsonBase = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  resolutions?: Record<string, string>;
};

// Npm Lock V2
export type NpmLockfileV2 = {
  name: string;
  version: string;
  lockfileVersion: number;
  requires: boolean;
  dependencies: Record<string, NpmLockfileV2Dependency>;
  packages: Record<string, NpmLockfileV2Package>;
};

export type NpmLockfileV2Dependency = {
  version: string;
  requires?: Record<string, string>;
  dependencies?: Record<string, NpmLockfileV2Dependency>;
  dev?: boolean;
};

export type NpmLockfileV2DependencyWithName = NpmLockfileV2Dependency & {
  name: string;
};

export type NpmLockfileV2Package = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
};

// Form: name@semverId. i.e. depd@~1.1.2 or react@16.1.1
export type PkgIdentifier = string;

export type NormalisedPkgs = Record<
  PkgIdentifier,
  {
    version: string; // This is resolved version
    dependencies: Record<string, string>;
    optionalDependencies: Record<string, string>;
  }
>;

export type DepGraphBuildOptions = {
  includeDevDeps: boolean;
  includeOptionalDeps: boolean;
  strictOutOfSync: boolean;
};

export type LockFileParseOptions = {
  includeOptionalDeps: boolean;
};

export type ProjectParseOptions = DepGraphBuildOptions &
  LockFileParseOptions & {
    pruneCycles: boolean;
  };
