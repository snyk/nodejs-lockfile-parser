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
import { parseNpmAlias } from '../../aliasesPreprocessors/pkgJson';

import * as semver from 'semver';
import * as micromatch from 'micromatch';
import * as pathUtil from 'path';
import { eventLoopSpinner } from 'event-loop-spinner';
import { rewriteAliasesPkgJson } from '../../aliasesPreprocessors/pkgJson';

export { extractPkgsFromNpmLockV2 };

const ROOT_NODE_ID = 'root-node';

export const parseNpmLockV2Project = async (
  pkgJsonContent: string,
  pkgLockContent: string,
  options: ProjectParseOptions,
): Promise<DepGraph> => {
  const {
    includeDevDeps,
    strictOutOfSync,
    includeOptionalDeps,
    pruneNpmStrictOutOfSync,
  } = options;

  const pkgJson: PackageJsonBase = parsePkgJson(
    options.honorAliases
      ? rewriteAliasesPkgJson(pkgJsonContent)
      : pkgJsonContent,
  );
  const pkgs = extractPkgsFromNpmLockV2(pkgLockContent);

  const depgraph = await buildDepGraphNpmLockV2(pkgs, pkgJson, {
    includeDevDeps,
    includeOptionalDeps,
    strictOutOfSync,
    pruneNpmStrictOutOfSync,
  });

  return depgraph;
};

export const buildDepGraphNpmLockV2 = async (
  npmLockPkgs: Record<string, NpmLockPkg>,
  pkgJson: PackageJsonBase,
  options: DepGraphBuildOptions,
): Promise<DepGraph> => {
  const {
    includeDevDeps,
    strictOutOfSync,
    includeOptionalDeps,
    pruneNpmStrictOutOfSync,
  } = options;
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
    id: ROOT_NODE_ID,
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
    pkgJson.overrides,
    pruneNpmStrictOutOfSync,
  );
  return depGraphBuilder.build();
};

interface Ancestry {
  id: string;
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
  ancestry: Ancestry[],
  pkgKeysByName: Map<string, string[]>,
  overrides: Overrides | undefined,
  pruneNpmStrictOutOfSync?: boolean,
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
          id: node.id,
          name: node.name,
          version: node.version,
          key: node.key || '',
          inBundle: node.inBundle || false,
        },
      ],
      pkgKeysByName,
      overrides,
      pruneNpmStrictOutOfSync,
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
            id: node.id,
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
  pkgs: Record<string, NpmLockPkg>,
  strictOutOfSync: boolean,
  includeDevDeps: boolean,
  includeOptionalDeps: boolean,
  ancestry: Ancestry[],
  pkgKeysByName: Map<string, string[]>,
  overrides?: Overrides,
  pruneNpmStrictOutOfSync?: boolean,
) => {
  let version = depInfo.version;
  let aliasInfo = depInfo.alias;

  const override =
    overrides &&
    checkOverrides([...ancestry, { name, version }] as Ancestry[], overrides);

  if (override) {
    version = override;

    // If the override is an alias (starts with npm:), extract alias information
    const parsed = parseNpmAlias(version);
    if (parsed) {
      aliasInfo = {
        aliasName: name,
        aliasTargetDepName: parsed.packageName,
        semver: parsed.version,
        version: parsed.version,
      };
      version = parsed.version;
    }
  } else if (version.startsWith('npm:')) {
    // Handle non-override aliases
    const parsed = parseNpmAlias(version);
    if (parsed) {
      aliasInfo = {
        aliasName: name,
        aliasTargetDepName: parsed.packageName,
        semver: parsed.version,
        version: parsed.version,
      };
      version = parsed.version;
    } else {
      // Fallback if parsing fails
      version = version.split('@').pop() || version;
    }
  }

  let childNodeKey = getChildNodeKey(
    aliasInfo ? aliasInfo.aliasName : name,
    version,
    ancestry,
    pkgs,
    pkgKeysByName,
    pruneNpmStrictOutOfSync,
  );

  if (!childNodeKey) {
    // Handle optional dependencies that don't have separate package entries
    if (depInfo.isOptional) {
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

    // https://snyksec.atlassian.net/wiki/spaces/SCA/pages/3785687123/NPM+Bundled+Dependencies+Analysis
    // Check if this dependency is bundled in the parent package
    // Bundled dependencies may not have separate lockfile entries when
    // the package is installed from registry (they're pre-packaged in the tarball)
    const parentNode = ancestry[ancestry.length - 1];
    if (parentNode && parentNode.key) {
      const parentPkg = pkgs[parentNode.key];
      if (parentPkg && isBundledDependency(name, parentPkg)) {
        // This is a bundled dependency without a lockfile entry
        // Return a placeholder node - we don't have sub-dependency information
        return {
          id: `${name}@${depInfo.version}`,
          name: name,
          version: '', // empty version since we cannot resolve the semver for bundled deps
          dependencies: {},
          isDev: depInfo.isDev,
          inBundle: true,
          key: '',
        };
      }
    }

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

  const dependencies = getGraphDependencies(depData.dependencies || {}, {
    isDev: depInfo.isDev,
  });

  const devDependencies = includeDevDeps
    ? getGraphDependencies(depData.devDependencies || {}, {
        isDev: depInfo.isDev,
      })
    : {};

  const optionalDependencies = includeOptionalDeps
    ? getGraphDependencies(depData.optionalDependencies || {}, {
        isDev: depInfo.isDev,
        isOptional: true,
      })
    : {};

  return {
    id: `${name}@${depData.version}`,
    name: aliasInfo?.aliasTargetDepName ?? name,
    version: depData.version,
    dependencies: {
      ...dependencies,
      ...devDependencies,
      ...optionalDependencies,
    },
    isDev: depInfo.isDev,
    inBundle: depData.inBundle,
    key: childNodeKey,
    ...(aliasInfo ? { alias: { ...aliasInfo, version: depData.version } } : {}),
  };
};

// Checks if a dependency is bundled in the parent package.
// Bundled dependencies are included in the parent's published tarball
// and may not have separate entries in the lockfile when installed from registry.
function isBundledDependency(depName: string, parentPkg: NpmLockPkg): boolean {
  // Check both spellings (bundleDependencies is canonical, bundledDependencies is alternative)
  const bundled = parentPkg.bundleDependencies || parentPkg.bundledDependencies;

  if (!bundled || !Array.isArray(bundled)) {
    return false;
  }

  return bundled.includes(depName);
}

export const getChildNodeKey = (
  name: string,
  version: string,
  ancestry: { id: string; name: string; key: string; inBundle: boolean }[],
  pkgs: Record<string, NpmLockPkg>,
  pkgKeysByName: Map<string, string[]>,
  pruneNpmStrictOutOfSync?: boolean,
): string | undefined => {
  // This is a list of all our possible options for the childKey
  const candidateKeys = pkgKeysByName.get(name);

  // Lockfile missing entry
  if (!candidateKeys) {
    return undefined;
  }

  // If we only have one candidate then we just take it
  if (candidateKeys.length === 1) {
    if (
      semver.validRange(version) &&
      pkgs[candidateKeys[0]].version &&
      !semver.satisfies(pkgs[candidateKeys[0]].version, version) &&
      pruneNpmStrictOutOfSync
    ) {
      //TODO: Add some logs to monitor
      return undefined;
    }
    return candidateKeys[0];
  }

  // Always use the full ancestry (excluding the true root)
  // The lockfile paths reflect the actual file system structure, which may or may not
  // include all ancestors depending on hoisting
  const isBundled = ancestry[ancestry.length - 1].inBundle;

  // Base ancestry without the current package - we'll add the package with
  // the correct resolved name per-candidate during filtering
  const baseAncestryFromRoot = ancestry.slice(1);

  // Find the bundle owner for the bundle root check below
  let bundleOwnerName: string | undefined;
  if (isBundled) {
    const firstBundledIdx = ancestry.findIndex((el) => el.inBundle === true);
    if (firstBundledIdx > 0) {
      const potentialBundleOwner = ancestry[firstBundledIdx - 1];
      if (potentialBundleOwner && potentialBundleOwner.key) {
        const ownerPkg = pkgs[potentialBundleOwner.key];
        if (
          ownerPkg &&
          (ownerPkg.bundledDependencies || ownerPkg.bundleDependencies)
        ) {
          bundleOwnerName = potentialBundleOwner.name;
        }
      }
    }
  }

  // We filter on a number of cases
  let filteredCandidates = candidateKeys.filter((candidate) => {
    // This is splitting the candidate that looks like
    // `node_modules/a/node_modules/b` into ["a", "b"]
    // To do this we remove the first node_modules substring
    // and then split on the rest

    // Build candidateAncestry by reconstructing full paths and resolving package names
    // This is needed to properly resolve aliases (e.g., lib-v3 -> @example/component-lib)
    const segments = candidate.startsWith('node_modules/')
      ? candidate.replace('node_modules/', '').split('/node_modules/')
      : candidate.split('/node_modules/');

    const candidateAncestry = segments.map((segment, idx) => {
      // Reconstruct the full path up to this segment
      const pathSegments = segments.slice(0, idx + 1);
      const fullPath = 'node_modules/' + pathSegments.join('/node_modules/');

      // Look up using the full path to resolve aliases
      if (pkgs[fullPath]) {
        return pkgs[fullPath].name || segment;
      }

      // For workspace packages, the path might not have node_modules/ prefix
      // Check if this segment (or joined path) exists as a workspace package
      const workspacePath = pathSegments.join('/node_modules/');
      if (pkgs[workspacePath]) {
        return pkgs[workspacePath].name || segment;
      }

      return segment;
    });

    // Resolve the real package name for THIS specific candidate
    // This is important when there are aliases - each candidate may resolve to a different real name
    const candidatePkg = pkgs[candidate];
    const resolvedNameForCandidate =
      candidatePkg && candidatePkg.name ? candidatePkg.name : name;

    // Build the full ancestry including the current package with its resolved name
    const ancestryFromRootOperatingIdx = [
      ...baseAncestryFromRoot,
      { id: `${name}@${version}`, name: resolvedNameForCandidate, version },
    ];

    // Check the ancestry of the candidate is a subset of
    // the current pkg. If it is not then it can't be a
    // valid key.
    const isCandidateAncestryIsSubsetOfPkgAncestry = candidateAncestry.every(
      (pkg) => {
        return ancestryFromRootOperatingIdx.find((p) => p.name == pkg);
      },
    );

    if (isCandidateAncestryIsSubsetOfPkgAncestry === false) {
      return false;
    }

    // If we are bundled, check if the candidate shares the same bundle owner
    // The bundle owner should appear in the candidate path
    if (isBundled && bundleOwnerName) {
      const doesCandidateIncludeBundleOwner =
        candidateAncestry.includes(bundleOwnerName);

      if (!doesCandidateIncludeBundleOwner) {
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

  // Here we go through the ancestry backwards to find the nearest
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

  // If we still have multiple candidates, prefer the one with the most path segments
  // (i.e., the deepest one, which is closest to the requesting package)
  if (filteredCandidates.length > 1) {
    filteredCandidates.sort((a, b) => {
      const aDepth = a.split('/node_modules/').length;
      const bDepth = b.split('/node_modules/').length;
      return bDepth - aDepth; // Prefer deeper paths
    });
    return filteredCandidates[0];
  }

  return filteredCandidates.length === 1 ? filteredCandidates[0] : undefined;
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
