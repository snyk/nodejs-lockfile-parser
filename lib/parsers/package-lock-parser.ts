import * as _ from 'lodash';
import * as graphlib from 'graphlib';
import * as uuid from 'uuid/v4';
import {setImmediatePromise} from '../set-immediate-promise';

import {LockfileParser, PkgTree, Dep, DepType, ManifestFile,
  getTopLevelDeps, Lockfile, LockfileType, createPkgTreeFromDep} from './';
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

interface CycleStartMap {
  [originalNode: string]: string;
}

interface EdgeDirection {
  inEdges: boolean;
  outEdges: boolean;
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
    manifestFile: ManifestFile, lockfile: Lockfile, includeDev = false,
    strictOutOfSync = true): Promise<PkgTree> {
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
    let cycleStarts: CycleStartMap = {};
    if (!graphlib.alg.isAcyclic(depGraph)) {
      const cycles: string[][] = graphlib.alg.findCycles(depGraph);
      for (const cycle of cycles) {
        // Since one of top level dependencies can be a start of cycle and that node
        // will be duplicated, we need to store a link between original node
        // and the new one in order to identify those duplicated top level dependencies
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
      const depName = cycleStarts[dep.name] || dep.name;
      if (depTrees[depName]) {
        // if the top level dependency is dev, all children are dev
        depTree.dependencies[dep.name] = dep.dev ?
          this.setDevDepRec(_.cloneDeep(depTrees[depName])) : depTrees[depName];
        await setImmediatePromise();
      } else if (/^file:/.test(dep.version)) {
        depTree.dependencies[dep.name] = createPkgTreeFromDep(dep);
      } else {
        if (!strictOutOfSync) {
          depTree.dependencies[dep.name] = createPkgTreeFromDep(dep);
          depTree.dependencies[dep.name].missingLockFileEntry = true;
        } else {
          throw new OutOfSyncError(depName, 'npm');
        }
      }
    }
    return depTree;
  }

  private setDevDepRec(pkgTree: PkgTree) {
    for (const [name, subTree] of _.entries(pkgTree.dependencies)) {
      pkgTree.dependencies[name] = this.setDevDepRec(subTree);
    }
    pkgTree.depType = DepType.dev;

    return pkgTree;
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
    cycle: string[], depMap: DepMap, depGraph: graphlib.Graph): CycleStartMap {

    /* FUNCTION DEFINITION
    To keep an order of algorithm steps readable, function is defined on-the-fly
    Arrow function is used for calling `this` without .bind(this) in the end
    */
    const acyclicDuplicationRec = (node, traversed, currentCycle, nodeCopy) => {
      // 2. For every cyclic dependency of entry node...
      const edgesToProcess = (depGraph.inEdges(node) as graphlib.Edge[])
      .filter((e) => _.includes(currentCycle, e.v));
      for (const edge of edgesToProcess) {
        // ... create a duplicate of the dependency...
        const child = edge.v;
        const dependencyCopy = this.cloneNodeWithoutEdges(child, depMap, depGraph);
        // ...and connect it with the duplicated entry node
        depGraph.setEdge(dependencyCopy, nodeCopy);
        // 3.a If edge goes to already-visited dependency, end of cycle is found;
        if (_.includes(traversed, child)) {
          // update metadata and do not continue traversing
          depMap[dependencyCopy].cyclic = true;
        } else {
          // 3.b Follow the edge and repeat the process, storing visited dependency-paths
          acyclicDuplicationRec(child, [...traversed, node], currentCycle, dependencyCopy);
          // All non-cyclic dependencies of duplicated node need to be updated.
          this.cloneAcyclicNodeEdges(child, dependencyCopy, cycle, depGraph,
          {inEdges: true, outEdges: false});
        }
      }
    };

    const cycleStarts: CycleStartMap = {};
    // For every node in a cycle:
    for (const start of cycle) {
      // 1. Create a uniqe duplicate of entry node (without edges)
      const clonedNode = this.cloneNodeWithoutEdges(start, depMap, depGraph);
      cycleStarts[start] = clonedNode;

      // CALL of previously defined function
      acyclicDuplicationRec(start, [], cycle, clonedNode);
      // 4. All non-cyclic dependencies or dependants of original node need to be
      //   updated to be connected with the duplicated one
      this.cloneAcyclicNodeEdges(start, clonedNode, cycle, depGraph,
        {inEdges: true, outEdges: true});
    }

    // Once completed for all nodes in a cycle, original cyclic nodes can
    // be removed.
    for (const start of cycle) {
      depGraph.removeNode(start);
    }

    return cycleStarts;
  }

  private cloneAcyclicNodeEdges(
    nodeFrom, nodeTo, cycle: string[], depGraph,
    {inEdges, outEdges}: EdgeDirection) {
    // node has to have edges
    const edges = depGraph.nodeEdges(nodeFrom) as graphlib.Edge[];
    if (outEdges) {
      const parentEdges = edges.filter((e) => !_.includes(cycle, e.w));
      for (const edge of parentEdges) {
        const parent = edge.w;
        depGraph.setEdge(nodeTo, parent);
      }
    }
    if (inEdges) {
      const childEdges = edges.filter((e) => !_.includes(cycle, e.v));
      for (const edge of childEdges) {
        const child = edge.v;
        depGraph.setEdge(child, nodeTo);
      }
    }

  }

  private cloneNodeWithoutEdges(node: string, depMap: DepMap, depGraph: graphlib.Graph): string {
    const newNode = node + uuid();
    // update depMap with new node
    depMap[newNode] =  _.cloneDeep(depMap[node]);
    // add new node to the graph
    depGraph.setNode(newNode);

    return newNode;
  }

  private createGraphOfDependencies(depMap: DepMap): graphlib.Graph {
    const depGraph = new graphlib.Graph();
    for (const depKey of Object.keys(depMap)) {
      depGraph.setNode(depKey);
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

    // Graph has to be acyclic
    if (!graphlib.alg.isAcyclic(depGraph)) {
      throw new Error('Cycles were not removed from graph.');
    }

    const depTrees: {[depPath: string]: PkgTree} = {};
    // topological sort guarantees that when we create a pkg-tree for a dep,
    // all it's sub-trees were already created. This also implies that leaf
    // packages will be processed first as they have no sub-trees.
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
      const pkgTree: PkgTree = {
        depType: dep.depType,
        dependencies: dep.dependencies,
        name: dep.name,
        version: dep.version,
      };
      if (dep.cyclic) {
        pkgTree.cyclic = dep.cyclic;
      }
      if (dep.hasDevDependencies) {
        pkgTree.hasDevDependencies = dep.hasDevDependencies;
      }
      depTrees[depKey] = pkgTree;
      // Since this code doesn't handle any I/O or network, we need to force
      // event loop to tick while being used in server for request processing
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

        const depPath: string[] = [...path, depName];
        const depKey = depPath.join(this.pathDelimiter);
        depMap[depKey] = depNode;
        if (dep.dependencies) {
          flattenLockfileRec(dep.dependencies, depPath);
        }
      }
    };

    flattenLockfileRec(lockfile.dependencies || {}, []);

    return depMap;
  }
}
