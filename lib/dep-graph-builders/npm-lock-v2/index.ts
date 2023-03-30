import {
  DepGraphBuildOptions,
  PackageJsonBase,
  ProjectParseOptions,
} from '../types';
import { extractPkgsFromNpmLockV2 } from './extract-npm-lock-v2-pkgs';
import type { NpmLockPkg } from './extract-npm-lock-v2-pkgs';
import { DepGraphBuilder } from '@snyk/dep-graph';
import {
  addPkgNodeToGraph,
  getGraphDependencies,
  getTopLevelDeps,
  parsePkgJson,
  PkgNode,
} from '../util';
import { OutOfSyncError } from '../../errors';
import { LockfileType } from '../../parsers';

import * as micromatch from 'micromatch';
import * as pathUtil from 'path';

export { extractPkgsFromNpmLockV2 };

export const parseNpmLockV2Project = (
  pkgJsonContent: string,
  pkgLockContent: string,
  options: ProjectParseOptions,
) => {
  const { includeDevDeps, strictOutOfSync, includeOptionalDeps } = options;

  const pkgJson: PackageJsonBase = parsePkgJson(pkgJsonContent);
  const pkgs = extractPkgsFromNpmLockV2(pkgLockContent);

  const depgraph = buildDepGraphNpmLockV2(pkgs, pkgJson, {
    includeDevDeps,
    includeOptionalDeps,
    strictOutOfSync,
  });

  return depgraph;
};

export const buildDepGraphNpmLockV2 = (
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
  dfsVisit(
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

const dfsVisit = (
  depGraphBuilder: DepGraphBuilder,
  node: PkgNode,
  visitedMap: Set<string>,
  npmLockPkgs: Record<string, NpmLockPkg>,
  strictOutOfSync: boolean,
  includeDevDeps: boolean,
  includeOptionalDeps: boolean,
  ancestry: { name: string; key: string; inBundle: boolean }[],
  pkgKeysByName: Map<string, string[]>,
): void => {
  visitedMap.add(node.id);

  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
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
      dfsVisit(
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
  let childNodeKey = getChildNodeKey(name, ancestry, pkgs, pkgKeysByName); //

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
  ancestry: { name: string; key: string; inBundle: boolean }[],
  pkgs: Record<string, NpmLockPkg>,
  pkgKeysByName: Map<string, string[]>,
): string | undefined => {
  const candidateKeys = pkgKeysByName.get(name);

  // Lockfile missing entry
  if (!candidateKeys) {
    return undefined;
  }

  // Only one candidate then just take it
  if (candidateKeys.length === 1) {
    return candidateKeys[0];
  }

  const rootOperatingIdx = ancestry[ancestry.length - 1].inBundle
    ? ancestry.findIndex((el) => el.inBundle === true) - 1
    : 0;
  const ancestryFromBundleId = [
    ...ancestry.slice(rootOperatingIdx).map((el) => el.name),
    name,
  ];

  const candidateAncestries = candidateKeys.map((el) =>
    el.replace('node_modules/', '').split('/node_modules/'),
  );

  const filteredCandidates = candidateKeys.filter((candidate, idx) => {
    return candidateAncestries[idx].every((pkg) => {
      return ancestryFromBundleId.includes(pkg);
    });
  });

  if (filteredCandidates.length === 1) {
    return filteredCandidates[0];
  }

  const sortedKeys = filteredCandidates.sort(
    (a, b) =>
      b.split('/node_modules/').length - a.split('/node_modules/').length,
  );

  const longestPathLength = sortedKeys[0].split('/node_modules/').length;
  const onlyLongestKeys = sortedKeys.filter(
    (key) => key.split('/node_modules/').length === longestPathLength,
  );

  if (onlyLongestKeys.length === 1) {
    return onlyLongestKeys[0];
  }

  // Here we go through parents keys to see if any are the branch point
  // we could have done this sooner but the above work as good short circuits
  let keysFilteredByParentKey = onlyLongestKeys;
  const reversedAncestry = ancestry.reverse();
  for (
    let parentIndex = 0;
    parentIndex < reversedAncestry.length;
    parentIndex++
  ) {
    const parentKey = reversedAncestry[parentIndex].key;
    const possibleFilteredKeys = keysFilteredByParentKey.filter((key) =>
      key.includes(parentKey),
    );

    if (possibleFilteredKeys.length === 1) {
      return possibleFilteredKeys[0];
    }

    if (possibleFilteredKeys.length === 0) {
      continue;
    }

    keysFilteredByParentKey = possibleFilteredKeys;
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

  return undefined;
};
