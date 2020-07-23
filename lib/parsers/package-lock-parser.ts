import * as _cloneDeep from 'lodash.clonedeep';
import * as _isEmpty from 'lodash.isempty';
import * as _set from 'lodash.set';
import * as _toPairs from 'lodash.topairs';
import * as graphlib from '@snyk/graphlib';
import * as uuid from 'uuid/v4';
import { config } from '../config';
import { eventLoopSpinner } from 'event-loop-spinner';
// import * as fs from 'fs';

import {
  LockfileParser,
  PkgTree,
  DepTreeDep,
  Dep,
  Scope,
  ManifestFile,
  getTopLevelDeps,
  Lockfile,
  LockfileType,
  createDepTreeDepFromDep,
} from './';
import {
  InvalidUserInputError,
  OutOfSyncError,
  TreeSizeLimitError,
} from '../errors';
import { DepGraph, DepGraphBuilder, PkgInfo } from '@snyk/dep-graph';
import { NodeInfo } from '@snyk/dep-graph/dist/core/types';

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

interface DepMapItem extends DepTreeDep {
  requires: string[];
}

interface CycleStartMap {
  [originalNode: string]: string;
}

interface EdgeDirection {
  inEdges: boolean;
  outEdges: boolean;
}

interface PathMap {
  [path: string]: {
    name: string;
    version: string;
    dev: boolean;
    deps: string[];
    root: boolean;
    subPaths?: string[];
    miss?: boolean;
    cycle?: boolean;
  };
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
      throw new InvalidUserInputError(
        'package-lock.json parsing failed with ' + `error ${e.message}`,
      );
    }
  }

  private async mapPaths(
    deps: PackageLockDeps,
    map: PathMap = {},
    path: string[] = [],
  ): Promise<PathMap> {
    for (const [name, dep] of Object.entries(deps)) {
      if (eventLoopSpinner.isStarving()) {
        await eventLoopSpinner.spin();
      }
      const { version, requires = {}, dependencies = {}, dev = false } = dep;
      const depPath: string[] = [...path, name];
      const key = `${depPath.join(this.pathDelimiter)}`;
      map[key] = {
        name,
        version,
        dev,
        deps: Object.keys(dependencies),
        root: depPath.length === 1,
      };
      // add sub-paths after creating map entry to include our own deps
      map[key].subPaths = Object.keys(requires).map((depName) => {
        // what's the closest deps that mentions me (in my path so far)?
        for (let i = depPath.length; i > 0; i--) {
          const subPath = depPath.slice(0, i);
          const subPathKey = subPath.join(this.pathDelimiter);
          const depNames = map[subPathKey]?.deps || [];
          if (depNames.includes(depName)) {
            // found! add myself to the path and return
            return subPath.concat(depName).join(this.pathDelimiter);
          }
        }
        return depName; // otherwise assume root (key is name)
      });
      // recurse if I have dependencies
      if (dependencies) {
        this.mapPaths(dependencies, map, depPath);
      }
    }
    return map;
  }

  public async getDepGraph(
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev = false,
    strict = true,
  ): Promise<DepGraph> {
    if (lockfile.type !== LockfileType.npm) {
      throw new InvalidUserInputError(
        'Unsupported lockfile, please provide `package-lock.json`.',
      );
    }
    const packageLock = lockfile as PackageLock;

    const rootPkgInfo: PkgInfo = {
      name: manifestFile.name,
      version: manifestFile.version,
    };

    const builder = new DepGraphBuilder({ name: 'npm' }, rootPkgInfo);

    const prodDependencies = manifestFile.dependencies || {};
    const devDependencies = includeDev
      ? manifestFile.devDependencies || {}
      : {};
    const topLevelPkgNames = Object.keys({
      ...devDependencies,
      ...prodDependencies,
    });

    const pathMap = await this.mapPaths(packageLock.dependencies || {});
    // fs.writeFileSync(
    //   __dirname + '/pathMap.json',
    //   JSON.stringify(pathMap, null, 2),
    // );

    // check for out of sync
    for (const name of topLevelPkgNames) {
      // all top level pkg paths will be root level (so key is name)
      if (!pathMap[name]) {
        if (strict) {
          throw new OutOfSyncError(name, LockfileType.npm);
        } else {
          // add missing top level pkgs to the map
          const prodVersion = prodDependencies[name];
          const dev = prodVersion ? false : true;
          const version = prodVersion ? prodVersion : devDependencies[name];
          pathMap[name] = {
            name,
            version,
            dev,
            deps: [],
            miss: true,
            root: true,
          };
        }
      }
    }

    // add all pkgs and nodes
    // and connect top level pkgs to root
    for (const [path, entry] of Object.entries(pathMap)) {
      const { dev } = entry;
      if (!includeDev && dev) {
        continue;
      }
      const { name, version, miss, root } = entry;
      const scope = dev ? 'dev' : 'prod';
      const missingLockFileEntry = miss ? 'true' : 'false';
      const nodeInfo: NodeInfo = miss
        ? { labels: { scope, missingLockFileEntry } }
        : { labels: { scope } };
      builder.addPkgNode({ name, version }, path, nodeInfo);
      if (root && topLevelPkgNames.includes(name)) {
        builder.connectDep(builder.rootNodeId, path);
      }
    }

    // loop again separately here to ensure all nodes have been added before connecting
    for (const [path, { dev, subPaths = [] }] of Object.entries(pathMap)) {
      if (!includeDev && dev) {
        continue;
      }
      for (const subPath of subPaths) {
        builder.connectDep(path, subPath);
      }
    }

    // const graph = builder.build();
    // const graphJSON = graph.toJSON();
    // fs.writeFileSync(
    //   __dirname + '/depGraph.json',
    //   JSON.stringify(graphJSON, null, 2),
    // );

    // TODO: label & break cyclic?

    return builder.build();
  }

  public async getDependencyTree(
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev = false,
    strict = true,
  ): Promise<PkgTree> {
    if (lockfile.type !== LockfileType.npm) {
      throw new InvalidUserInputError(
        'Unsupported lockfile provided. Please ' +
          'provide `package-lock.json`.',
      );
    }
    const packageLock = lockfile as PackageLock;

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
    const topLevelDeps: Dep[] = getTopLevelDeps(manifestFile, includeDev);

    // number of dependencies including root one
    let treeSize = 1;
    for (const dep of topLevelDeps) {
      // tree size limit should be 6 millions.
      if (treeSize > config.NPM_TREE_SIZE_LIMIT) {
        throw new TreeSizeLimitError();
      }
      // if any of top level dependencies is a part of cycle
      // it now has a different item in the map
      const depName = cycleStarts[dep.name] || dep.name;
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
          throw new OutOfSyncError(depName, LockfileType.npm);
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
      throw new OutOfSyncError(depName, LockfileType.npm);
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

  private flattenLockfile(lockfile: PackageLock): DepMap {
    const depMap: DepMap = {};

    const flattenLockfileRec = (
      lockfileDeps: PackageLockDeps,
      path: string[],
    ) => {
      for (const [depName, dep] of Object.entries(lockfileDeps)) {
        const depNode: DepMapItem = {
          labels: {
            scope: dep.dev ? Scope.dev : Scope.prod,
          },
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
