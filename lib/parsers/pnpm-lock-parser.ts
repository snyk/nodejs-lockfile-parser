import * as pnpmLockfileLib from '@pnpm/lockfile-file';
import yaml = require('js-yaml');

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

export interface PnpmFileLock {
  type: string;
  lockfileVersion: number;
  dependencies?: pnpmLockfileLib.ResolvedDependencies;
  devDependencies?: pnpmLockfileLib.ResolvedDependencies;
  optionalDependencies?: pnpmLockfileLib.ResolvedDependencies;
  packages: pnpmLockfileLib.PackageSnapshots;
  specifiers: pnpmLockfileLib.ResolvedDependencies; // TODO: not yet resolved
  overrides?: string;
}

export class PnpmPackageLockParser extends LockParserBase {
  constructor() {
    super(LockfileType.pnpm, config.PNPM_TREE_SIZE_LIMIT);
  }

  public parseLockFile(lockFileContents: string): PnpmFileLock {
    try {
      const pnpmLock = yaml.load(lockFileContents, {
        json: true,
      }) as PnpmFileLock;

      const lockfile = {
        ...pnpmLock,
        type: LockfileType.pnpm,
      };

<<<<<<< HEAD
      console.log('****************', { lockfile });

=======
>>>>>>> e08406abdce78fca1002242bcb4bacb243cf5eec
      return lockfile;
    } catch (e) {
      throw new InvalidUserInputError(
        `pnpm-lock.yml parsing failed with error ${e.message}`,
      );
    }
  }

  public async getDependencyTree(
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev: boolean = false,
    strict: boolean = true,
  ): Promise<PkgTree> {
    const dependencyTree = await super.getDependencyTree(
      manifestFile,
      lockfile,
      includeDev,
      strict,
    );
    const meta = {
      // TODO: what versions do we support? Are older versions completely different?
      // do we need to validate and show an error when it is unsupported version?
      lockfileVersion: (lockfile as PnpmFileLock).lockfileVersion,
      packageManager: 'pnpm',
    };
    const depTreeWithMeta = {
      ...dependencyTree,
      meta: { ...dependencyTree.meta, ...meta },
    };

    return depTreeWithMeta;
  }

  public getDepMap(lockfile: Lockfile): DepMap {
    const pnpmLock = lockfile as PnpmFileLock;
    const depMap: DepMap = {};
    const allDependenciesData = pnpmLock.packages;
    const flattenLockfileRec = (
      lockfileDeps: pnpmLockfileLib.PackageSnapshots,
      path: string[],
    ) => {
      for (const [depName, dep] of Object.entries(lockfileDeps)) {
        const dependencyName = this.getName(depName);
        const packageVersion = this.getVersion(depName);

        const depNode: DepMapItem = {
          labels: {
            scope: dep.dev ? Scope.dev : Scope.prod,
          },
          name: dependencyName,
          requires: [],
          version: packageVersion,
        };

        if (dep.dependencies) {
          const transitives = dep.dependencies || {};
          depNode.requires = Object.keys(transitives);
        }

        const depPath: string[] = [...path, dependencyName];
        const depKey = depPath.join(this.pathDelimiter);
        depMap[depKey] = depNode;
        if (dep.dependencies) {
          const transitives = dep.dependencies;
          const transitiveMap: pnpmLockfileLib.PackageSnapshots = {};
          for (const t of Object.keys(transitives)) {
            const depName = `/${t}/${transitives[t]}`;
            transitiveMap[depName] = allDependenciesData[depName];
          }
          flattenLockfileRec(transitiveMap, depPath);
        }
      }
    };

    flattenLockfileRec(allDependenciesData || {}, []);
    return depMap;
  }

  protected getDepTreeKey(dep: Dep): string {
    return dep.name;
  }

  protected getName(depName: string): string {
    const fields = depName.split('/');
    return fields[1];
  }

  protected getVersion(depName: string): string {
    const fields = depName.split('/');
    return fields[fields.length - 1];
  }
}
