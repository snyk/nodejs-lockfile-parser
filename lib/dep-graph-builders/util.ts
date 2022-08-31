import { PackageJsonBase } from './types';
import { DepGraphBuilder } from '@snyk/dep-graph';
import { InvalidUserInputError } from '../errors';
import { YarnLockPackages } from './yarn-lock-v1/types';
import { OutOfSyncError } from '../errors';
import { LockfileType } from '../parsers';

export type Dependencies = Record<string, { version: string; isDev: boolean }>;

export interface PkgNode {
  id: string;
  name: string;
  version: string;
  dependencies: Dependencies;
  isDev: boolean;
  missingLockFileEntry?: boolean;
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
  options: { includeDevDeps: boolean },
): Dependencies => {
  const prodDeps = getGraphDependencies(pkgJson.dependencies || {}, false);

  const devDeps = options.includeDevDeps
    ? getGraphDependencies(pkgJson.devDependencies || {}, true)
    : {};

  return { ...prodDeps, ...devDeps };
};

/**
 * Converts dependencies parsed from the a lock file to a dependencies object required by the graph.
 * For example, { 'mime-db': '~1.12.0' } will be converted to { 'mime-db': { version: '~1.12.0', isDev: true/false } }.
 */
export const getGraphDependencies = (
  dependencies: Record<string, string>,
  isDev,
): Dependencies => {
  return Object.entries(dependencies).reduce(
    (acc: Dependencies, [name, semver]) => {
      acc[name] = { version: semver, isDev: isDev };
      return acc;
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
      'package.json parsing failed with error ' + e.message,
    );
  }
}

export const getChildNode = (
  name: string,
  depInfo: { version: string; isDev: boolean },
  pkgs: YarnLockPackages,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
) => {
  const childNodeKey = `${name}@${depInfo.version}`;
  let childNode: PkgNode;

  if (!pkgs[childNodeKey]) {
    if (strictOutOfSync && !/^file:/.test(depInfo.version)) {
      throw new OutOfSyncError(childNodeKey, LockfileType.yarn);
    } else {
      childNode = {
        id: childNodeKey,
        name: name,
        version: depInfo.version,
        dependencies: {},
        isDev: depInfo.isDev,
        missingLockFileEntry: true,
      };
    }
  } else {
    const depData = pkgs[childNodeKey];
    const dependencies = getGraphDependencies(
      depData.dependencies || {},
      depInfo.isDev,
    );
    const optionalDependencies = includeOptionalDeps
      ? getGraphDependencies(depData.optionalDependencies || {}, depInfo.isDev)
      : {};
    childNode = {
      id: `${name}@${depData.version}`,
      name: name,
      version: depData.version,
      dependencies: { ...dependencies, ...optionalDependencies },
      isDev: depInfo.isDev,
    };
  }

  return childNode;
};

export const getChildNodeWorkspace = (
  name: string,
  depInfo: { version: string; isDev: boolean },
  workspacePkgNameToVersion: Record<string, string>,
  pkgs: YarnLockPackages,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
) => {
  let childNode: PkgNode;

  if (workspacePkgNameToVersion[name]) {
    const version = workspacePkgNameToVersion[name];

    // This is just to mimic old behavior where when StrictOutOfSync is turned on,
    // any cross referencing between workspace packages will lead to a throw
    if (strictOutOfSync) {
      throw new OutOfSyncError(`${name}@${version}`, LockfileType.yarn);
    }

    childNode = {
      id: `${name}@${version}`,
      name: name,
      version: version,
      dependencies: {},
      isDev: depInfo.isDev,
    };
  } else {
    childNode = getChildNode(
      name,
      depInfo,
      pkgs,
      strictOutOfSync,
      includeOptionalDeps,
    );
  }

  return childNode;
};
