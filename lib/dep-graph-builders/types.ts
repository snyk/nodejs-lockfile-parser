// Common types
export type PackageJsonBase = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  resolutions?: Record<string, string>;
  overrides?: Overrides;
};

export type Overrides = string | { [key: string]: Overrides };

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
    pruneCycles: boolean;
  };

export type YarnLockV2WorkspaceArgs = {
  isWorkspacePkg: boolean;
  isRoot: boolean;
  rootResolutions: Record<string, string>;
};

export type YarnLockV2ProjectParseOptions = {
  includeDevDeps: boolean;
  includeOptionalDeps: boolean;
  strictOutOfSync: boolean;
  pruneWithinTopLevelDeps: boolean;
};

export type PnpmLockV7ProjectParseOptions = {
  includeDevDeps: boolean;
  includeOptionalDeps: boolean;
  strictOutOfSync: boolean;
  pruneWithinTopLevelDeps: boolean;
};

/*
 * This chooses how much we prune:
 * - `cycles`: only prunes cycles
 * - `withinTopLevelDeps`: prunes everything within a top level dep
 * - `none`: does not apply any pruning to the dep graph
 */
export type PruneLevel = 'cycles' | 'withinTopLevelDeps' | 'none';

export type YarnLockV1ProjectParseOptions = {
  includeDevDeps: boolean;
  includeOptionalDeps: boolean;
  includePeerDeps: boolean;
  strictOutOfSync: boolean;
  pruneLevel: PruneLevel;
};

export type Yarn1DepGraphBuildOptions = {
  includeDevDeps: boolean;
  includeOptionalDeps: boolean;
  includePeerDeps: boolean;
  strictOutOfSync: boolean;
  pruneWithinTopLevelDeps: boolean;
};
