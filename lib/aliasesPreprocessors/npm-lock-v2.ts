import { NpmLockPkg } from '../dep-graph-builders/npm-lock-v2/extract-npm-lock-v2-pkgs';

export const rewriteAliasesInNpmLockV2 = (
  lockfilePackages: Record<string, NpmLockPkg>,
): Record<string, NpmLockPkg> => {
  // 1. Rewrite top level "" packages in "".dependencies
  const rootPkg = lockfilePackages[''];
  const mutatedRootPkg: Array<string> = [];
  const aliasedPackages: Array<string> = [];
  const lockFileToReturn: Record<string, NpmLockPkg> = lockfilePackages;
  if (rootPkg && rootPkg.dependencies) {
    const dependencies = rootPkg.dependencies;
    for (const pkgName in rootPkg.dependencies) {
      if (rootPkg.dependencies[pkgName].startsWith('npm:')) {
        const aliasName = rootPkg.dependencies[pkgName].substring(
          4,
          rootPkg.dependencies[pkgName].lastIndexOf('@'),
        );
        const aliasVersion = rootPkg.dependencies[pkgName].substring(
          rootPkg.dependencies[pkgName].lastIndexOf('@') + 1,
          rootPkg.dependencies[pkgName].length,
        );
        dependencies[aliasName] = aliasVersion;
        mutatedRootPkg.push(pkgName);
        aliasedPackages.push(pkgName);
      } else {
        dependencies[pkgName] = rootPkg.dependencies[pkgName];
      }
    }
    lockFileToReturn[''].dependencies = dependencies;
  }

  // 2. Rewrite alias packages
  for (const pkgName in lockfilePackages) {
    if (
      pkgName != '' &&
      lockfilePackages[pkgName].name &&
      mutatedRootPkg.includes(pkgName.replace('node_modules/', ''))
    ) {
      lockFileToReturn[`node_modules/${lockfilePackages[pkgName].name}`] =
        lockfilePackages[pkgName];
      delete lockFileToReturn[pkgName];
    }

    // rewrite possible references in transitive deps
    if (
      pkgName != '' &&
      lockfilePackages[pkgName] &&
      lockfilePackages[pkgName].dependencies
    ) {
      for (const depName in lockfilePackages[pkgName].dependencies) {
        if (
          aliasedPackages.includes(depName) &&
          lockfilePackages[pkgName].dependencies[depName].startsWith('npm:')
        ) {
          const aliasName = lockfilePackages[pkgName].dependencies[
            depName
          ].substring(
            4,
            lockfilePackages[pkgName].dependencies[depName].lastIndexOf('@'),
          );
          const aliasVersion = lockfilePackages[pkgName].dependencies[
            depName
          ].substring(
            lockfilePackages[pkgName].dependencies[depName].lastIndexOf('@') +
              1,
            lockfilePackages[pkgName].dependencies[depName].length,
          );

          lockFileToReturn[pkgName].dependencies![aliasName] = aliasVersion;
          delete lockFileToReturn[pkgName].dependencies![depName];
        }
      }
    }
  }

  return lockFileToReturn;
};
