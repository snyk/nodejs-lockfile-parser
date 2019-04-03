import * as _ from 'lodash';
import {LockfileParser, PkgTree, Dep, DepType, ManifestFile,
  getTopLevelDeps, Lockfile, LockfileType, createPkgTreeFromDep} from './';
import getRuntimeVersion from '../get-node-runtime-version';
import {setImmediatePromise} from '../set-immediate-promise';
import {
  InvalidUserInputError,
  UnsupportedRuntimeError,
  OutOfSyncError,
} from '../errors';

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
  private eventLoopSpinRate = 100;

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

    const targetRuntime = _.get(manifestFile, 'engines.node');
    if (targetRuntime) {
      depTree.targetRuntime = targetRuntime;
    }

    const topLevelDeps: Dep[] = getTopLevelDeps(manifestFile, includeDev);

    // asked to process empty deps
    if (_.isEmpty(manifestFile.dependencies) && !includeDev) {
      return depTree;
    }

    for (const dep of topLevelDeps) {
      if (/^file:/.test(dep.version)) {
        depTree.dependencies[dep.name] = createPkgTreeFromDep(dep);
      } else {
        depTree.dependencies[dep.name] = await this.buildSubTree(yarnLock, createPkgTreeFromDep(dep), strict);
      }
      this.treeSize++;

      if (this.treeSize % this.eventLoopSpinRate === 0) {
        // Spin event loop every X dependencies.
        await setImmediatePromise();
      }
    }

    depTree.size = this.treeSize;
    return depTree;
  }

  private async buildSubTree(lockFile: YarnLock, tree: PkgTree, strict: boolean): Promise<PkgTree> {
    const queue = [{path: [] as string[], tree}];

    while (queue.length > 0) {
      const queueItem = queue.pop()!;
      const depKey = `${queueItem.tree.name}@${queueItem.tree.version}`;
      const dependency = lockFile.object[depKey];
      if (!dependency) {
        if (strict) {
          throw new OutOfSyncError(queueItem.tree.name, 'yarn');
        }
        queueItem.tree.missingLockFileEntry = true;
        continue;
      }

      // Overwrite version pattern with exact version.
      queueItem.tree.version = dependency.version;

      if (queueItem.path.indexOf(depKey) >= 0) {
        queueItem.tree.cyclic = true;
        continue;
      }

      const subDependencies = _.entries({
        ...dependency.dependencies,
        ...dependency.optionalDependencies,
      });

      for (const [subName, subVersion] of subDependencies) {
        const subDependency: PkgTree = {
          depType: tree.depType,
          dependencies: {},
          name: subName,
          version: subVersion,
        };

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
}
