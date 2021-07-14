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

      console.log('****************', { lockfile });

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

  // public getDepMap(lockfile: Lockfile): DepMap {

  //   const pnpmLockfile = lockfile as PnpmFileLock;
  //   const depMap: DepMap = {};

  //   const flattenLockfileRec = (
  //     lockfileDeps: PackageSnapshots,
  //     path: string[],
  //   ) => {
  //     for (const [depName, dep] of Object.entries(lockfileDeps)) {
  //       const name = getName(depName);
  //       const version = getVersion(depName);
  //       const depNode: DepMapItem = {
  //         labels: {
  //           scope: dep.dev ? Scope.dev : Scope.prod,
  //         },
  //         name,
  //         requires: [],
  //         version,
  //       };

  //       // if (name.includes('basic-auth'))
  //       // {
  //       //   console.log(depName)
  //       //   console.log(dep)
  //       // }

  //       if (dep.dependencies) {
  //         //depNode.requires = Object.keys(dep.dependencies);
  //         for (const name of Object.keys(dep.dependencies)) {
  //           const version = dep.dependencies[name];
  //           depNode.requires.push(`${name}@${version}`)
  //         }
  //       }

  //       //const depPath: string[] = []
  //       // if (path.length == 0)
  //       // {
  //       //   depPath.push(`${name}@${version}`)
  //       // }
  //       // else
  //       // {
  //       //   depPath.push(path[0])
  //       //   depPath.push(`${name}@${version}`)
  //       // }
  //       const depPath: string[] = [...path, `${name}@${version}`];
  //       const depKey = depPath.join(this.pathDelimiter);
  //       depMap[depKey] = depNode;

  //       if (dep.dependencies) {
  //         const transitivePackages: PackageSnapshots = {};
  //         for (const name of Object.keys(dep.dependencies)) {
  //           const version = dep.dependencies[name];
  //           const snapshotName = `/${name}/${version}`;
  //           transitivePackages[snapshotName] =
  //             pnpmLockfile.packages[snapshotName];
  //         }

  //         flattenLockfileRec(transitivePackages, depPath);
  //       }
  //     }
  //   };

  //   flattenLockfileRec(pnpmLockfile.packages || {}, []);

  //   // for (const [key, value] of  Object.entries(depMap)) {
  //   //   if (key.includes('basic-auth'))
  //   //   {
  //   //     console.log(key)
  //   //     console.log(value)
  //   //   }
  //   //   //console.log(key, value)
  //   // }

  //   return depMap;
  // }

  public getDepMap(lockfile: Lockfile): DepMap {
    // const pnpmLock = lockfile as PnpmFileLock;
    // const depMap: DepMap = {};

    // for (const [depName, dep] of Object.entries(pnpmLock.packages!)) {
    //   const subDependencies = Object.entries({
    //     ...(dep.dependencies || {}),
    //   });
    //   const packageName = this.getName(depName);
    //   const packageVersion = this.getVersion(depName)

    //   depMap[packageName] = {
    //     labels: {
    //       scope: Scope.prod,
    //     },
    //     name: packageName,
    //     requires: subDependencies.map(([key, ver]) => key),
    //     version: packageVersion,
    //   };
    // }

    const pnpmLock = lockfile as PnpmFileLock;
    const depMap: DepMap = {};

    const flattenLockfileRec = (
      lockfileDeps: pnpmLockfileLib.PackageSnapshots,
      path: string[],
    ) => {
      for (const [depName, dep] of Object.entries(lockfileDeps)) {
        const dependencyName = this.getName(depName);
        const packageVersion = this.getVersion(depName)

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
            transitiveMap[depName] = lockfileDeps[depName];
          }
          flattenLockfileRec(transitiveMap, depPath);
        }
      }
    };

    flattenLockfileRec(pnpmLock.packages || {}, []);
    console.log(JSON.stringify({ depMap }));

    return depMap;
  }

  protected getDepTreeKey(dep: Dep): string {
    console.log({dep})
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
