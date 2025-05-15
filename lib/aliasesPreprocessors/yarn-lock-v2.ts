import { NormalisedPkgs } from '../dep-graph-builders/types';
import * as cloneDeep from 'lodash.clonedeep';
export const rewriteAliasesInLockV2 = (
  lockfileNormalisedPkgs: NormalisedPkgs,
): NormalisedPkgs => {
  const lockfileNormalisedPkgsPreprocessed: NormalisedPkgs = cloneDeep(
    lockfileNormalisedPkgs,
  );
  for (const pkg in lockfileNormalisedPkgsPreprocessed) {
    const pkgSplit = pkg.substring(0, pkg.lastIndexOf('@'));
    const resolutionSplit =
      lockfileNormalisedPkgsPreprocessed[pkg].resolution?.split(
        /@npm[:%3A]/,
      )[0];

    if (
      !pkg.startsWith('v2@workspace') &&
      resolutionSplit &&
      pkgSplit != resolutionSplit
    ) {
      const newPkg = lockfileNormalisedPkgsPreprocessed[pkg];
      delete lockfileNormalisedPkgsPreprocessed[pkg];
      const newKey = pkg.replace(pkgSplit, resolutionSplit);
      lockfileNormalisedPkgsPreprocessed[newKey] = newPkg;
    }
    if (pkg.startsWith('v2@workspace')) {
      const newDependencies: Record<string, string> = {};
      for (const key in lockfileNormalisedPkgsPreprocessed[pkg].dependencies) {
        const value = lockfileNormalisedPkgsPreprocessed[pkg].dependencies[key];
        if (value.startsWith('npm:')) {
          newDependencies[value.substring(4, value.lastIndexOf('@'))] =
            value.substring(value.lastIndexOf('@') + 1, value.length);
        } else {
          newDependencies[key] = value;
        }
      }
      lockfileNormalisedPkgsPreprocessed[pkg].dependencies = newDependencies;
    }
  }

  return lockfileNormalisedPkgsPreprocessed;
};
