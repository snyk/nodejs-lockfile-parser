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
  ancestry: { name: string; key: string; inBundle: boolean }[],
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
  ancestry: { name: string; key: string; inBundle: boolean }[],
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

    // Workspaces can be set as an array, or as an object
    // { packages: [] }, this can be checked in
    // https://github.com/npm/map-workspaces/blob/ff82968a3dbb78659fb7febfce4841bf58c514de/lib/index.js#L27-L41
    const workspacesDeclaration = 
      Array.isArray(pkgs['']['workspaces']['packages'])
        ? pkgs['']['workspaces']['packages']
        : pkgs['']['workspaces'] || [];

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
  ancestry: { name: string; key: string; inBundle: boolean }[],
  pkgs: Record<string, NpmLockPkg>,
  pkgKeysByName: Map<string, string[]>,
): string | undefined => {
  // This is a list of all our possible options for the childKey
  const candidateKeys = pkgKeysByName.get(name);

  // Lockfile missing entry
  if (!candidateKeys) {
    return undefined;
  }

  // If we only have one candidate then we just take it
  if (candidateKeys.length === 1) {
    return candidateKeys[0];
  }
  // If we are bundled we assume we are scoped by the bundle root at least
  // otherwise the ancestry root is the root ignoring the true root
  const isBundled = ancestry[ancestry.length - 1].inBundle;
  const rootOperatingIdx = isBundled
    ? ancestry.findIndex((el) => el.inBundle === true) - 1
    : 1;
  const ancestryFromRootOperatingIdx = [
    ...ancestry.slice(rootOperatingIdx).map((el) => el.name),
    name,
  ];

  // We filter on a number of cases
  let filteredCandidates = candidateKeys.filter((candidate) => {
    // This is splitting the candidate that looks like
    // `node_modules/a/node_modules/b` into ["a", "b"]
    // To do this we remove the first node_modules substring
    // and then split on the rest
    const candidateAncestry = candidate
      .replace('node_modules/', '')
      .split('/node_modules/');

    // Check the ancestry of the candidate is a subset of
    // the current pkg. If it is not then it can't be a
    // valid key.
    const isCandidateAncestryIsSubsetOfPkgAncestry = candidateAncestry.every(
      (pkg) => {
        return ancestryFromRootOperatingIdx.includes(pkg);
      },
    );

    if (isCandidateAncestryIsSubsetOfPkgAncestry === false) {
      return false;
    }

    // If we are bundled we assume the bundle root is the first value
    // in the candidates scoping
    if (isBundled) {
      const doesBundledPkgShareBundleRoot =
        candidateAncestry[0] === ancestryFromRootOperatingIdx[0];

      if (doesBundledPkgShareBundleRoot === false) {
        return false;
      }
    }

    // So now we can check semver to filter out some values
    const candidatePkgVersion = pkgs[candidate].version;
    const doesVersionSatisfySemver = semver.satisfies(
      candidatePkgVersion,
      version,
    );

    return doesVersionSatisfySemver;
  });

  if (filteredCandidates.length === 1) {
    return filteredCandidates[0];
  }

  const ancestry_names = ancestry.map((el) => el.name).concat(name);
  while (ancestry_names.length > 0) {
    const possible_key = `node_modules/${ancestry_names.join(
      '/node_modules/',
    )}`;

    if (pkgs[possible_key]) {
      return possible_key;
    }
    ancestry_names.shift();
  }

  // Here we go through th eancestry backwards to find the nearest
  // ancestor package
  const reversedAncestry = ancestry.reverse();
  for (
    let parentIndex = 0;
    parentIndex < reversedAncestry.length;
    parentIndex++
  ) {
    const parentName = reversedAncestry[parentIndex].name;
    const possibleFilteredKeys = filteredCandidates.filter((key) =>
      key.includes(parentName),
    );

    if (possibleFilteredKeys.length === 1) {
      return possibleFilteredKeys[0];
    }

    if (possibleFilteredKeys.length === 0) {
      continue;
    }

    filteredCandidates = possibleFilteredKeys;
  }

  return undefined;
};
