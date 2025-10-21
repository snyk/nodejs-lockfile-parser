import { PackageJsonBase } from './types';
import { DepGraphBuilder } from '@snyk/dep-graph';
import { InvalidUserInputError } from '../errors';
import { NormalisedPkgs } from './types';
import { OutOfSyncError } from '../errors';
import { LockfileType } from '../parsers';
import { parseNpmAlias } from '../aliasesPreprocessors/pkgJson';

export type Dependencies = Record<
  string,
  { version: string; isDev: boolean; isOptional?: boolean }
>;

export interface PkgNode {
  id: string;
  name: string;
  version: string;
  dependencies: Dependencies;
  isDev: boolean;
  missingLockFileEntry?: boolean;
  inBundle?: boolean;
  key?: string;
  alias?: {
    aliasName: string;
    aliasTargetDepName: string;
    semver: string;
    version: string;
  };
}

export const addPkgNodeToGraph = (
  depGraphBuilder: DepGraphBuilder,
  node: PkgNode,
  options: {
    isCyclic?: boolean;
    isWorkspacePkg?: boolean;
  },
): DepGraphBuilder => {
  return depGraphBuilder.addPkgNode(
    { name: node.name, version: node.version },
    node.id,
    {
      labels: {
        scope: node.isDev ? 'dev' : 'prod',
        ...(options.isCyclic && { pruned: 'cyclic' }),
        ...(options.isWorkspacePkg && { pruned: 'true' }),
        ...(node.missingLockFileEntry && { missingLockFileEntry: 'true' }),
        ...(node.alias && {
          alias: `${node.alias.aliasName}=>${node.alias.aliasTargetDepName}@${node.version}`,
        }),
      },
    },
  );
};

/**
 * Get top level dependencies from the given package json object which is parsed from a package.json file.
 * This includes both prod dependencies and dev dependencies supposing includeDevDeps is supported.
 */
export const getTopLevelDeps = (
  pkgJson: PackageJsonBase,
  options: {
    includeDevDeps: boolean;
    includeOptionalDeps?: boolean;
    includePeerDeps?: boolean;
  },
): Dependencies => {
  const prodDeps = getGraphDependencies(pkgJson.dependencies || {}, {
    isDev: false,
  });

  const devDeps = getGraphDependencies(pkgJson.devDependencies || {}, {
    isDev: true,
  });

  const optionalDeps = options.includeOptionalDeps
    ? getGraphDependencies(pkgJson.optionalDependencies || {}, {
        isDev: false,
        isOptional: true,
      })
    : {};

  const peerDeps = options.includePeerDeps
    ? getGraphDependencies(pkgJson.peerDependencies || {}, { isDev: false })
    : {};

  const deps = { ...prodDeps, ...optionalDeps, ...peerDeps };

  if (pkgJson.aliases) {
    for (const alias of Object.keys(pkgJson.aliases)) {
      // Only add alias metadata to dependencies that are actually in deps
      if (deps[alias]) {
        deps[alias] = {
          ...deps[alias],
          ...{ alias: { ...pkgJson.aliases[alias] } },
        };
      }
    }
  }

  if (options.includeDevDeps) {
    // Ensure dev dependency 'isDev' flags are correctly set.
    // Dev dependencies are applied last to override shared keys with regular dependencies.
    return { ...deps, ...devDeps };
  }

  // For includeDevDeps option set to false, simulate pnpm install --prod
  // by excluding all devDependencies,
  // ignoring potential duplicates in other dependency lists.
  // https://pnpm.io/cli/install#--prod--p
  return Object.keys(deps)
    .filter((packageName) => !devDeps.hasOwnProperty(packageName))
    .reduce((result, packageName) => {
      result[packageName] = deps[packageName];
      return result;
    }, {});
};

/**
 * Converts dependencies parsed from the a lock file to a dependencies object required by the graph.
 * For example, { 'mime-db': '~1.12.0' } will be converted to { 'mime-db': { version: '~1.12.0', isDev: true/false } }.
 */
export const getGraphDependencies = (
  dependencies: Record<string, string>,
  options: {
    isDev: boolean;
    isOptional?: boolean;
  },
): Dependencies => {
  return Object.entries(dependencies).reduce(
    (pnpmDeps: Dependencies, [name, semver]) => {
      pnpmDeps[name] = {
        version: semver,
        isDev: options.isDev,
        isOptional: options.isOptional || false,
      };
      return pnpmDeps;
    },
    {},
  );
};

export function parsePkgJson(pkgJsonContent: string): PackageJsonBase {
  try {
    const parsedPkgJson = JSON.parse(pkgJsonContent);
    if (!parsedPkgJson.name) {
      parsedPkgJson.name = 'package.json';
    }
    return parsedPkgJson;
  } catch (e) {
    throw new InvalidUserInputError(
      'package.json parsing failed with error ' + (e as Error).message,
    );
  }
}

export const getChildNode = (
  name: string,
  depInfo: {
    version: string;
    isDev: boolean;
    isOptional?: boolean;
    alias?: {
      aliasName: string;
      aliasTargetDepName: string;
      semver: string;
      version: string;
    };
  },
  pkgs: NormalisedPkgs,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
) => {
  const childNodeKey = `${name}@${depInfo.version}`;
  let childNode: PkgNode;

  // Check if this lockfile entry is for an aliased package
  // by looking for a corresponding npm: entry in the lockfile
  let aliasInfo = depInfo.alias;
  if (!aliasInfo && pkgs[childNodeKey]) {
    // Look for any key in pkgs that matches the pattern: name@npm:*
    // and has the same version as our current entry
    for (const key in pkgs) {
      if (key.startsWith(`${name}@npm:`)) {
        const pkgEntry = pkgs[key];
        if (pkgEntry.version === pkgs[childNodeKey].version) {
          // Extract the npm: portion and parse it using the shared helper
          const npmPortion = key.substring(name.length + 1); // Remove "name@" prefix
          const parsed = parseNpmAlias(npmPortion);
          if (parsed) {
            const targetPkgName = parsed.packageName;
            // Only add alias info if the alias name is different from the target name
            if (targetPkgName !== name) {
              aliasInfo = {
                aliasName: name,
                aliasTargetDepName: targetPkgName,
                semver: parsed.version,
                version: parsed.version,
              };
            }
            break;
          }
        }
      }
    }
  }

  if (!pkgs[childNodeKey]) {
    // Handle optional dependencies that don't have separate package entries
    if (depInfo.isOptional) {
      childNode = {
        id: childNodeKey,
        name: aliasInfo?.aliasTargetDepName ?? name,
        version: depInfo.version,
        dependencies: {},
        isDev: depInfo.isDev,
        missingLockFileEntry: true,
        alias: aliasInfo,
      };
    } else if (strictOutOfSync && !/^file:/.test(depInfo.version)) {
      throw new OutOfSyncError(childNodeKey, LockfileType.yarn);
    } else {
      childNode = {
        id: childNodeKey,
        name: aliasInfo?.aliasTargetDepName ?? name,
        version: depInfo.version,
        dependencies: {},
        isDev: depInfo.isDev,
        missingLockFileEntry: true,
        alias: aliasInfo,
      };
    }
  } else {
    const depData = pkgs[childNodeKey];
    const dependencies = getGraphDependencies(depData.dependencies || {}, {
      isDev: depInfo.isDev,
    });
    const optionalDependencies = includeOptionalDeps
      ? getGraphDependencies(depData.optionalDependencies || {}, {
          isDev: depInfo.isDev,
          isOptional: true,
        })
      : {};
    childNode = {
      id: `${name}@${depData.version}`,
      name: aliasInfo?.aliasTargetDepName ?? name,
      version: depData.version,
      dependencies: { ...dependencies, ...optionalDependencies },
      isDev: depInfo.isDev,
      alias: aliasInfo,
    };
  }

  return childNode;
};
