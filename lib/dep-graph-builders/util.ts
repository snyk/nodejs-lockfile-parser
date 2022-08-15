import { PackageJsonBase } from './types';
import { DepGraphBuilder } from '@snyk/dep-graph';
import { InvalidUserInputError } from '../errors';

export interface PkgNode {
  id: string;
  name: string;
  version: string;
  dependencies: Record<string, { version: string; isDev: boolean }>;
  isDev: boolean;
}

export const addPkgNodeToGraph = (
  depGraphBuilder: DepGraphBuilder,
  node: PkgNode,
  isCyclic: boolean,
): DepGraphBuilder => {
  return depGraphBuilder.addPkgNode(
    { name: node.name, version: node.version },
    node.id,
    {
      labels: {
        scope: node.isDev ? 'dev' : 'prod',
        ...(isCyclic && { pruned: 'cyclic' }),
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
): Record<string, { version: string; isDev: boolean }> => {
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
) => {
  return Object.entries(dependencies).reduce(
    (
      acc: Record<string, { version: string; isDev: boolean }>,
      [name, semver],
    ) => {
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
