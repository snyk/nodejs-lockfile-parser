import { Overrides, PackageJsonBase } from '../dep-graph-builders/types';
import { parsePkgJson } from '../dep-graph-builders/util';

/**
 * Parses a npm alias string (e.g., "npm:package@1.0.0") and returns the package name and version
 * Handles scoped packages correctly (e.g., "npm:@scope/pkg@1.0.0")
 */
export const parseNpmAlias = (
  aliasString: string,
): { packageName: string; version: string } | null => {
  if (!aliasString.startsWith('npm:')) {
    return null;
  }

  // Find the last @ that separates package name from version
  // For scoped packages, we need to skip the first @ in the scope
  const afterNpm = aliasString.substring(4); // Remove "npm:" prefix

  // If it starts with @, it's a scoped package
  if (afterNpm.startsWith('@')) {
    // Find the @ that separates the package name from version
    // It should be after the scope (e.g., @scope/name@version)
    const slashIndex = afterNpm.indexOf('/');
    if (slashIndex === -1) {
      // Malformed scoped package - no slash after @scope
      return null;
    }

    // Look for @ after the slash
    const versionSeparatorIndex = afterNpm.indexOf('@', slashIndex);

    if (versionSeparatorIndex === -1) {
      // No version specified - the whole string is the package name
      // This happens with keys like "@typescript/lib-dom@npm:@types/web" where there's no explicit version
      return {
        packageName: afterNpm,
        version: '', // No version specified
      };
    }

    return {
      packageName: afterNpm.substring(0, versionSeparatorIndex),
      version: afterNpm.substring(versionSeparatorIndex + 1),
    };
  } else {
    // Non-scoped package
    const lastAtIndex = afterNpm.lastIndexOf('@');
    if (lastAtIndex === -1) {
      // No version specified
      return {
        packageName: afterNpm,
        version: '',
      };
    }

    if (lastAtIndex === 0) {
      // Invalid format: starts with @ but not a scoped package
      return null;
    }

    return {
      packageName: afterNpm.substring(0, lastAtIndex),
      version: afterNpm.substring(lastAtIndex + 1),
    };
  }
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
