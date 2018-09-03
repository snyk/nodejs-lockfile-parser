import * as _ from 'lodash';
import * as graphlib from 'graphlib';
import * as uuid from 'uuid/v4';

import {LockfileParser, PkgTree, Dep, DepType, ManifestFile,
  getTopLevelDeps, Lockfile, LockfileType} from './';
import {InvalidUserInputError, OutOfSyncError} from '../errors';

export interface PackageLock {
  name: string;
  version: string;
  dependencies?: PackageLockDeps;
  lockfileVersion: number;
  type: LockfileType.npm;
}

export interface PackageLockDeps {
  [depName: string]: PackageLockDep;
}

export interface PackageLockDep {
  version: string;
  requires?: {
    [depName: string]: string;
  };
  dependencies?: PackageLockDeps;
  dev?: boolean;
}

interface DepMap {
  [path: string]: DepMapItem;
}

interface DepMapItem extends PkgTree {
  dependenciesPathsToProcess: string[];
}

export class PackageLockParser implements LockfileParser {

  private pathDelimiter = ',';

  public parseLockFile(lockFileContents: string): PackageLock {
    try {
      const packageLock: PackageLock = JSON.parse(lockFileContents);
      packageLock.type = LockfileType.npm;
      return packageLock;
    } catch (e) {
      throw new InvalidUserInputError('package-lock.json parsing failed with ' +
        `error ${e.message}`);
    }
  }

  public async getDependencyTree(
    manifestFile: ManifestFile, lockfile: Lockfile, includeDev = false): Promise<PkgTree> {
    if (lockfile.type !== LockfileType.npm) {
      throw new InvalidUserInputError('Unsupported lockfile provided. Please ' +
        'provide `package-lock.json`.');
    }
    const packageLock = lockfile as PackageLock;

    const depTree: PkgTree = {
      dependencies: {},
      hasDevDependencies: !_.isEmpty(manifestFile.devDependencies),
      name: manifestFile.name,
      version: manifestFile.version || '',
    };

    // asked to process empty deps
    if (_.isEmpty(manifestFile.dependencies) && !includeDev) {
      return depTree;
    }

    // prepare a flat map, where dependency path is a key to dependency object
    // path is an unique identifier for each dependency and corresponds to the
    // relative path on disc
    const depMap: DepMap = await this.flattenLockfile(packageLock);

    // all paths are identified, we can create a graph of their dependency
    const depGraph = this.createGraphOfDependencies(depMap);

    // topological sort will be applied and it requires acyclic graphs, so we
    // have to remove cycles
    const cycleStarts = {};
    if (!graphlib.alg.isAcyclic(depGraph)) {
      const cycles = graphlib.alg.findCycles(depGraph);
      for (const cycle of cycles) {
        removeCycle(cycle);
      }
    }

    /* Algorithm for cycle removal:
      For every node in a cycle:
        1. Create a duplicate of entry node (without edges)
        2. For every cyclic dependency of entry node, create a duplicate of
            the dependency and connect it with the duplicated entry node
        3.a If edge goes to already-visited dependency, end of cycle is found;
            update metadata and do not continue traversing
        3.b Follow the edge and repeat the process, storing visited dependency-paths.
            All non-cyclic dependencies of duplicated node need to be updated.
        4. All non-cyclic dependencies or dependants of original node need to be
          updated to be connected with the duplicated one

      Once completed for all nodes in a cycle, original cyclic nodes can
      be removed.
    */

    function removeCycle(cycle) {
      // For every node in a cycle:
      for (const start of cycle) {
        // 1. Create a duplicate of entry node (without edges)
        const newNode = start + uuid();
        cycleStarts[start] = newNode;
        depMap[newNode] = depMap[start];
        depGraph.setNode(newNode);
        walkCycleRec(start, [], cycle, newNode);
        // 4. All non-cyclic dependencies or dependants of original node need to be
        //   updated to be connected with the duplicated one
        // dependats
        const entryEdges = depGraph.outEdges(start).filter((e) => !cycle.includes(e.w));
        for (const edge of entryEdges) {
          depGraph.setEdge(newNode, edge.w);
        }
        // dependencies
        const outEdges = depGraph.inEdges(start).filter((e) => !cycle.includes(e.v));
        for (const edge of outEdges) {
          depGraph.setEdge(edge.v, newNode);
        }
      }

      // Once completed for all nodes in a cycle, original cyclic nodes can
      // be removed.
      for (const start of cycle) {
        depGraph.removeNode(start);
      }
    }

    function walkCycleRec(node, traversed, cycle, nodeCopy) {
      // 2. For every cyclic dependency of entry node, create a duplicate of
      // the dependency and connect it with the duplicated entry node
      const edges = depGraph.inEdges(node).filter((e) => cycle.includes(e.v));
      for (const edge of edges) {
        let copyName;
        if (traversed.includes(edge.v)) {
          // 3.a If edge goes to already-visited dependency, end of cycle is found;
          // update metadata and do not continue traversing
          copyName = edge.v + uuid();
          depGraph.setEdge(copyName, nodeCopy);
          // metadata update
          depMap[copyName] = _.cloneDeep(depMap[edge.v]);
          depMap[copyName].cyclic = true;
        } else {
          // 3.b Follow the edge and repeat the process, storing visited dependency-paths
          copyName = edge.v + uuid();
          // metadata update
          depMap[copyName] = _.cloneDeep(depMap[edge.v]);
          depGraph.setEdge(copyName, nodeCopy);
          walkCycleRec(edge.v, [...traversed, node], cycle, copyName);
          // All non-cyclic dependencies of duplicated node need to be updated.
          const edgesToCopy = depGraph.inEdges(edge.v).filter((e) => !cycle.includes(e.v));
          for (const edgeToCopy of edgesToCopy) {
            depGraph.setEdge(edgeToCopy.v, copyName);
          }
        }
      }
    }

    // transform depMap to a map of PkgTrees
    const depTreesCache: {[depPath: string]: PkgTree} = await this.createDepTrees(depMap, depGraph);

    // get trees for dependencies from manifest file
    const topLevelDeps: Dep[] = getTopLevelDeps(manifestFile, includeDev);
    await Promise.all(topLevelDeps.map(async (dep) => {
      const depName = cycleStarts[dep.name] ? cycleStarts[dep.name] : dep.name;
      if (depTreesCache[depName]) {
        depTree.dependencies[dep.name] = depTreesCache[depName];
      }
    }));

    return depTree;
  }

  private createGraphOfDependencies(depMap: DepMap): any {
    const depGraph = new graphlib.Graph();
    for (const depName of Object.keys(depMap)) {
      depGraph.setNode(depName, depName);
    }
    for (const [depPath, dep] of _.entries(depMap)) {
      for (const depName of dep.dependenciesPathsToProcess) {
        const subDepPath = this.findDepsPath(depPath, depName, depMap);
        // direction is from the dependency to the package requiring it
        depGraph.setEdge(subDepPath, depPath);
      }
    }

    return depGraph;
  }

  // dependency in package-lock.json v1 can be defined either inside `dependencies`
  // of other dependency or anywhere upward towards root
  private findDepsPath(startPath: string, depName: string, depMap: DepMap): string {
    const depPath = startPath.split(this.pathDelimiter);
    while (depPath.length) {
      const currentPath = depPath.concat(depName).toString();
      if (depMap[currentPath]) {
        return currentPath;
      }
      depPath.pop();
    }
    if (!depMap[depName]) {
      throw new OutOfSyncError(depName, 'npm');
    }

    return depName;
  }

  // Algorithm is based on dynamic programming technique and tries to build
  // "more simple" trees and compose them into bigger ones.
  private async createDepTrees(depMap: any, depGraph): Promise<{[depPath: string]: PkgTree}> {

    // Graph has to be acyclic
    if (!graphlib.alg.isAcyclic(depGraph)) {
      throw new Error('Cycles were not removed from graph.');
    }

    const depTrees: {[depPath: string]: PkgTree} = {};
    // topological sort guarantees that all the dependencies, which doesn't require
    // anything else, will be processed first
    const depOrder = graphlib.alg.topsort(depGraph);

    while (depOrder.length) {
      const depKey = depOrder.shift() as string;
      const dep = depMap[depKey];

      // direction is from the dependency to the package requiring it, so we are
      // looking for predecessors
      for (const subDepPath of depGraph.predecessors(depKey)) {
        const subDep = depTrees[subDepPath];
        dep.dependencies[subDep.name] = subDep;
      }
      delete dep.dependenciesPathsToProcess;
      depTrees[depKey] = {...dep as PkgTree};
    }

    // console.log(depTrees);

    return depTrees;
  }

  private async flattenLockfile(lockfile: PackageLock): Promise<DepMap> {
    const depQueue: DepMap = {};

    const flattenLockfileRec = async (lockfileDeps: PackageLockDeps, path: string[]) => {
      await Promise.all(_.entries(lockfileDeps).map(async ([depName, dep]) => {
        const depNode: DepMapItem = {
          depType: dep.dev ? DepType.dev : DepType.prod,
          dependencies: {},
          dependenciesPathsToProcess: [],
          name: depName,
          version: dep.version,
        };

        if (dep.requires) {
          depNode.dependenciesPathsToProcess = Object.keys(dep.requires);
        }

        const depKey: string[] = [...path, depName];
        depQueue[depKey.join(this.pathDelimiter)] = depNode;
        if (dep.dependencies) {
          await flattenLockfileRec(dep.dependencies, depKey);
        }
      }));
    };

    await flattenLockfileRec(lockfile.dependencies || {}, []);

    return depQueue;
  }
}
