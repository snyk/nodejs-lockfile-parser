import * as _ from 'lodash';
import {PackageLock} from './package-lock-parser';
import {YarnLock} from './yarn-lock-parse';
import {InvalidUserInputError} from '../errors';

export interface Dep {
  name: string;
  version: string;
  dev?: boolean;
}

export interface ManifestFile {
  name: string;
  private?: string;
  engines?: {
    node?: string;
  };
  workspaces?: string[];
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
  dependencies: {
    [dep: string]: PkgTree;
  };
  meta?: {
    nodeVersion: string;
  };
  labels?: {
    depType: DepType;
  };
  hasDevDependencies?: boolean;
  cyclic?: boolean;
  missingLockFileEntry?: boolean;
  size?: number;
}

export enum DepType {
  prod = 'prod',
  dev = 'dev',
}

export enum LockfileType {
  npm = 'npm',
  yarn = 'yarn',
}

export interface LockfileParser {
  parseLockFile: (lockFileContents: string)
      => Lockfile;
  getDependencyTree: (manifestFile: ManifestFile, lockfile: Lockfile,
                      includeDev?: boolean, strict?: boolean)
      => Promise<PkgTree>;
}

export type Lockfile = PackageLock | YarnLock;

export function parseManifestFile(manifestFileContents: string): ManifestFile {
  try {
    return JSON.parse(manifestFileContents);
  } catch (e) {
    throw new InvalidUserInputError('package.json parsing failed with error ' +
      e.message);
  }
}

export function getTopLevelDeps(targetFile: ManifestFile, includeDev: boolean): Dep[] {
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

export function createPkgTreeFromDep(dep: Dep): PkgTree {
  const pkgTree: PkgTree = {
    dependencies: {},
    labels: {
      depType: dep.dev ? DepType.dev : DepType.prod,
    },
    name: dep.name,
    version: dep.version,
  };

  return pkgTree;
}

export function getYarnWorkspaces(targetFile: string): string [] | false {
  try {
    const packageJson: ManifestFile = parseManifestFile(targetFile);
    if (!!packageJson.workspaces && !!packageJson.private) {
      return [...packageJson.workspaces];
    }
    return false;
  } catch (e) {
    throw new InvalidUserInputError('package.json parsing failed with ' +
      `error ${e.message}`);
  }
}
