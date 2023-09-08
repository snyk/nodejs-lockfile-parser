import {
  DepGraphBuildOptions,
  PackageJsonBase,
  ProjectParseOptions,
} from '../types';
import { extractPkgsFromNpmLockV2 } from './extract-npm-lock-v2-pkgs';
import type { NpmLockPkg } from './extract-npm-lock-v2-pkgs';
import { DepGraph, DepGraphBuilder } from '@snyk/dep-graph';
import {
  addPkgNodeToGraph,
  getGraphDependencies,
  getTopLevelDeps,
  parsePkgJson,
  PkgNode,
} from '../util';
import { OutOfSyncError } from '../../errors';
import { LockfileType } from '../../parsers';

import * as semver from 'semver';
import * as micromatch from 'micromatch';
import * as pathUtil from 'path';
import { eventLoopSpinner } from 'event-loop-spinner';

export { extractPkgsFromNpmLockV2 };

export const parseNpmLockV2Project = async (
  pkgJsonContent: string,
  pkgLockContent: string,
  options: ProjectParseOptions,
): Promise<DepGraph> => {
  const { includeDevDeps, strictOutOfSync, includeOptionalDeps } = options;

  const pkgJson: PackageJsonBase = parsePkgJson(pkgJsonContent);
  const pkgs = extractPkgsFromNpmLockV2(pkgLockContent);

  const depgraph = await buildDepGraphNpmLockV2(pkgs, pkgJson, {
    includeDevDeps,
    includeOptionalDeps,
    strictOutOfSync,
  });

  return depgraph;
};

export const buildDepGraphNpmLockV2 = async (
  npmLockPkgs: Record<string, NpmLockPkg>,
  pkgJson: PackageJsonBase,
  options: DepGraphBuildOptions,
) => {
  const { includeDevDeps, strictOutOfSync, includeOptionalDeps } = options;

  const depGraphBuilder = new DepGraphBuilder(
    { name: 'npm' },
    { name: pkgJson.name as string, version: pkgJson.version },
  );

  const topLevelDeps = getTopLevelDeps(pkgJson, {
    includeDevDeps,
    includeOptionalDeps,
    includePeerDeps: true,
  });

  const rootNode: PkgNode = {
    id: 'root-node',
    name: pkgJson.name,
    version: pkgJson.version,
    dependencies: topLevelDeps,
    isDev: false,
    inBundle: false,
    key: '',
  };

  const pkgKeysByName: Map<string, string[]> = Object.keys(npmLockPkgs).reduce(
    (acc, key) => {
      const name = key.replace(/.*node_modules\//, '');
      if (!name) {
        return acc;
      }

      if (!acc.has(name)) {
        acc.set(name, []);
      }

      acc.get(name)!.push(key);

      return acc;
    },
    new Map<string, string[]>(),
  );

  const visitedMap: Set<string> = new Set();
  await dfsVisit(
    depGraphBuilder,
    rootNode,
    visitedMap,
    npmLockPkgs,
    strictOutOfSync,
    includeDevDeps,
    includeOptionalDeps,
    [],
    pkgKeysByName,
  );
  return depGraphBuilder.build();
};

const dfsVisit = async (
  depGraphBuilder: DepGraphBuilder,
  node: PkgNode,
  visitedMap: Set<string>,
  npmLockPkgs: Record<string, NpmLockPkg>,
  strictOutOfSync: boolean,
  includeDevDeps: boolean,
  includeOptionalDeps: boolean,
  ancestry: Ancestor[],
  pkgKeysByName: Map<string, string[]>,
): Promise<void> => {
  visitedMap.add(node.id);

  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }

    const childNode = getChildNode(
      name,
      depInfo,
      npmLockPkgs,
      strictOutOfSync,
      includeDevDeps,
      includeOptionalDeps,
      [
        ...ancestry,
        {
          name: node.name,
          key: node.key || '',
          inBundle: node.inBundle || false,
        },
      ],
      pkgKeysByName,
    );

    if (!visitedMap.has(childNode.id)) {
      addPkgNodeToGraph(depGraphBuilder, childNode, {});
      await dfsVisit(
        depGraphBuilder,
        childNode,
        visitedMap,
        npmLockPkgs,
        strictOutOfSync,
        includeDevDeps,
        includeOptionalDeps,
        [
          ...ancestry,
          {
            name: node.name,
            key: node.key as string,
            inBundle: node.inBundle || false,
          },
        ],
        pkgKeysByName,
      );
    }

    depGraphBuilder.connectDep(node.id, childNode.id);
  }
};

const getChildNode = (
  name: string,
  depInfo: { version: string; isDev: boolean },
  pkgs: Record<string, NpmLockPkg>,
  strictOutOfSync: boolean,
  includeDevDeps: boolean,
  includeOptionalDeps: boolean,
  ancestry: Ancestor[],
  pkgKeysByName: Map<string, string[]>,
) => {
  let childNodeKey = getChildNodeKey(
    name,
    depInfo.version,
    ancestry,
    pkgs,
    pkgKeysByName,
  );

  if (!childNodeKey) {
    if (strictOutOfSync) {
      throw new OutOfSyncError(`${name}@${depInfo.version}`, LockfileType.npm);
    } else {
      return {
        id: `${name}@${depInfo.version}`,
        name: name,
        version: depInfo.version,
        dependencies: {},
        isDev: depInfo.isDev,
        missingLockFileEntry: true,
        key: '',
      };
    }
  }

  let depData = pkgs[childNodeKey];

  const resolvedToWorkspace = () => {
    const workspacesDeclaration = pkgs['']['workspaces'] || [];
    const resolvedPath = depData.resolved || '';
    const fixedResolvedPath = resolvedPath.replace(/\\/g, '/');
    const normalizedWorkspacesDefn = workspacesDeclaration.map((p) => {
      return pathUtil.normalize(p).replace(/\\/g, '/');
    });
    return micromatch.isMatch(fixedResolvedPath, normalizedWorkspacesDefn);
  };

  // Check for workspaces
  if (depData['link'] && resolvedToWorkspace()) {
    childNodeKey = depData.resolved as string;
    depData = pkgs[depData.resolved as string];
  }

  const dependencies = getGraphDependencies(
    depData.dependencies || {},
    depInfo.isDev,
  );

  const devDependencies = includeDevDeps
    ? getGraphDependencies(depData.devDependencies || {}, depInfo.isDev)
    : {};

  const optionalDependencies = includeOptionalDeps
    ? getGraphDependencies(depData.optionalDependencies || {}, depInfo.isDev)
    : {};

  return {
    id: `${name}@${depData.version}`,
    name: name,
    version: depData.version,
    dependencies: {
      ...dependencies,
      ...devDependencies,
      ...optionalDependencies,
    },
    isDev: depInfo.isDev,
    inBundle: depData.inBundle,
    key: childNodeKey,
  };
};

export const getChildNodeKey = (
  name: string,
  version: string,
  ancestry: Ancestor[],
  pkgs: Record<string, NpmLockPkg>,
  pkgKeysByName: Map<string, string[]>,
): string | undefined => {
  // This is a list of all our possible options for the package
  const candidateKeys = pkgKeysByName.get(name);
  if (!candidateKeys) {
    // Lockfile missing entry
    return undefined;
  }

  const matchingKeys =
    version === 'latest'
      ? candidateKeys
      : candidateKeys.filter((candidate) => {
          const candidatePkgVersion = pkgs[candidate].version;
          return semver.satisfies(candidatePkgVersion, version);
        });

  if (matchingKeys.length === 0) {
    // No entries satisfying the desired version
    return undefined;
  }

  // If we only have one candidate then we just take it
  if (matchingKeys.length === 1) {
    return matchingKeys[0];
  }

  let ancestors = ancestry.slice();

  // If we are bundled, we shouldn't consider ancestors outside of the bundle
  const bundleRootAncestorIndex = ancestors.findIndex((it) => it.inBundle);
  if (bundleRootAncestorIndex !== -1) {
    ancestors = ancestors.slice(bundleRootAncestorIndex - 1);
  }

  while (ancestors.length > 0) {
    // linter ignore reason: we verify the ancestors aren't empty just above it
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ancestor = ancestors.pop()!;
    const ancestorPrefix = ancestor.key ? `${ancestor.key}/` : '';
    const possibleKey = `${ancestorPrefix}node_modules/${name}`;
    if (matchingKeys.includes(possibleKey)) {
      return possibleKey;
    }
  }

  return undefined;

  // TODO Turn into method docs
  // We have a package, ancestry where it resides in the dep graph and all node_modules paths where package with this name is installed
  // We filter out those that don't work, that's fine, although checking if it works may be too optimistic
  // Then we should bubble up paths where that package is - check for current parent, higher parent etc up to the root
  // When checking parent need to evaluate where that parent is actually installed
  // We don't have that info, but we can check different paths where it could be; from most specific to least specific
  // actually when picking candidate, I think we need to check from most specific to least specific
  // going parent by parent may give local optimum, but wrong result
  // I think we should be evaluating the filtered candidates, or maybe what we will do is also the filtering on paths
  // having paths:
  // - ['guac', 'ansi-regex']
  // - ['string-width', 'ansi-regex']
  // - ['ansi-regex'] it has to pick the second one for the path
  // - ['guac', 'string-width', 'ansi-regex']
  // but only if there is no ['guac', 'string-width'] path
  // So we get a direct parent and see where it is installed
  // We can do that by:
  // A) checking where its parent is installed
  // B) see if it is under that parent. if not, repeat for the grandparent, etc.

  // That seems expensive to do it for every node, so precomputing would be great if possible
  // For all 1st level dependencies, the path is clear - it must be root so /1st
  // For 2nd level dependencies, the path is either /1st/2nd or /2nd (directly under root)
  // For 3rd level dependencies, the path is either ${parent}/3rd or {grandparent}/3rd
  // If any ancestor is a bundle, then path is at most ${bundleAncestor}/x, but can't be ${bundleAncestorParent}/x
};

interface Ancestor {
  name: string;
  key: string;
  inBundle: boolean;
}
