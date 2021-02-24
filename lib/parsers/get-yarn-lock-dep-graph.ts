import { Dep, getTopLevelDeps, LockfileType, ManifestFile } from './index';
import { DepGraphBuilder } from '@snyk/dep-graph';
import * as pMap from 'p-map';
import { YarnLock } from './yarn-lock-parse';
import { eventLoopSpinner } from 'event-loop-spinner';
import { OutOfSyncError } from '../errors';
import {
  EVENT_PROCESSING_CONCURRENCY,
  YarnLockDep,
} from './yarn-lock-parse-base';
import { getNodeId, NodeIdMap } from '../get-node-id';

type VersionHolder = YarnLockDep | { version: string };
type NodeId = string;
type QueueItem = {
  parentNodeId: NodeId;
  childName: string;
  childVersionSpec: string;
};
type MemoizationMap = Map<VersionHolder, NodeId>;

export async function getYarnLockDepGraph(
  manifestFile: ManifestFile,
  yarnLock: YarnLock,
  includeDev = false,
  strict = true,
) {
  const rootPkgInfo = {
    name: manifestFile.name,
    version: manifestFile.version,
  };

  const pkgManager = {
    name: 'yarn',
    version: yarnLock.type === LockfileType.yarn ? '1' : '2',
  };
  const depGraphBuilder = new DepGraphBuilder(pkgManager, rootPkgInfo);
  const prodMemoizationMap: MemoizationMap = new Map();
  const devMemoizationMap: MemoizationMap = new Map();
  const nodeIdMap: NodeIdMap = {};

  const topLevelDeps: Dep[] = getTopLevelDeps(manifestFile, includeDev);

  await pMap(
    topLevelDeps,
    (dep) =>
      addTopLevelDepChainToGraph(
        depGraphBuilder,
        dep.name,
        dep.version,
        yarnLock,
        strict,
        !!dep.dev,
        dep.dev ? devMemoizationMap : prodMemoizationMap,
        nodeIdMap,
      ),
    { concurrency: EVENT_PROCESSING_CONCURRENCY },
  );

  return depGraphBuilder.build();
}

/*
 * This function takes a top level dependency name and verion and will iterate
 * over the YarnLock object and add all nodes to the graph
 * */
async function addTopLevelDepChainToGraph(
  depGraphBuilder: DepGraphBuilder,
  depName: string,
  depRange: string,
  yarnLock: YarnLock,
  strict: boolean,
  isDev: boolean,
  memoizationMap: MemoizationMap,
  nodeIdMap: NodeIdMap,
): Promise<void> {
  if (/^file:/.test(depRange)) {
    addNodeToGraph(depName, { version: depRange }, depGraphBuilder.rootNodeId);
    return;
  }

  const queue: QueueItem[] = [
    {
      parentNodeId: depGraphBuilder.rootNodeId,
      childName: depName,
      childVersionSpec: depRange,
    },
  ];

  while (queue.length > 0) {
    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }

    const { parentNodeId, childName, childVersionSpec } = queue.pop()!;
    const childLockKey = `${childName}@${childVersionSpec}`;
    const dependencyFromLockFile = yarnLock.object[childLockKey];
    if (!dependencyFromLockFile) {
      if (strict) {
        throw new OutOfSyncError(childName, LockfileType.yarn);
      }
      addNodeToGraph(childName, { version: childVersionSpec }, parentNodeId, {
        missingLockFileEntry: 'true',
      });
      continue;
    }

    const [nodeExists, childNodeId] = addNodeToGraph(
      childName,
      dependencyFromLockFile,
      parentNodeId,
    );

    if (nodeExists) continue;

    const subDependencies = Object.entries({
      ...dependencyFromLockFile.dependencies,
      ...dependencyFromLockFile.optionalDependencies,
    });

    queue.push(
      ...subDependencies.map(([name, versionSpecifier]) => ({
        parentNodeId: childNodeId,
        childName: name,
        childVersionSpec: versionSpecifier,
      })),
    );
  }

  /*
   * This function will add a node to the graph and will connect it to it's parent
   * If the node for this dependency already exists, it will only connect it to the graph
   * */
  function addNodeToGraph(
    name,
    yarnLockDep: VersionHolder,
    parentNodeId,
    labels: any = {},
  ): [boolean, string] {
    const nodeExists = memoizationMap.has(yarnLockDep);
    if (nodeExists) {
      const nodeId = memoizationMap.get(yarnLockDep)!;
      depGraphBuilder.connectDep(parentNodeId, nodeId);
      return [nodeExists, nodeId];
    }

    const nodeId = getNodeId(nodeIdMap, name, yarnLockDep.version);
    labels.scope = isDev ? 'dev' : 'prod';
    depGraphBuilder.addPkgNode(
      { name, version: yarnLockDep.version! },
      nodeId,
      { labels },
    );
    depGraphBuilder.connectDep(parentNodeId, nodeId);
    memoizationMap.set(yarnLockDep, nodeId);
    return [nodeExists, nodeId];
  }
}
