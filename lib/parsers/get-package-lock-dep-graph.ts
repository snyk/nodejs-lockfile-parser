import {
  Dep,
  getTopLevelDeps,
  Lockfile,
  LockfileType,
  ManifestFile,
  Scope,
} from './index';
import { InvalidUserInputError, OutOfSyncError } from '../errors';
import { DepGraph, DepGraphBuilder } from '@snyk/dep-graph';
import {
  PackageLock,
  PackageLockDep,
  PackageLockDeps,
} from './package-lock-parser';
import { eventLoopSpinner } from 'event-loop-spinner';
import { getNodeId, NodeIdMap } from '../get-node-id';

type NodeId = string;
type MemoizationMap = Map<PackageLockDep, NodeId>;

export async function getPackageLockDepGraph(
  manifestFile: ManifestFile,
  lockfile: Lockfile,
  includeDev = false,
  strict = true,
): Promise<DepGraph> {
  if (lockfile.type !== LockfileType.npm) {
    throw new InvalidUserInputError(
      'Unsupported lockfile provided. Please ' + 'provide `package-lock.json`.',
    );
  }
  const packageLock = lockfile as PackageLock;

  linkRequiresToDependencies(packageLock.dependencies || {}, [packageLock]);

  const rootPkgInfo = {
    name: manifestFile.name,
    version: manifestFile.version,
  };

  const pkgManager = {
    name: LockfileType.npm,
  };

  const depGraphBuilder = new DepGraphBuilder(pkgManager, rootPkgInfo);

  const topLevelDeps: Dep[] = getTopLevelDeps(manifestFile, includeDev);

  const devMemoizationMap: MemoizationMap = new Map();
  const prodMemoizationMap: MemoizationMap = new Map();
  const nodeIdMap: NodeIdMap = {};

  for (const dep of topLevelDeps) {
    const dependency = packageLock.dependencies?.[dep.name];
    if (/^file:/.test(dep.version)) {
      addTopLevelDepNodeToGraph(depGraphBuilder, nodeIdMap, dep);
      continue;
    }

    const version = dependency?.version;
    if (strict && !version) {
      throw new OutOfSyncError(dep.name, LockfileType.npm);
    }
    const nodeId = addTopLevelDepNodeToGraph(
      depGraphBuilder,
      nodeIdMap,
      dep,
      version,
    );
    const isDev = !!dep.dev;

    await addDepsToGraph(
      depGraphBuilder,
      dependency?.linkedRequires,
      isDev,
      nodeIdMap,
      isDev ? devMemoizationMap : prodMemoizationMap,
      nodeId,
    );
  }

  return depGraphBuilder.build();
}

/** This function will add direct dependencies to the graph (aka "top level" dep) */
function addTopLevelDepNodeToGraph(
  depGraphBuilder: DepGraphBuilder,
  nodeIdMap: NodeIdMap,
  dep: Dep,
  version: string = dep.version,
) {
  const nodeId = getNodeId(nodeIdMap, dep.name, version);
  depGraphBuilder.addPkgNode({ name: dep.name, version }, nodeId, {
    labels: { scope: dep.dev ? Scope.dev : Scope.prod },
  });
  depGraphBuilder.connectDep(depGraphBuilder.rootNodeId, nodeId);
  return nodeId;
}

/*
 * This function will recursively iterate over a package-lock data structure
 * and will replace the `require` property with a `linkedRequires` that will
 * connect each 'require' dependency to it's actual PackageLockDep
 * (so it will be easier to iterate over later)
 */
function linkRequiresToDependencies(
  lockfileDeps: PackageLockDeps,
  ancestors: PackageLockDep[] = [],
): void {
  for (const dep of Object.values(lockfileDeps)) {
    const currentAncestors = [dep].concat(ancestors);
    if (dep.requires) {
      dep.linkedRequires = {};
      for (const key of Object.keys(dep.requires)) {
        dep.linkedRequires[key] = find(key, currentAncestors);
      }
      delete dep.requires;
    }

    if (dep.dependencies) {
      linkRequiresToDependencies(dep.dependencies, currentAncestors);
    }
  }
}

function find(key: string, ancestors: PackageLockDep[] = []): PackageLockDep {
  for (const dep of ancestors) {
    if (dep.dependencies?.[key]) {
      return dep.dependencies[key];
    }
  }
  throw new Error('');
}

/*
 * This function will recursively iterate over the "linked" version of the package-lock (after linkRequiresToDependencies)
 * and will add each dependency to the graph.
 * It uses a memoization map inorder not to re-iterate on visited dependencies
 * It uses 'nodeIdMap' inorder to create different nodeIds for different dependencies for the same version
 * (i.e. in a package-lock file you might get the same package with the same version but with different dependencies)
 * */
async function addDepsToGraph(
  depGraphBuilder: DepGraphBuilder,
  lockDeps: PackageLockDeps = {},
  isDev: boolean,
  nodeIdMap: NodeIdMap,
  memoizationMap: MemoizationMap,
  parentNodeId: string,
): Promise<void> {
  for (const [depName, dep] of Object.entries(lockDeps)) {
    const nodeId = getNodeId(nodeIdMap, depName, dep.version);
    if (memoizationMap.has(dep)) {
      depGraphBuilder.connectDep(parentNodeId, memoizationMap.get(dep)!);
      continue;
    }

    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }

    depGraphBuilder.addPkgNode(
      { name: depName, version: dep.version },
      nodeId,
      { labels: { scope: isDev ? Scope.dev : Scope.prod } },
    );

    depGraphBuilder.connectDep(parentNodeId, nodeId);
    memoizationMap.set(dep, nodeId);

    if (dep.linkedRequires) {
      await addDepsToGraph(
        depGraphBuilder,
        dep.linkedRequires,
        isDev,
        nodeIdMap,
        memoizationMap,
        nodeId,
      );
    }
  }
}
