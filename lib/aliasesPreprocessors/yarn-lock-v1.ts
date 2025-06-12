export const rewriteAliasesInYarnLockV1 = (lockfileContent: string): string => {
  const regex = /^(\s*)"(.+?@npm:)([^"]+)":/gm;

  const lockfilePreprocessed = lockfileContent.replace(regex, '$1"$3":');

  return lockfilePreprocessed;
};
