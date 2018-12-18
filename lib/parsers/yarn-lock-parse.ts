import * as _ from 'lodash';
import {LockfileParser, PkgTree, Dep, DepType, ManifestFile,
  getTopLevelDeps, Lockfile, LockfileType, createPkgTreeFromDep} from './';
import getRuntimeVersion from '../get-node-runtime-version';
import {setImmediatePromise} from '../set-immediate-promise';
import { EventLoopSpinner } from '../event-loop-spinner';
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
  private eventLoop: EventLoopSpinner;
  private treeSize: number;

  constructor() {
    // @yarnpkg/lockfile doesn't work with Node.js < 6 and crashes just after
    // the import, so it has to be required conditionally
    // more details at https://github.com/yarnpkg/yarn/issues/6304
    if (getRuntimeVersion() < 6) {
      throw new UnsupportedRuntimeError('yarn.lock parsing is supported for ' +
        'Node.js v6 and higher.');
    }
    this.yarnLockfileParser = require('@yarnpkg/lockfile');
    // 200ms is an arbitrary value based on on testing "average request", which is
    // processed in ~150ms. Idea is to let those average requests through in one
    // tick and split only bigger ones.
    this.eventLoop = new EventLoopSpinner(200);

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

    const topLevelDeps: Dep[] = getTopLevelDeps(manifestFile, includeDev);

    // asked to process empty deps
    if (_.isEmpty(manifestFile.dependencies) && !includeDev) {
      return depTree;
    }

    for (const dep of topLevelDeps) {
      if (/^file:/.test(dep.version)) {
        depTree.dependencies[dep.name] = createPkgTreeFromDep(dep);
      } else {
        depTree.dependencies[dep.name] = await this.buildSubTreeRecursiveFromYarnLock(
          dep, yarnLock, [], strict);
      }
      this.treeSize++;
    }

    depTree.size = this.treeSize;
    return depTree;
  }

  private async buildSubTreeRecursiveFromYarnLock(
    searchedDep: Dep, lockFile: YarnLock, depPath: string[],
    strict = true): Promise<PkgTree> {
    const depSubTree: PkgTree = {
      depType: searchedDep.dev ? DepType.dev : DepType.prod,
      dependencies: {},
      name: searchedDep.name,
      version: '', // will be set later or error will be thrown
    };

    const depKey = `${searchedDep.name}@${searchedDep.version}`;
    const dep = _.get(lockFile.object, depKey);

    if (!dep) {

      if (strict) {
        throw new OutOfSyncError(searchedDep.name, 'yarn');
      }

      depSubTree.version = searchedDep.version;
      depSubTree.missingLockFileEntry = true;
      return depSubTree;
    }

    depSubTree.version = dep.version;

    if (depPath.indexOf(depKey) >= 0) {
      depSubTree.cyclic = true;
    } else {
      depPath.push(depKey);
      const newDeps = _.entries({...dep.dependencies, ...dep.optionalDependencies});

      for (const [name, version] of newDeps) {
        const newDep: Dep = {
          dev: searchedDep.dev,
          name,
          version,
        };
        depSubTree.dependencies[name] = await this.buildSubTreeRecursiveFromYarnLock(
          newDep, lockFile, [...depPath]);
        this.treeSize++;
      }
    }

    if (this.eventLoop.isStarving()) {
        await this.eventLoop.spin();
    }
    return depSubTree;
  }
}
