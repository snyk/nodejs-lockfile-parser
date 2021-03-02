import * as yarnLockfileParser from '@yarnpkg/lockfile';

import {
  Dep,
  Lockfile,
  LockfileType,
  ManifestFile,
  PkgTree,
  Scope,
} from './index';
import { InvalidUserInputError } from '../errors';
import { DepMap, LockParserBase } from './lock-parser-base';

export type YarnLockFileTypes = LockfileType.yarn | LockfileType.yarn2;

export interface YarnLock {
  type: string;
  object: YarnLockDeps;
  dependencies?: YarnLockDeps;
  lockfileType: YarnLockFileTypes;
}

export interface YarnLockDeps {
  [depName: string]: YarnLockDep;
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

export class YarnLockParser extends LockParserBase {
  constructor() {
    super(LockfileType.yarn);
  }

  public parseLockFile(lockFileContents: string): YarnLock {
    try {
      const yarnLock: YarnLock = yarnLockfileParser.parse(lockFileContents);
      yarnLock.dependencies = yarnLock.object;
      yarnLock.type = this.type;
      return yarnLock;
    } catch (e) {
      throw new InvalidUserInputError(
        `yarn.lock parsing failed with an error: ${e.message}`,
      );
    }
  }

  public async getDependencyTree(
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev = false,
    strict = true,
  ): Promise<PkgTree> {
    const depTree = await super.getDependencyTree(
      manifestFile,
      lockfile,
      includeDev,
      strict,
    );

    if (!depTree.meta) depTree.meta = {};
    depTree.meta.packageManagerVersion = '1';

    return depTree;
  }

  protected getDepMap(lockfile: Lockfile): DepMap {
    const yarnLockfile = lockfile as YarnLock;
    const depMap: DepMap = {};

    for (const [depName, dep] of Object.entries(yarnLockfile.object)) {
      const subDependencies = Object.entries({
        ...(dep.dependencies || {}),
        ...(dep.optionalDependencies || {}),
      });
      depMap[depName] = {
        labels: {
          scope: Scope.prod,
        },
        name: getName(depName),
        requires: subDependencies.map(([key, ver]) => `${key}@${ver}`),
        version: dep.version,
      };
    }

    return depMap;
  }

  protected getDepTreeKey(dep: Dep): string {
    return `${dep.name}@${dep.version}`;
  }
}

function getName(depName: string) {
  return depName.slice(0, depName.indexOf('@', 1));
}
