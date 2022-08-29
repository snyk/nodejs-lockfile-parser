export type YarnLockPackages = Record<
  string,
  {
    version: string;
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
