import * as _isEmpty from 'lodash.isempty';
import * as _set from 'lodash.set';
import * as pMap from 'p-map';
import { DepGraph } from '@snyk/dep-graph';

import {
  LockfileParser,
  PkgTree,
  DepTreeDep,
  Dep,
  ManifestFile,
  getTopLevelDeps,
  Lockfile,
  LockfileType,
  createDepTreeDepFromDep,
} from './';
import { eventLoopSpinner } from 'event-loop-spinner';
import {
  InvalidUserInputError,
  OutOfSyncError,
  TreeSizeLimitError,
} from '../errors';
import { config } from '../config';

const EVENT_PROCESSING_CONCURRENCY = 5;

export type YarnLockFileTypes = LockfileType.yarn | LockfileType.yarn2;

export interface YarnLockDeps {
  [depName: string]: YarnLockDep;
}

export interface YarnLockBase<T extends YarnLockFileTypes> {
  type: string;
  object: YarnLockDeps;
  dependencies?: YarnLockDeps;
  lockfileType: T;
}

export interface YarnLockDep {
  version: string;
  dependencies?: {
    [depName: string]: string;
  };
  optionalDependencies?: {
    [depName: string]: string;
  };
}

export abstract class YarnLockParseBase<T extends YarnLockFileTypes>
  implements LockfileParser {
  private treeSize: number;
  private eventLoopSpinRate = 20;

  constructor(private type: T) {
    // Number of dependencies including root one.
    this.treeSize = 1;
  }

  public abstract parseLockFile(lockFileContents: string): Lockfile;

  public async getDepGraph(
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev = false,
    strict = true,
  ): Promise<DepGraph> {
    return {} as unknown as DepGraph;
  }

  public async getDependencyTree(
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev = false,
    strict = true,
  ): Promise<PkgTree> {
    if (lockfile.type !== this.type) {
      throw new InvalidUserInputError(
        'Unsupported lockfile provided. Please provide `yarn.lock`.',
      );
    }
    const yarnLock = lockfile as YarnLockBase<T>;

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

    const packageManagerVersion =
      lockfile.type === LockfileType.yarn ? '1' : '2';
    _set(depTree, 'meta.packageManagerVersion', packageManagerVersion);

    const topLevelDeps: Dep[] = getTopLevelDeps(manifestFile, includeDev);
    // asked to process empty deps
    if (_isEmpty(manifestFile.dependencies) && !includeDev) {
      return depTree;
    }

    await pMap(
      topLevelDeps,
      (dep) => this.resolveDep(dep, depTree, yarnLock, strict),
      { concurrency: EVENT_PROCESSING_CONCURRENCY },
    );

    depTree.size = this.treeSize;
    return depTree;
  }

  private async buildSubTree(
    lockFile: YarnLockBase<T>,
    tree: DepTreeDep,
    strict: boolean,
  ): Promise<DepTreeDep> {
    const queue = [{ path: [] as string[], tree }];
    while (queue.length > 0) {
      const queueItem = queue.pop()!;
      const depKey = `${queueItem.tree.name}@${queueItem.tree.version}`;
      const dependency = lockFile.object[depKey];
      if (!dependency) {
        if (strict) {
          throw new OutOfSyncError(queueItem.tree.name!, this.type);
        }
        if (!queueItem.tree.labels) {
          queueItem.tree.labels = {};
        }
        queueItem.tree.labels.missingLockFileEntry = 'true';
        continue;
      }

      // Overwrite version pattern with exact version.
      queueItem.tree.version = dependency.version;

      if (queueItem.path.indexOf(depKey) >= 0) {
        if (!queueItem.tree.labels) {
          queueItem.tree.labels = {};
        }
        queueItem.tree.labels.pruned = 'cyclic';
        continue;
      }

      const subDependencies = Object.entries({
        ...dependency.dependencies,
        ...dependency.optionalDependencies,
      });

      for (const [subName, subVersion] of subDependencies) {
        // tree size limit should be 6 millions.
        if (this.treeSize > config.YARN_TREE_SIZE_LIMIT) {
          throw new TreeSizeLimitError();
        }
        const subDependency: DepTreeDep = {
          labels: {
            scope: tree.labels!.scope, // propagate scope label only
          },
          name: subName,
          version: subVersion,
        };

        if (!queueItem.tree.dependencies) {
          queueItem.tree.dependencies = {};
        }
        queueItem.tree.dependencies[subName] = subDependency;

        queue.push({
          path: [...queueItem.path, depKey],
          tree: subDependency,
        });

        this.treeSize++;

        if (eventLoopSpinner.isStarving()) {
          await eventLoopSpinner.spin();
        }
      }
    }

    return tree;
  }

  private async resolveDep(dep, depTree, yarnLock, strict) {
    if (/^file:/.test(dep.version)) {
      depTree.dependencies[dep.name] = createDepTreeDepFromDep(dep);
    } else {
      depTree.dependencies[dep.name] = await this.buildSubTree(
        yarnLock,
        createDepTreeDepFromDep(dep),
        strict,
      );
    }
    this.treeSize++;

    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
  }
}
