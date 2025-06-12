import { parsePkgJson } from '../dep-graph-builders/util';

export const rewriteAliasesPkgJson = (packageJsonContent: string): string => {
  const pkgJsonPreprocessed = parsePkgJson(packageJsonContent);
  pkgJsonPreprocessed.dependencies = rewriteAliases(
    pkgJsonPreprocessed.dependencies,
  );
  pkgJsonPreprocessed.devDependencies = rewriteAliases(
    pkgJsonPreprocessed.devDependencies,
  );
  pkgJsonPreprocessed.optionalDependencies = rewriteAliases(
    pkgJsonPreprocessed.optionalDependencies,
  );
  pkgJsonPreprocessed.peerDependencies = rewriteAliases(
    pkgJsonPreprocessed.peerDependencies,
  );
  return JSON.stringify(pkgJsonPreprocessed);
};

export const rewriteAliases = (
  dependencies: Record<string, string> | undefined,
): Record<string, string> | undefined => {
  if (!dependencies) {
    return undefined;
  }
  const newDependencies: Record<string, string> = {};
  for (const key in dependencies) {
    const value = dependencies[key];
    if (value.startsWith('npm:')) {
      newDependencies[value.substring(4, value.lastIndexOf('@'))] =
        value.substring(value.lastIndexOf('@') + 1, value.length);
    } else {
      newDependencies[key] = value;
    }
  }
  return newDependencies;
};
