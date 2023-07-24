import {
  PackageJsonBase,
  PnpmLock,
  PnpmLockDependency,
  PnpmLockPkg,
  PnpmParseOptions,
} from '../types';
import { DepGraph, DepGraphBuilder } from '@snyk/dep-graph';
import { parsePkgJson } from '../util';
import { parsePnpmLock } from './extract-packages';
import { OutOfSyncError } from '../../errors';
import { LockfileType } from '../../parsers';

export const parsePnpmProject = async (
  pkgJsonContent: string,
  pnpmLockContent: string,
  options: PnpmParseOptions,
): Promise<DepGraph> => {
  const { includeDevDeps, strictOutOfSync, includeOptionalDeps } = options;

  const pkgJson: PackageJsonBase = parsePkgJson(pkgJsonContent);
  const pnpmLock = parsePnpmLock(pnpmLockContent);

  const depgraph = await buildDepGraphPnpm(pnpmLock, pkgJson, {
    includeDevDeps,
    includeOptionalDeps,
    strictOutOfSync,
  });

  return depgraph;
};

const convertPnpmLockDependencyToPnpmLockPkg = (
  dependencies: Record<string, PnpmLockDependency>,
): Record<string, string> => {
  return Object.entries(dependencies || {}).reduce(
    (acc, [name, { version }]) => {
      return { ...acc, [name]: version };
    },
    {},
  );
};

const buildDepGraphPnpm = async (
  pnpmLock: PnpmLock,
  pkgJson: PackageJsonBase,
  options: PnpmParseOptions,
) => {
  const { includeDevDeps, strictOutOfSync, includeOptionalDeps } = options;
  const depGraphBuilder = new DepGraphBuilder(
    { name: 'pnpm' },
    { name: pkgJson.name as string, version: pkgJson.version },
  );

  const topLevelDeps = pnpmLock.dependencies;
  const rootNode: {
    id: string;
    name: string;
    version: string;
    dependencies: Record<string, string>;
    dev: string;
  } = {
    id: 'root-node',
    name: pkgJson.name,
    version: pkgJson.version,
    dependencies: convertPnpmLockDependencyToPnpmLockPkg(topLevelDeps),
    dev: 'false',
  };

  dfsVisit(depGraphBuilder, pnpmLock.packages, rootNode, strictOutOfSync);

  return depGraphBuilder.build();
};

const dfsVisit = (
  dgBuilder: DepGraphBuilder,
  pkgs: Record<string, PnpmLockPkg>,
  pkg: {
    id: string;
    name: string;
    version: string;
    dependencies: Record<string, string>;
    dev: string;
  },
  strictOutOfSync: boolean,
  visited?: Set<string>,
) => {
  for (const [depName, depVersion] of Object.entries(pkg.dependencies || {})) {
    const localVisited = visited || new Set<string>();

    const childId = `${depName}@${depVersion}`;
    let childPnpmLockPkg: PnpmLockPkg = pkgs[`/${childId}`];

    if (!childPnpmLockPkg) {
      if (strictOutOfSync) {
        throw new OutOfSyncError(`${depName}@${depVersion}`, LockfileType.pnpm);
      } else {
        childPnpmLockPkg = {
          dependencies: {},
          dev: pkg.dev,
        };
      }
    }

    const childPkg = {
      ...childPnpmLockPkg,
      id: childId,
      name: depName,
      version: depVersion,
    };

    if (localVisited.has(childId)) {
      const prunedId = `${childId}:pruned`;
      dgBuilder.addPkgNode(
        { name: childPkg.name, version: childPkg.version },
        prunedId,
        {
          labels: {
            pruned: 'true',
            scope: childPkg.dev === 'false' ? 'prod' : 'dev',
          },
        },
      );
      dgBuilder.connectDep(pkg.id, prunedId);
      continue;
    }

    dgBuilder.addPkgNode(
      { name: childPkg.name, version: childPkg.version },
      childId,
      { labels: { scope: childPkg.dev === 'false' ? 'prod' : 'dev' } },
    );
    dgBuilder.connectDep(pkg.id, childId);
    localVisited.add(childId);
    dfsVisit(dgBuilder, pkgs, childPkg, strictOutOfSync, localVisited);
  }
};
