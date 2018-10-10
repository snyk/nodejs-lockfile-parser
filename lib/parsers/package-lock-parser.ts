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
  requires: string[];
}

export class PackageLockParser implements LockfileParser {

  // package names must not contain URI unsafe characters, so one of them is
  // a good delimiter (https://www.ietf.org/rfc/rfc1738.txt)
  private pathDelimiter = '|';

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
    const depMap: DepMap = this.flattenLockfile(packageLock);

    // all paths are identified, we can create a graph representing what depends on what
    const depGraph: graphlib.Graph = this.createGraphOfDependencies(depMap);

    // topological sort will be applied and it requires acyclic graphs
    let cycleStarts = {}; // cycle starts are need for top level dependencies
    if (!graphlib.alg.isAcyclic(depGraph)) {
      const cycles: string[][] = graphlib.alg.findCycles(depGraph);
      for (const cycle of cycles) {
        cycleStarts = {...cycleStarts, ...this.removeCycle(cycle, depMap, depGraph)};
      }
    }

    // transform depMap to a map of PkgTrees
    const depTrees: {[depPath: string]: PkgTree} = await this.createDepTrees(depMap, depGraph);

    // get trees for dependencies from manifest file
    const topLevelDeps: Dep[] = getTopLevelDeps(manifestFile, includeDev);
    for (const dep of topLevelDeps) {
      // if any of top level dependencies is a part of cycle
      // it now has a different item in the map
      const depName = cycleStarts[dep.name] ? cycleStarts[dep.name] : dep.name;
      if (depTrees[depName]) {
        depTree.dependencies[dep.name] = depTrees[depName];
      }
    }
    return depTree;
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

  private removeCycle(
    cycle: string[], depMap: DepMap, depGraph: graphlib.Graph): {[cycleStart: string]: string} {

    function walkCycleRec(node, traversed, currentCycle, nodeCopy) {
      // 2. For every cyclic dependency of entry node...
      const edgesToProcess = (depGraph.inEdges(node) as graphlib.Edge[])
        .filter((e) => currentCycle.includes(e.v));
      for (const edge of edgesToProcess) {
      // ... create a duplicate of the dependency...
        const copyName = edge.v + uuid();
      // ...and connect it with the duplicated entry node
        depGraph.setEdge(copyName, nodeCopy);
        // metadata update
        depMap[copyName] = _.cloneDeep(depMap[edge.v]);
        if (traversed.includes(edge.v)) {
          // 3.a If edge goes to already-visited dependency, end of cycle is found;
          // update metadata and do not continue traversing
          depMap[copyName].cyclic = true;
        } else {
          // 3.b Follow the edge and repeat the process, storing visited dependency-paths
          // metadata update
          walkCycleRec(edge.v, [...traversed, node], currentCycle, copyName);
          // All non-cyclic dependencies of duplicated node need to be updated.
          const edgesToCopy = (depGraph.inEdges(edge.v) as graphlib.Edge[])
            .filter((e) => !currentCycle.includes(e.v));
          for (const edgeToCopy of edgesToCopy) {
            depGraph.setEdge(edgeToCopy.v, copyName);
          }
        }
      }
    }

    const cycleStarts = {};
    // For every node in a cycle:
    for (const start of cycle) {
      // 1. Create a uniqe duplicate of entry node (without edges)
      const newNode = start + uuid();
      cycleStarts[start] = newNode;
      depMap[newNode] = depMap[start];
      // update depMap with new node
      depGraph.setNode(newNode);
      walkCycleRec(start, [], cycle, newNode);
      // 4. All non-cyclic dependencies or dependants of original node need to be
      //   updated to be connected with the duplicated one

      // dependants
      const edges = depGraph.nodeEdges(start) as graphlib.Edge[]; // node has to have edges
      const entryEdges = edges.filter((e) => !_.includes(cycle, e.w));
      for (const edge of entryEdges) {
        depGraph.setEdge(newNode, edge.w);
      }
      // dependencies
      const outEdges = edges.filter((e) => !_.includes(cycle, e.v));
      for (const edge of outEdges) {
        depGraph.setEdge(edge.v, newNode);
      }
    }

    // Once completed for all nodes in a cycle, original cyclic nodes can
    // be removed.
    for (const start of cycle) {
      depGraph.removeNode(start);
    }

    return cycleStarts;
  }

  private createGraphOfDependencies(depMap: DepMap): graphlib.Graph {
    const depGraph = new graphlib.Graph();
    for (const depName of Object.keys(depMap)) {
      depGraph.setNode(depName, depName);
    }
    for (const [depPath, dep] of _.entries(depMap)) {
      for (const depName of dep.requires) {
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
      const currentPath = depPath.concat(depName).join(this.pathDelimiter);
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
  private async createDepTrees(depMap: DepMap, depGraph): Promise<{[depPath: string]: PkgTree}> {

    function setImmediatePromise() {
      return new Promise((resolve, reject) => {
        return setImmediate((err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      });
    }

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
      delete dep.requires;
      depTrees[depKey] = {...dep as PkgTree};
      await setImmediatePromise();
    }

    return depTrees;
  }

  private flattenLockfile(lockfile: PackageLock): DepMap {
    const depMap: DepMap = {};

    const flattenLockfileRec = (lockfileDeps: PackageLockDeps, path: string[]) => {
      for (const [depName, dep] of _.entries(lockfileDeps)) {
        const depNode: DepMapItem = {
          depType: dep.dev ? DepType.dev : DepType.prod,
          dependencies: {},
          name: depName,
          requires: [],
          version: dep.version,
        };

        if (dep.requires) {
          depNode.requires = Object.keys(dep.requires);
        }

        const depKey: string[] = [...path, depName];
        depMap[depKey.join(this.pathDelimiter)] = depNode;
        if (dep.dependencies) {
          flattenLockfileRec(dep.dependencies, depKey);
        }
      }
    };

    flattenLockfileRec(lockfile.dependencies || {}, []);

    return depMap;
  }
}
