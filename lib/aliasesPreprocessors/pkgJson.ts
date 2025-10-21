import { Overrides, PackageJsonBase } from '../dep-graph-builders/types';
import { parsePkgJson } from '../dep-graph-builders/util';

/**
 * Parses a npm alias string (e.g., "npm:package@1.0.0") and returns the package name and version
 */
export const parseNpmAlias = (
  aliasString: string,
): { packageName: string; version: string } | null => {
  if (!aliasString.startsWith('npm:')) {
    return null;
  }
  const lastAtIndex = aliasString.lastIndexOf('@');
  if (lastAtIndex <= 4) {
    // Invalid format: must have content after 'npm:' and before '@'
    return null;
  }
  return {
    packageName: aliasString.substring(4, lastAtIndex),
    version: aliasString.substring(lastAtIndex + 1),
  };
};

/**
 * Adds an alias entry to the package.json aliases field
 */
const addAlias = (
  pkgJson: PackageJsonBase,
  aliasName: string,
  targetDepName: string,
  semver: string,
): void => {
  if (!pkgJson['aliases']) {
    pkgJson['aliases'] = {};
  }
  pkgJson['aliases'][aliasName] = {
    aliasName,
    aliasTargetDepName: targetDepName,
    semver,
    version: null,
  };
};

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
  // Process overrides field to extract aliases
  if (pkgJsonPreprocessed.overrides) {
    rewriteAliasesInOverrides(
      pkgJsonPreprocessed,
      pkgJsonPreprocessed.overrides,
    );
  }
  // Process resolutions field to extract aliases (yarn)
  if (pkgJsonPreprocessed.resolutions) {
    rewriteAliasesInOverrides(
      pkgJsonPreprocessed,
      pkgJsonPreprocessed.resolutions,
    );
  }
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
    const parsed = parseNpmAlias(value);
    if (parsed) {
      addAlias(pkgJsonPreprocessed, key, parsed.packageName, parsed.version);
    }
    newDependencies[key] = value;
  }
  return newDependencies;
};

/**
 * Recursively processes the overrides object to extract aliases
 */
export const rewriteAliasesInOverrides = (
  pkgJsonPreprocessed: PackageJsonBase,
  overrides: Overrides,
): void => {
  if (typeof overrides === 'string') {
    return; // String values are handled at the parent level where we have the key
  }

  // Recursive case: process each key-value pair in the overrides object
  for (const key in overrides) {
    const value = overrides[key];

    if (typeof value === 'string') {
      const parsed = parseNpmAlias(value);
      if (parsed) {
        addAlias(pkgJsonPreprocessed, key, parsed.packageName, parsed.version);
      }
    } else if (typeof value === 'object') {
      // Recursively process nested overrides
      rewriteAliasesInOverrides(pkgJsonPreprocessed, value);
    }
  }
};
