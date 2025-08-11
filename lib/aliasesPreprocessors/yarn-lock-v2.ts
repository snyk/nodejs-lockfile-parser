import { NormalisedPkgs } from '../dep-graph-builders/types';
import * as cloneDeep from 'lodash.clonedeep';
export const rewriteAliasesInYarnLockV2 = (
  pkgJson: string,
  lockfileNormalisedPkgs: NormalisedPkgs,
): NormalisedPkgs => {
  const lockfileNormalisedPkgsPreprocessed: NormalisedPkgs = cloneDeep(
    lockfileNormalisedPkgs,
  );

  const topLevelPkgs = JSON.parse(pkgJson).dependencies as Record<
    string,
    string
  >;
  const topLevelAliasedPkgs = Object.entries(topLevelPkgs || {})
    .filter((entry) => {
      return entry[1].startsWith('npm:');
    })
    .map((entry) => {
      return `${entry[0]}@${entry[1]}`;
    });

  for (const pkg in lockfileNormalisedPkgsPreprocessed) {
    const pkgSplit = pkg.substring(0, pkg.lastIndexOf('@'));
    const resolutionSplit =
      lockfileNormalisedPkgsPreprocessed[pkg].resolution?.split(
        /@npm[:%3A]/,
      )[0];

    if (
      !pkg.startsWith('v2@workspace') &&
      resolutionSplit &&
      pkgSplit != resolutionSplit &&
      topLevelAliasedPkgs.includes(pkg)
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
    } else if (
      // Replace aliased top level deps possible references in transitive deps
      lockfileNormalisedPkgsPreprocessed[pkg] &&
      lockfileNormalisedPkgsPreprocessed[pkg].dependencies
    ) {
      const newDependencies: Record<string, string> = {};
      for (const key in lockfileNormalisedPkgsPreprocessed[pkg].dependencies) {
        const value = lockfileNormalisedPkgsPreprocessed[pkg].dependencies[key];

        if (
          value.includes('@') &&
          topLevelAliasedPkgs.includes(`${key}@${value}`)
        ) {
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
