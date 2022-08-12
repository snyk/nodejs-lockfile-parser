export type YarnLockPackages = Record<
  string,
  {
    version: string;
    dependencies: Record<string, string>;
  }
>;
