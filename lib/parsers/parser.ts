import * as _ from 'lodash';
import {PackageLock} from './package-lock-parser';
import {YarnLock} from './yarn-lock-parse';

export interface Dep {
  name: string;
  version: string;
  dev?: boolean;
}

export interface ManifestFile {
  name?: string;
  dependencies?: {
    [dep: string]: string;
  };
  devDependencies?: {
    [dep: string]: string;
  };
  version?: string;
}

export interface PkgTree {
  name: string;
  version: string;
  dependencies?: {
    [dep: string]: PkgTree;
  };
  depType?: DepType;
  hasDevDependencies?: boolean;
  cyclic?: boolean;
}

export enum DepType {
  prod = 'prod',
  dev = 'dev',
}

export type Lockfile = PackageLock | YarnLock;

export abstract class LockfileParser {
  protected manifestFile: ManifestFile;
  protected lockfile: Lockfile;

  public abstract parseLockFile(lockFileContents: string): Lockfile;

  public async abstract getDependencyTree(
    manifestFile: ManifestFile, lockfile: Lockfile, includeDev?: boolean): Promise<PkgTree>;

  public parseManifestFile(manifestFileContents: string): ManifestFile {
    try {
      return JSON.parse(manifestFileContents);
    } catch (e) {
      throw new Error(`package.json parsing failed with error ${e.message}`);
    }
  }

  protected getTopLevelDeps(targetFile: ManifestFile, includeDev: boolean): Dep[] {
    const dependencies: Dep[] = [];

    const dependenciesIterator = _.entries({
      ...targetFile.dependencies,
      ...(includeDev ? targetFile.devDependencies : null),
    });

    for (const [name, version] of dependenciesIterator) {
      dependencies.push({
        dev: (includeDev && targetFile.devDependencies) ?
          !!targetFile.devDependencies[name] : false,
        name,
        version,
      });
    }

    return dependencies;
  }
}
