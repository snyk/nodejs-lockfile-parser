export const rewriteAliasesInYarnLockV1 = (lockfileContent: string): string => {
  const regex = /^(\s*)"(.+?@npm:)([^"]+)":/gm;
  const matches = lockfileContent.matchAll(regex);

  // Step 1: Replace aliased top level deps
  let lockfilePreprocessed = lockfileContent.replace(regex, '$1"$3":');
  // Step 2: Replace aliased top level deps possible references in transitive deps
  for (const match of matches) {
    const localMatch = match[0]
      .replace(/\s/g, '')
      .replace(/"/, '')
      .replace(/@npm:/, ' "npm:')
      .replace(/:$/, '');
    let replacementValue =
      match[0]
        .replace(/\s/g, '')
        .replace(/"/g, '')
        .replace(/.+?@npm:/, '')
        .replace(/@(?!.*@)/, ' "')
        .replace(/:/g, '') + '"';
    if (replacementValue.startsWith('@')) {
      replacementValue = replacementValue
        .replace(/^@/, '"@')
        .replace(/ /, '" ');
    }
    lockfilePreprocessed = lockfilePreprocessed.replace(
      localMatch,
      replacementValue,
    );
  }

  return lockfilePreprocessed;
};
