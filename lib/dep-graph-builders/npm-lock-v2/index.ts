import {
  DepGraphBuildOptions,
  Overrides,
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
): Promise<DepGraph> => {
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

  const pkgKeysByName: Map<string, string[]> = Object.keys(npmLockPkgs).reduce<
    Map<string, string[]>
  >((acc, key) => {
    const name = key.replace(/.*node_modules\//, '');
    if (!name) {
      return acc;
    }

    if (!acc.has(name)) {
      acc.set(name, []);
    }

    acc.get(name)!.push(key);

    return acc;
  }, new Map<string, string[]>());

  const visitedMap: Set<string> = new Set();
  await dfsVisit(
    depGraphBuilder,
    rootNode,
    visitedMap,
    npmLockPkgs,
    strictOutOfSync,
    includeDevDeps,
    includeOptionalDeps,
    true,
    [],
    pkgKeysByName,
    pkgJson.overrides,
  );

  return depGraphBuilder.build();
};

interface Ancestry {
  name: string;
  version: string;
  key: string;
  inBundle: boolean;
}

const dfsVisit = async (
  depGraphBuilder: DepGraphBuilder,
  node: PkgNode,
  visitedMap: Set<string>,
  npmLockPkgs: Record<string, NpmLockPkg>,
  strictOutOfSync: boolean,
  includeDevDeps: boolean,
  includeOptionalDeps: boolean,
  includePeerDeps: boolean,
  ancestry: Ancestry[],
  pkgKeysByName: Map<string, string[]>,
  overrides: Overrides | undefined,
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
      includePeerDeps,
      [
        ...ancestry,
        {
          name: node.name,
          version: node.version,
          key: node.key || '',
          inBundle: node.inBundle || false,
        },
      ],
      pkgKeysByName,
      overrides,
    );

    if (!childNode) {
      continue;
    }

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
        includePeerDeps,
        [
          ...ancestry,
          {
            name: node.name,
            version: node.version,
            key: node.key as string,
            inBundle: node.inBundle || false,
          },
        ],
        pkgKeysByName,
        overrides,
      );
    }

    depGraphBuilder.connectDep(node.id, childNode.id);
  }
};

const getChildNode = (
  name: string,
  depInfo: { version: string; isDev: boolean; isPeer: boolean; isOpt: boolean },
  pkgs: Record<string, NpmLockPkg>,
  strictOutOfSync: boolean,
  includeDevDeps: boolean,
  includeOptionalDeps: boolean,
  includePeerDeps: boolean,
  ancestry: Ancestry[],
  pkgKeysByName: Map<string, string[]>,
  overrides?: Overrides,
): PkgNode | undefined => {
  let version = depInfo.version;

  const override =
    overrides &&
    checkOverrides([...ancestry, { name, version }] as Ancestry[], overrides);

  if (override) {
    version = override;
  }

  if (version.startsWith('npm:')) {
    version = version.split('@').pop() || version;
  }

  let childNodeKey = getChildNodeKey(
    name,
    version,
    ancestry,
    pkgs,
    pkgKeysByName,
  );

  if (!childNodeKey) {
    // If it is a peerdep and is not in lockfile then...
    //    Ignore the dependency as it has not been installed by the developer,
    //    if these dependencies are wanted in the parsing, then they should be locked
    //    in the lockfile
    if (depInfo.isPeer || depInfo.isOpt) {
      return;
    } else if (strictOutOfSync) {
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

  const resolvedToWorkspace = (): boolean => {
    // Workspaces can be set as an array, or as an object
    // { packages: [] }, this can be checked in
    // https://github.com/npm/map-workspaces/blob/ff82968a3dbb78659fb7febfce4841bf58c514de/lib/index.js#L27-L41
    if (pkgs['']['workspaces'] === undefined) {
      return false;
    }

    const workspacesDeclaration = Array.isArray(
      pkgs['']['workspaces']['packages'],
    )
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
    ? getGraphDependencies(
        depData.optionalDependencies || {},
        depInfo.isDev,
        false,
        true,
      )
    : {};

  const peerDeps = includePeerDeps
    ? getGraphDependencies(depData.peerDependencies || {}, depInfo.isDev, true)
    : {};

  return {
    id: `${name}@${depData.version}`,
    name: name,
    version: depData.version,
    dependencies: {
      ...dependencies,
      ...devDependencies,
      ...optionalDependencies,
      ...peerDeps,
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

  // If we only have one candidate then we just take it...
  if (candidateKeys.length === 1) {
    // ... though we should still check if the version is viable

    if (
      semver.validRange(version) &&
      pkgs[candidateKeys[0]].version &&
      !semver.satisfies(pkgs[candidateKeys[0]].version, version)
    ) {
      return undefined;
    }

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

    const candidateAncestry = (
      candidate.startsWith('node_modules/')
        ? candidate.replace('node_modules/', '').split('/node_modules/')
        : candidate.split('/node_modules/')
    ).map((el) => {
      if (pkgs[el]) {
        return pkgs[el].name || el;
      }
      return el;
    });

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
    // if our version is valid semver
    if (semver.validRange(version)) {
      const candidatePkgVersion = pkgs[candidate].version;
      const doesVersionSatisfySemver = semver.satisfies(
        candidatePkgVersion,
        version,
      );
      return doesVersionSatisfySemver;
    }

    return true;
  });

  if (filteredCandidates.length === 1) {
    return filteredCandidates[0];
  }

  const ancestryNames = ancestry.map((el) => el.name).concat(name);
  while (ancestryNames.length > 0) {
    const possibleKey = `node_modules/${ancestryNames.join('/node_modules/')}`;

    if (filteredCandidates.includes(possibleKey)) {
      return possibleKey;
    }
    ancestryNames.shift();
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

const checkOverrides = (
  ancestry: Ancestry[],
  overrides: Overrides,
): string | undefined => {
  const ancestryWithoutRoot = ancestry.slice(1);
  // First traverse into overrides from root down
  for (const [idx, pkg] of ancestryWithoutRoot.entries()) {
    // Do we have this in overrides
    const override = matchOverrideKey(overrides, pkg);

    // If we dont find current element move down the ancestry
    if (!override) {
      continue;
    }

    // If we find a string as override we know we found what we want *if*
    // we are at our root
    if (
      idx + 1 === ancestryWithoutRoot.length &&
      typeof override === 'string'
    ) {
      return override;
    }

    // If we don't find a string we might have a dotted reference
    // we only care about this if we are the final element in the ancestry.
    if (idx + 1 === ancestryWithoutRoot.length && override['.']) {
      return override['.'];
    }

    // If we don't find a string or a dotted reference we need to recurse
    // to find the override
    const recursiveOverride = checkOverrides(ancestryWithoutRoot, override);

    // If we get a non-undefined result, it is our answer
    if (recursiveOverride) {
      return recursiveOverride;
    }
  }
  return;
};

// Here we have to match our pkg to
// possible keys in the overrides object
export const matchOverrideKey = (
  overrides: Overrides,
  pkg: { name: string; version: string },
): string | null => {
  if (overrides[pkg.name]) {
    return overrides[pkg.name];
  }

  const overrideKeysNameToVersions = Object.keys(overrides).reduce(
    (acc, key) => {
      // Split the key to separate the package name from the version spec
      const atIndex = key.lastIndexOf('@');
      const name = key.substring(0, atIndex);
      const versionSpec = key.substring(atIndex + 1);

      // Check if the package name already exists in the accumulator
      if (!acc[name]) {
        acc[name] = [];
      }

      // Add the version spec to the list of versions for this package name
      acc[name].push(versionSpec);

      return acc;
    },
    {},
  );

  const computedOverrides = overrideKeysNameToVersions[pkg.name];
  if (computedOverrides) {
    for (const versionSpec of computedOverrides) {
      const isPkgVersionSubsetOfOverrideSpec = semver.subset(
        pkg.version,
        semver.validRange(versionSpec) as string,
      );
      if (isPkgVersionSubsetOfOverrideSpec) {
        return overrides[`${pkg.name}@${versionSpec}`];
      }
    }
  }

  return null;
};
