import * as _ from 'lodash';
import * as pMap from 'p-map';

import {
  LockfileParser, PkgTree, DepTreeDep, Dep, ManifestFile,
  getTopLevelDeps, Lockfile, LockfileType, createDepTreeDepFromDep,
} from './';
import getRuntimeVersion from '../get-node-runtime-version';
import {setImmediatePromise} from '../set-immediate-promise';
import {
  InvalidUserInputError,
  UnsupportedRuntimeError,
  OutOfSyncError,
} from '../errors';

const EVENT_PROCESSING_CONCURRENCY = 5;

export interface YarnLock {
  type: string;
  object: {
    [depName: string]: YarnLockDep;
  };
  dependencies?: {
    [depName: string]: YarnLockDep;
  };
  lockfileType: LockfileType.yarn;
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

export class YarnLockParser implements LockfileParser {

  private yarnLockfileParser;
  private treeSize: number;
  private eventLoopSpinRate = 20;

  constructor() {
    // @yarnpkg/lockfile doesn't work with Node.js < 6 and crashes just after
    // the import, so it has to be required conditionally
    // more details at https://github.com/yarnpkg/yarn/issues/6304
    if (getRuntimeVersion() < 6) {
      throw new UnsupportedRuntimeError('yarn.lock parsing is supported for ' +
        'Node.js v6 and higher.');
    }
    this.yarnLockfileParser = require('@yarnpkg/lockfile');
    // Number of dependencies including root one.
    this.treeSize = 1;
  }

  public parseLockFile(lockFileContents: string): YarnLock {
    try {
      const yarnLock: YarnLock = this.yarnLockfileParser.parse(lockFileContents);
      yarnLock.dependencies = yarnLock.object;
      yarnLock.type = LockfileType.yarn;
      return yarnLock;
    } catch (e) {
      throw new InvalidUserInputError('yarn.lock parsing failed with an ' +
        `error: ${e.message}`);
    }
  }

  public async getDependencyTree(
    manifestFile: ManifestFile, lockfile: Lockfile, includeDev = false,
    strict = true ): Promise<PkgTree> {
    if (lockfile.type !== LockfileType.yarn) {
      throw new InvalidUserInputError('Unsupported lockfile provided. ' +
        'Please provide `package-lock.json`.');
    }
    const yarnLock = lockfile as YarnLock;

    const depTree: PkgTree = {
      dependencies: {},
      hasDevDependencies: !_.isEmpty(manifestFile.devDependencies),
      name: manifestFile.name,
      size: 1,
      version: manifestFile.version || '',
    };

    const nodeVersion = _.get(manifestFile, 'engines.node');
    if (nodeVersion) {
      _.set(depTree, 'meta.nodeVersion', nodeVersion);
    }

    const topLevelDeps: Dep[] = getTopLevelDeps(manifestFile, includeDev);
    // asked to process empty deps
    if (_.isEmpty(manifestFile.dependencies) && !includeDev) {
      return depTree;
    }

    await pMap(
      topLevelDeps,
      (dep) => this.resolveDep(dep, depTree, yarnLock, strict),
      { concurrency: EVENT_PROCESSING_CONCURRENCY });

    depTree.size = this.treeSize;
    return depTree;
  }

  private async buildSubTree(lockFile: YarnLock, tree: DepTreeDep, strict: boolean): Promise<DepTreeDep> {
    const queue = [{path: [] as string[], tree}];
    while (queue.length > 0) {
      const queueItem = queue.pop()!;
      const depKey = `${queueItem.tree.name}@${queueItem.tree.version}`;
      const dependency = lockFile.object[depKey];
      if (!dependency) {
        if (strict) {
          throw new OutOfSyncError(queueItem.tree.name!, 'yarn');
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

      const subDependencies = _.entries({
        ...dependency.dependencies,
        ...dependency.optionalDependencies,
      });

      for (const [subName, subVersion] of subDependencies) {
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

        if (this.treeSize % this.eventLoopSpinRate === 0) {
          // Spin event loop every X dependencies.
          await setImmediatePromise();
        }
      }
    }

    return tree;
  }

  private async resolveDep(dep, depTree, yarnLock, strict) {
    if (/^file:/.test(dep.version)) {
      depTree.dependencies[dep.name] = createDepTreeDepFromDep(dep);
    } else {
      depTree.dependencies[dep.name] = await this.buildSubTree(yarnLock, createDepTreeDepFromDep(dep), strict);
    }
    this.treeSize++;

    if (this.treeSize % this.eventLoopSpinRate === 0) {
      // Spin event loop every X dependencies.
      await setImmediatePromise();
    }
  }
}
