import * as pnpmLockfileLib from '@pnpm/lockfile-file';
import * as yaml from 'js-yaml';
import Debug from 'debug';

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

export interface PnpmFileLock extends pnpmLockfileLib.Lockfile {
  type: string;
  dependencies?: pnpmLockfileLib.ResolvedDependencies;
  devDependencies?: pnpmLockfileLib.ResolvedDependencies;
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

      return lockfile;
      1;
    } catch (e) {
      const error = e as Error;
      throw new InvalidUserInputError(
        `pnpm-lock.yml parsing failed with error ${error.message}`,
      );
    }
  }

  public async getDependencyTree(
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev: boolean = false,
    strict: boolean = true,
    workspace?: string,
  ): Promise<PkgTree> {
    const dependencyTree = await super.getDependencyTree(
      manifestFile,
      lockfile,
      includeDev,
      strict,
      workspace,
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

  public getDepMap(
    lockfile: Lockfile,
    pnpmTopLevelDeps?: pnpmLockfileLib.ResolvedDependencies,
    pnpmTopLevelDevDeps?: pnpmLockfileLib.ResolvedDependencies,
  ): DepMap {
    const debug = Debug('Snyk');

    const pnpmLock = lockfile as PnpmFileLock;
    const depMap: DepMap = {};

    let FirstTransitives = {};

    // if pnpmTopLevelDeps or pnpmTopLevelDevDeps means this is  workspace
    // use the the topLevel calculated before to generate the FirstTransitives
    if (pnpmTopLevelDeps) {
      pnpmLock.dependencies = pnpmTopLevelDeps;
    }

    if (pnpmTopLevelDevDeps) {
      pnpmLock.devDependencies = pnpmTopLevelDevDeps;
    }

    FirstTransitives = {
      ...FirstTransitives,
      ...pnpmLock.dependencies,
      ...pnpmLock.devDependencies,
    };

    const startingDependenciesData: pnpmLockfileLib.PackageSnapshots = {};

    const allDependenciesData = pnpmLock.packages;

    if (!FirstTransitives || !allDependenciesData) return {};

    // Building the first dependencies data with the topLevel dependencies
    // to start the building the depMap
    for (const [depName, dep] of Object.entries(FirstTransitives)) {
      const transitiveName = `/${depName}/${dep}`;
      startingDependenciesData[transitiveName] =
        allDependenciesData[transitiveName];
    }

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
            if (!depPath.includes(t)) {
              transitiveMap[depName] = allDependenciesData[depName];
            } else {
              debug('Info: Already have this transitive ' + t + ' in the path');
            }
          }
          if (transitiveMap === {}) {
            return;
          } else {
            flattenLockfileRec(transitiveMap, depPath);
          }
        }
      }
    };

    flattenLockfileRec(startingDependenciesData || {}, []);

    return depMap;
  }

  protected getDepTreeKey(dep: Dep): string {
    return dep.name;
  }

  protected getName(depName: string): string {
    const fields = depName.split('/');
    fields.pop();
    return fields.join('/').substring(1);
  }

  protected getVersion(depName: string): string {
    const fields = depName.split('/');
    return fields[fields.length - 1];
  }
}
