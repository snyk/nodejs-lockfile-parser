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
    inBundle: false,
  };

  const visitedMap: Set<string> = new Set();
  dfsVisit(
    depGraphBuilder,
    rootNode,
    visitedMap,
    npmLockPkgs,
    strictOutOfSync,
    includeOptionalDeps,
    [],
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
  ancestry: { name: string; inBundle: boolean }[],
): void => {
  visitedMap.add(node.id);

  for (const [name, depInfo] of Object.entries(node.dependencies || {})) {
    // console.log(node);
    const childNode = getChildNode(
      name,
      depInfo,
      npmLockPkgs,
      strictOutOfSync,
      includeOptionalDeps,
      [...ancestry, { name: node.name, inBundle: node.inBundle || false }],
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
        [...ancestry, { name: node.name, inBundle: node.inBundle || false }],
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
  ancestry: { name: string; inBundle: boolean }[],
) => {
  const childNodeKey = getChildNodeKey(name, ancestry, pkgs); //

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
      inBundle: depData.inBundle,
    };
  }
};

const getChildNodeKey = (
  name: string,
  ancestry: { name: string; inBundle: boolean }[],
  pkgs: Record<string, NpmLockPkg>,
) => {
  const parent = ancestry[ancestry.length - 1];
  if (parent.inBundle) {
    const bundleRootIdx = ancestry.findIndex((el) => el.inBundle === true) - 1;
    const ancestryNamesOfInterest = ancestry
      .slice(bundleRootIdx)
      .map((ancestry) => ancestry.name)
      .concat([name]);

    const getPossibleDepPaths = (currPaths: string[]): string[] => {
      if (currPaths.length === 1) {
        return currPaths;
      }

      const first = currPaths[0];
      const rest = currPaths.slice(1);

      const resPaths = getPossibleDepPaths(rest);
      return resPaths.map((el) => `${first}/${el}`).concat(resPaths);
    };

    for (
      let splitPoint = ancestryNamesOfInterest.length - 1;
      splitPoint > 0;
      splitPoint--
    ) {
      const left = ancestryNamesOfInterest.slice(0, splitPoint);
      const right = ancestryNamesOfInterest.slice(splitPoint);

      if (right.length === 1) {
        const key = `node_modules/${left.join(
          '/node_modules/',
        )}/node_modules/${name}`;
        if (pkgs[key]) {
          return key;
        }
      } else {
        for (
          let rightPointer = 1;
          rightPointer < right.length;
          rightPointer++
        ) {
          const options = getPossibleDepPaths(right.slice(rightPointer));
          for (let optIdx = 0; optIdx < options.length; optIdx++) {
            const rightConcat = `node_modules/${options[optIdx].replace(
              /\//g,
              '/node_modules/',
            )}`;

            const key = `node_modules/${left.join(
              '/node_modules/',
            )}/${rightConcat}`;
            if (pkgs[key]) {
              return key;
            }
          }
        }
      }
    }
  }

  // If not in bundle then we can just see if it is scoped by parent
  // and then just look directly for it
  if (ancestry.length === 1) {
    return `node_modules/${name}`;
  }

  const parentName = ancestry[ancestry.length - 1].name;
  return pkgs[`node_modules/${parentName}/node_modules/${name}`]
    ? `node_modules/${parentName}/node_modules/${name}`
    : `node_modules/${name}`;
};
