import * as cloneDeep from 'lodash.clonedeep';
export const rewriteAliasesInNpmLockV1 = (lockfileContent: string): string => {
  const jsonLockfile = JSON.parse(lockfileContent);
  for (const pkg in jsonLockfile.dependencies) {
    if (jsonLockfile.dependencies[pkg].version.startsWith('npm:')) {
      const aliasName = jsonLockfile.dependencies[pkg].version.substring(
        4,
        jsonLockfile.dependencies[pkg].version.lastIndexOf('@'),
      );
      jsonLockfile.dependencies[aliasName] = cloneDeep(
        jsonLockfile.dependencies[pkg],
      );
      jsonLockfile.dependencies[aliasName].version = jsonLockfile.dependencies[
        pkg
      ].version.substring(
        jsonLockfile.dependencies[pkg].version.lastIndexOf('@') + 1,
        jsonLockfile.dependencies[pkg].version.length,
      );
      delete jsonLockfile.dependencies[pkg];
    }
  }

  return JSON.stringify(jsonLockfile);
};
