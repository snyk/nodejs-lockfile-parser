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
  };

  const visitedMap: Set<string> = new Set();
  dfsVisit(
    depGraphBuilder,
    rootNode,
    visitedMap,
    npmLockPkgs,
    strictOutOfSync,
    includeOptionalDeps,
  );
  return depGraphBuilder.build();
};

const dfsVisit = (
  depGraphBuilder: DepGraphBuilder,
  node: PkgNode,
  visitedMap: Set<string>,
  npmLockPkgs: Record<string, NpmLockPkg>,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
): void => {
  visitedMap.add(node.id);

  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
    const childNode = getChildNode(
      name,
      depInfo,
      npmLockPkgs,
      strictOutOfSync,
      includeOptionalDeps,
      node,
    );

    if (!visitedMap.has(childNode.id)) {
      addPkgNodeToGraph(depGraphBuilder, childNode, {});
      dfsVisit(
        depGraphBuilder,
        childNode,
        visitedMap,
        npmLockPkgs,
        strictOutOfSync,
        includeOptionalDeps,
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
  includeOptionalDeps: boolean,
  parentNode: PkgNode,
) => {
  const childNodeKey = pkgs[
    `node_modules/${parentNode.name}/node_modules/${name}`
  ]
    ? `node_modules/${parentNode.name}/node_modules/${name}`
    : `node_modules/${name}`;

  if (!pkgs[childNodeKey]) {
    if (strictOutOfSync) {
      throw new OutOfSyncError(`${name}@${depInfo.version}`, LockfileType.npm);
    } else {
      return {
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
    return {
      id: `${name}@${depData.version}`,
      name: name,
      version: depData.version,
      dependencies: { ...dependencies, ...optionalDependencies },
      isDev: depInfo.isDev,
    };
  }
};
