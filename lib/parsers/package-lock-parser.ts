import {
  Dep,
  Lockfile,
  LockfileType,
  ManifestFile,
  PkgTree,
  Scope,
} from './index';
import { InvalidUserInputError } from '../errors';
import { DepMap, DepMapItem, LockParserBase } from './lock-parser-base';
import { config } from '../config';

export interface PackageLock {
  name: string;
  version: string;
  dependencies?: PackageLockDeps;
  lockfileVersion: 1 | 2;
  type: LockfileType.npm | LockfileType.npm7;
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

export class PackageLockParser extends LockParserBase {
  constructor() {
    super(LockfileType.npm, config.NPM_TREE_SIZE_LIMIT);
  }

  public parseLockFile(lockFileContents: string): PackageLock {
    try {
      const packageLock: PackageLock = JSON.parse(lockFileContents);
      packageLock.type =
        packageLock.lockfileVersion === 1
          ? LockfileType.npm
          : LockfileType.npm7;
      this.type = packageLock.type;
      return packageLock;
    } catch (e) {
      throw new InvalidUserInputError(
        'package-lock.json parsing failed with ' +
          `error ${(e as Error).message}`,
      );
    }
  }

  public async getDependencyTree(
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev: boolean = false,
    strictOutOfSync: boolean = true,
  ): Promise<PkgTree> {
    const dependencyTree = await super.getDependencyTree(
      manifestFile,
      lockfile,
      includeDev,
      strictOutOfSync,
    );
    const meta = {
      lockfileVersion: (lockfile as PackageLock).lockfileVersion,
      packageManager: 'npm',
    };
    const depTreeWithMeta = {
      ...dependencyTree,
      meta: { ...dependencyTree.meta, ...meta },
    };
    return depTreeWithMeta;
  }

  protected getDepMap(lockfile: Lockfile): DepMap {
    const packageLock = lockfile as PackageLock;
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

    flattenLockfileRec(packageLock.dependencies || {}, []);

    return depMap;
  }

  protected getDepTreeKey(dep: Dep): string {
    return dep.name;
  }
}
