import { PackageJsonBase } from '../dep-graph-builders/types';
import { parsePkgJson } from '../dep-graph-builders/util';

export const rewriteAliasesPkgJson = (packageJsonContent: string): string => {
  const pkgJsonPreprocessed = parsePkgJson(packageJsonContent);
  pkgJsonPreprocessed.dependencies = rewriteAliases(
    pkgJsonPreprocessed,
    pkgJsonPreprocessed.dependencies,
  );
  pkgJsonPreprocessed.devDependencies = rewriteAliases(
    pkgJsonPreprocessed,
    pkgJsonPreprocessed.devDependencies,
  );
  pkgJsonPreprocessed.optionalDependencies = rewriteAliases(
    pkgJsonPreprocessed,
    pkgJsonPreprocessed.optionalDependencies,
  );
  pkgJsonPreprocessed.peerDependencies = rewriteAliases(
    pkgJsonPreprocessed,
    pkgJsonPreprocessed.peerDependencies,
  );
  return JSON.stringify(pkgJsonPreprocessed);
};

export const rewriteAliases = (
  pkgJsonPreprocessed: PackageJsonBase,
  dependencies: Record<string, string> | undefined,
): Record<string, string> | undefined => {
  if (!dependencies) {
    return undefined;
  }
  const newDependencies: Record<string, string> = {};
  for (const key in dependencies) {
    const value = dependencies[key];
    if (value.startsWith('npm:')) {
      if (!pkgJsonPreprocessed['aliases']) {
        pkgJsonPreprocessed['aliases'] = {};
      }
      pkgJsonPreprocessed['aliases'] = {
        ...pkgJsonPreprocessed['aliases'],
        ...{
          [key]: {
            aliasName: key,
            aliasTargetDepName: value.substring(4, value.lastIndexOf('@')),
            semver: value.substring(value.lastIndexOf('@') + 1, value.length),
            version: null,
          },
        },
      };
    }
    newDependencies[key] = value;
  }
  return newDependencies;
};
