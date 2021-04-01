import * as yaml from 'yaml';
import * as yarnCore from '@yarnpkg/core';

import { LockParserBase, DepMap } from './lock-parser-base';
import { Dep, Lockfile, LockfileType, ManifestFile, PkgTree, Scope } from '.';
import { config } from '../config';
import { YarnLockDeps } from './yarn-lock-parser';
import { InvalidUserInputError } from '../errors';
import { yarnLockFileKeyNormalizer } from './yarn-utils';

export interface Yarn2Lock {
  type: string;
  object: YarnLockDeps;
  dependencies?: YarnLockDeps;
  lockfileType: LockfileType.yarn2;
}

export class Yarn2LockParser extends LockParserBase {
  constructor() {
    super(LockfileType.yarn2, config.YARN_TREE_SIZE_LIMIT);
  }

  public parseLockFile(lockFileContents: string): Yarn2Lock {
    try {
      const rawYarnLock: any = yaml.parse(lockFileContents);
      delete rawYarnLock.__metadata;
      const dependencies: YarnLockDeps = {};

      const structUtils = yarnCore.structUtils;
      const parseDescriptor = structUtils.parseDescriptor;
      const parseRange = structUtils.parseRange;

      const keyNormalizer = yarnLockFileKeyNormalizer(
        parseDescriptor,
        parseRange,
      );

      Object.entries(rawYarnLock).forEach(
        ([fullDescriptor, versionData]: [string, any]) => {
          keyNormalizer(fullDescriptor).forEach((descriptor) => {
            dependencies[descriptor] = versionData;
          });
        },
      );
      return {
        dependencies,
        lockfileType: LockfileType.yarn2,
        object: dependencies,
        type: LockfileType.yarn2,
      };
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
    depTree.meta.packageManagerVersion = '2';

    return depTree;
  }

  protected getDepMap(lockfile: Lockfile): DepMap {
    const yarnLockfile = lockfile as Yarn2Lock;
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
