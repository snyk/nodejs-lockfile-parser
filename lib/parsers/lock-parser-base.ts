import * as _cloneDeep from 'lodash.clonedeep';
import * as _isEmpty from 'lodash.isempty';
import * as _set from 'lodash.set';
import * as _toPairs from 'lodash.topairs';
import * as graphlib from '@snyk/graphlib';
import { v4 as uuid } from 'uuid';
import { eventLoopSpinner } from 'event-loop-spinner';

import {
  createDepTreeDepFromDep,
  Dep,
  DepTreeDep,
  getTopLevelDeps,
  Lockfile,
  LockfileParser,
  LockfileType,
  ManifestFile,
  PkgTree,
  Scope,
} from './';
import {
  InvalidUserInputError,
  OutOfSyncError,
  TreeSizeLimitError,
} from '../errors';

export interface PackageLockDeps {
  [depName: string]: PackageLockDep;
}

export interface PackageLockDep {
  version: string;
  requires?: {
    [depName: string]: string;
  };

  resolved?: string;
  integrity?: string;

  dependencies?: PackageLockDeps;
  dev?: boolean;
}

export interface DepMap {
  [path: string]: DepMapItem;
}

export interface DepMapItem extends DepTreeDep {
  requires: string[];
}

interface CycleStartMap {
  [originalNode: string]: string;
}

interface EdgeDirection {
  inEdges: boolean;
  outEdges: boolean;
}

export abstract class LockParserBase implements LockfileParser {
  protected pathDelimiter = '|';

  constructor(protected type: LockfileType, protected treeSizeLimit: number) {}

  public abstract parseLockFile(lockFileContents: string): Lockfile;

  public async getDependencyTree(
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev = false,
    strict = true,
  ): Promise<PkgTree> {
    if (lockfile.type !== this.type) {
      throw new InvalidUserInputError(
        'Unsupported lockfile provided. Please ' +
          'provide `package-lock.json`.',
      );
    }
    const yarnLock = lockfile as Lockfile;

    const depTree: PkgTree = {
      dependencies: {},
      hasDevDependencies: !_isEmpty(manifestFile.devDependencies),
      name: manifestFile.name,
      size: 1,
      version: manifestFile.version || '',
    };

    const nodeVersion = manifestFile?.engines?.node;

    if (nodeVersion) {
      _set(depTree, 'meta.nodeVersion', nodeVersion);
    }

    // asked to process empty deps
    if (_isEmpty(manifestFile.dependencies) && !includeDev) {
      return depTree;
    }

    // prepare a flat map, where dependency path is a key to dependency object
    // path is an unique identifier for each dependency and corresponds to the
    // relative path on disc
    const depMap: DepMap = this.getDepMap(yarnLock);

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
        cycleStarts = {
          ...cycleStarts,
          ...this.removeCycle(cycle, depMap, depGraph),
        };
      }
    }

    // transform depMap to a map of PkgTrees
    const { depTrees, depTreesSizes } = await this.createDepTrees(
      depMap,
      depGraph,
    );

    // get trees for dependencies from manifest file
    const topLevelDeps: Dep[] = getTopLevelDeps(
      manifestFile,
      includeDev,
      lockfile,
    );

    // number of dependencies including root one
    let treeSize = 1;
    for (const dep of topLevelDeps) {
      if (treeSize > this.treeSizeLimit) {
        throw new TreeSizeLimitError();
      }
      // if any of top level dependencies is a part of cycle
      // it now has a different item in the map
      const key = this.getDepTreeKey(dep);
      const depName = cycleStarts[key] || key;
      if (depTrees[depName]) {
        // if the top level dependency is dev, all children are dev
        depTree.dependencies[dep.name] = dep.dev
          ? this.setDevDepRec(_cloneDeep(depTrees[depName]))
          : depTrees[depName];
        treeSize += depTreesSizes[depName];
        if (eventLoopSpinner.isStarving()) {
          await eventLoopSpinner.spin();
        }
      } else if (/^file:/.test(dep.version)) {
        depTree.dependencies[dep.name] = createDepTreeDepFromDep(dep);
        treeSize++;
      } else {
        // TODO: also check the package version
        // for a stricter check
        if (strict) {
          throw new OutOfSyncError(dep.name, this.type);
        }

        depTree.dependencies[dep.name] = createDepTreeDepFromDep(dep);

        if (!depTree.dependencies[dep.name].labels) {
          depTree.dependencies[dep.name].labels = {};
        }

        depTree.dependencies[dep.name].labels!.missingLockFileEntry = 'true';
        treeSize++;
      }
    }

    depTree.size = treeSize;
    return depTree;
  }

  private setDevDepRec(pkgTree: DepTreeDep) {
    for (const [name, subTree] of _toPairs(pkgTree.dependencies)) {
      pkgTree.dependencies![name] = this.setDevDepRec(subTree);
    }
    pkgTree.labels = {
      scope: Scope.dev,
    };

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
    cycle: string[],
    depMap: DepMap,
    depGraph: graphlib.Graph,
  ): CycleStartMap {
    /* FUNCTION DEFINITION
    To keep an order of algorithm steps readable, function is defined on-the-fly
    Arrow function is used for calling `this` without .bind(this) in the end
    */
    const acyclicDuplicationRec = (
      node,
      traversed: string[],
      currentCycle: string[],
      nodeCopy,
    ) => {
      // 2. For every cyclic dependency of entry node...
      const edgesToProcess = (depGraph.inEdges(
        node,
      ) as graphlib.Edge[]).filter((e) => currentCycle.includes(e.v));
      for (const edge of edgesToProcess) {
        // ... create a duplicate of the dependency...
        const child = edge.v;
        const dependencyCopy = this.cloneNodeWithoutEdges(
          child,
          depMap,
          depGraph,
        );
        // ...and connect it with the duplicated entry node
        depGraph.setEdge(dependencyCopy, nodeCopy);
        // 3.a If edge goes to already-visited dependency, end of cycle is found;
        if (traversed.includes(child)) {
          // update metadata and labels and do not continue traversing
          if (!depMap[dependencyCopy].labels) {
            depMap[dependencyCopy].labels = {};
          }
          depMap[dependencyCopy].labels!.pruned = 'cyclic';
        } else {
          // 3.b Follow the edge and repeat the process, storing visited dependency-paths
          acyclicDuplicationRec(
            child,
            [...traversed, node],
            currentCycle,
            dependencyCopy,
          );
          // All non-cyclic dependencies of duplicated node need to be updated.
          this.cloneAcyclicNodeEdges(child, dependencyCopy, cycle, depGraph, {
            inEdges: true,
            outEdges: false,
          });
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
      this.cloneAcyclicNodeEdges(start, clonedNode, cycle, depGraph, {
        inEdges: true,
        outEdges: true,
      });
    }

    // Once completed for all nodes in a cycle, original cyclic nodes can
    // be removed.
    for (const start of cycle) {
      depGraph.removeNode(start);
    }

    return cycleStarts;
  }

  private cloneAcyclicNodeEdges(
    nodeFrom,
    nodeTo,
    cycle: string[],
    depGraph,
    { inEdges, outEdges }: EdgeDirection,
  ) {
    // node has to have edges
    const edges = depGraph.nodeEdges(nodeFrom) as graphlib.Edge[];
    if (outEdges) {
      const parentEdges = edges.filter((e) => !cycle.includes(e.w));
      for (const edge of parentEdges) {
        const parent = edge.w;
        depGraph.setEdge(nodeTo, parent);
      }
    }
    if (inEdges) {
      const childEdges = edges.filter((e) => !cycle.includes(e.v));
      for (const edge of childEdges) {
        const child = edge.v;
        depGraph.setEdge(child, nodeTo);
      }
    }
  }

  private cloneNodeWithoutEdges(
    node: string,
    depMap: DepMap,
    depGraph: graphlib.Graph,
  ): string {
    const newNode = node + uuid();
    // update depMap with new node
    depMap[newNode] = _cloneDeep(depMap[node]);
    // add new node to the graph
    depGraph.setNode(newNode);

    return newNode;
  }

  private createGraphOfDependencies(depMap: DepMap): graphlib.Graph {
    const depGraph = new graphlib.Graph();
    for (const depKey of Object.keys(depMap)) {
      depGraph.setNode(depKey);
    }
    for (const [depPath, dep] of Object.entries(depMap)) {
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
  private findDepsPath(
    startPath: string,
    depName: string,
    depMap: DepMap,
  ): string {
    const depPath = startPath.split(this.pathDelimiter);
    while (depPath.length) {
      const currentPath = depPath.concat(depName).join(this.pathDelimiter);
      if (depMap[currentPath]) {
        return currentPath;
      }
      depPath.pop();
    }

    if (!depMap[depName]) {
      throw new OutOfSyncError(depName, this.type);
    }

    return depName;
  }

  // Algorithm is based on dynamic programming technique and tries to build
  // "more simple" trees and compose them into bigger ones.
  private async createDepTrees(
    depMap: DepMap,
    depGraph,
  ): Promise<{
    depTrees: { [depPath: string]: DepTreeDep };
    depTreesSizes: { [depPath: string]: number };
  }> {
    // Graph has to be acyclic
    if (!graphlib.alg.isAcyclic(depGraph)) {
      throw new Error('Cycles were not removed from graph.');
    }

    const depTrees: { [depPath: string]: DepTreeDep } = {};
    const depTreesSizes: { [depPath: string]: number } = {};
    // topological sort guarantees that when we create a pkg-tree for a dep,
    // all it's sub-trees were already created. This also implies that leaf
    // packages will be processed first as they have no sub-trees.
    const depOrder = graphlib.alg.topsort(depGraph);

    while (depOrder.length) {
      const depKey = depOrder.shift() as string;
      const dep = depMap[depKey];
      let treeSize = 1;

      // direction is from the dependency to the package requiring it, so we are
      // looking for predecessors
      for (const subDepPath of depGraph.predecessors(depKey)) {
        const subDep = depTrees[subDepPath];
        if (!dep.dependencies) {
          dep.dependencies = {};
        }
        dep.dependencies[subDep.name!] = subDep;
        treeSize += depTreesSizes[subDepPath];
      }
      const depTreeDep: DepTreeDep = {
        labels: dep.labels,
        name: dep.name,
        version: dep.version,

        ...(dep.resolved && { resolved: dep.resolved }),
        ...(dep.integrity && { integrity: dep.integrity }),

        // Yarn2 alternatives for resolved and integrity
        // They have incompatible formats with resolved and integrity
        // and hence have their own fields
        ...(dep.checksum && { checksum: dep.checksum }),
        ...(dep.resolution && { resolution: dep.resolution }),
      };

      if (dep.dependencies) {
        depTreeDep.dependencies = dep.dependencies;
      }
      depTrees[depKey] = depTreeDep;
      depTreesSizes[depKey] = treeSize;
      // Since this code doesn't handle any I/O or network, we need to force
      // event loop to tick while being used in server for request processing
      if (eventLoopSpinner.isStarving()) {
        await eventLoopSpinner.spin();
      }
    }

    return { depTrees, depTreesSizes };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getDepMap(lockfile: Lockfile): DepMap {
    throw new Error('Not implemented');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getDepTreeKey(dep: Dep): string {
    throw new Error('Not implemented');
  }
}
