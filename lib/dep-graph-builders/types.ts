// Common types
export type PackageJsonBase = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  resolutions?: Record<string, string>;
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
  includePeerDeps?: boolean;
};

export type LockFileParseOptions = {
  includeOptionalDeps: boolean;
};

export type ProjectParseOptions = DepGraphBuildOptions &
  LockFileParseOptions & {
    pruneCycles?: boolean;
  };
