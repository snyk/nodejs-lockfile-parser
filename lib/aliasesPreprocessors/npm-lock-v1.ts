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

      // Also transform possible references in transitive deps
      // if any deps with requires have pkg in the list and with the same aliased value, we need to replace it with aliased value,

      for (const topLevelPkg in jsonLockfile.dependencies) {
        const requires = jsonLockfile.dependencies[topLevelPkg]
          .requires as Record<string, string>;
        for (const requiredDep in requires) {
          if (
            requiredDep === pkg &&
            requires[requiredDep] ===
              `npm:${aliasName}@${jsonLockfile.dependencies[aliasName].version}`
          ) {
            jsonLockfile.dependencies[topLevelPkg].requires[aliasName] =
              jsonLockfile.dependencies[aliasName].version;
            delete jsonLockfile.dependencies[topLevelPkg].requires[requiredDep];
          }
        }
      }
    }
  }

  return JSON.stringify(jsonLockfile);
};
