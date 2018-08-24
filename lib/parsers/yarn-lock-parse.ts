import * as _ from 'lodash';
import {LockfileParser, PkgTree, Dep, DepType, ManifestFile,
  getTopLevelDeps} from './parser';
import getRuntimeVersion from '../get-node-runtime-version';

export interface YarnLock {
  type: string;
  object: {
    [depName: string]: YarnLockDep;
  };
  dependencies?: {
    [depName: string]: YarnLockDep;
  };
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

  constructor() {
    // @yarnpkg/lockfile doesn't work with Node.js < 6 and crashes just after
    // the import, so it has to be required conditionally
    // more details at https://github.com/yarnpkg/yarn/issues/6304
    if (getRuntimeVersion() < 6) {
      throw new Error('yarn.lock parsing is supported for Node.js v6 and higher.');
    }
    this.yarnLockfileParser = require('@yarnpkg/lockfile');
  }

  public parseLockFile(lockFileContents: string): YarnLock {
    try {
      const yarnLock: YarnLock = this.yarnLockfileParser.parse(lockFileContents);
      yarnLock.dependencies = yarnLock.object;
      return yarnLock;
    } catch (e) {
      throw new Error(`yarn.lock parsing failed with an error: ${e.message}`);
    }
  }

  public async getDependencyTree(
    manifestFile: ManifestFile, lockfile: YarnLock, includeDev = false): Promise<PkgTree> {
    const depTree: PkgTree = {
      dependencies: {},
      hasDevDependencies: !_.isEmpty(manifestFile.devDependencies),
      name: manifestFile.name,
      version: manifestFile.version,
    };

    const topLevelDeps: Dep[] = getTopLevelDeps(manifestFile, includeDev);

    // asked to process empty deps
    if (_.isEmpty(manifestFile.dependencies) && !includeDev) {
      return depTree;
    }

    await Promise.all(topLevelDeps.map(async (dep) => {
      depTree.dependencies[dep.name] = await this.buildSubTreeRecursiveFromYarnLock(
        dep, lockfile, []);
    }));

    return depTree;
  }

  private async buildSubTreeRecursiveFromYarnLock(
    searchedDep: Dep, lockFile: YarnLock, depPath: string[] ): Promise<PkgTree> {
    const depSubTree: PkgTree = {
      depType: searchedDep.dev ? DepType.dev : DepType.prod,
      dependencies: {},
      name: searchedDep.name,
      version: undefined,
    };

    const depKey = `${searchedDep.name}@${searchedDep.version}`;

    const dep = _.get(lockFile.object, depKey);

    if (!dep) {
      throw new Error(`Dependency ${depKey} was not found in yarn.lock.
        Your package.json and yarn.lock are probably out of sync.
        Please run "yarn install" and try again.`);
    }

    if (depPath.indexOf(depKey) >= 0) {
      depSubTree.cyclic = true;
    } else {
      depPath.push(depKey);
      depSubTree.version = dep.version;
      const newDeps = _.entries({...dep.dependencies, ...dep.optionalDependencies});

      await Promise.all(newDeps.map(async ([name, version]) => {
        const newDep: Dep = {
          dev: searchedDep.dev,
          name,
          version,
        };
        depSubTree.dependencies[name] = await this.buildSubTreeRecursiveFromYarnLock(
          newDep, lockFile, [...depPath]);
      }));
    }

    return depSubTree;
  }
}
