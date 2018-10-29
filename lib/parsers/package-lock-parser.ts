import * as _ from 'lodash';
import {LockfileParser, PkgTree, Dep, DepType, ManifestFile,
  getTopLevelDeps, Lockfile, LockfileType} from './';
import {InvalidUserInputError, OutOfSyncError} from '../errors';

export interface PackageLock {
  name: string;
  version: string;
  dependencies?: PackageLockDeps;
  lockfileVersion: number;
  type: LockfileType.npm;
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

export class PackageLockParser implements LockfileParser {

  public parseLockFile(lockFileContents: string): PackageLock {
    try {
      const packageLock: PackageLock = JSON.parse(lockFileContents);
      packageLock.type = LockfileType.npm;
      return packageLock;
    } catch (e) {
      throw new InvalidUserInputError('package-lock.json parsing failed with ' +
        `error ${e.message}`);
    }
  }

  public async getDependencyTree(
    manifestFile: ManifestFile, lockfile: Lockfile, includeDev = false): Promise<PkgTree> {
    if (lockfile.type !== LockfileType.npm) {
      throw new InvalidUserInputError('Unsupported lockfile provided. Please ' +
        'provide `package-lock.json`.');
    }
    const packageLock = lockfile as PackageLock;

    const depTree: PkgTree = {
      dependencies: {},
      hasDevDependencies: !_.isEmpty(manifestFile.devDependencies),
      name: manifestFile.name,
      version: manifestFile.version || '',
    };

    const topLevelDeps: Dep[] = getTopLevelDeps(manifestFile, includeDev);

    // asked to process empty deps
    if (_.isEmpty(manifestFile.dependencies) && !includeDev) {
      return depTree;
    }

    await Promise.all(topLevelDeps.map(async (dep) => {
      depTree.dependencies[dep.name] = await this.buildSubTreeRecursiveFromPackageLock(
        dep.name, ['dependencies'], packageLock, [], dep.dev);
    }));

    return depTree;
  }

  private async buildSubTreeRecursiveFromPackageLock(
    depName: string, lockfilePath: string[], lockFile: PackageLock,
    depPath: string[], isDev = false): Promise<PkgTree> {

    const depSubTree: PkgTree = {
      depType: undefined,
      dependencies: {},
      name: depName,
      version: '', // will be set later or error will be thrown
    };

    // try to get list of deps on the path
    const deps: PackageLockDeps = _.get(lockFile, lockfilePath);
    const dep: PackageLockDep = _.get(deps, depName);
    // If exists and looked-up dep is there
    if (dep) {
      // update the tree
      depSubTree.version = dep.version;
      depSubTree.depType = (isDev || dep.dev) ? DepType.dev : DepType.prod;
      // check if we already have a package at particular version in the traversed path
      const depKey = `${depName}@${dep.version}`;
      if (depPath.indexOf(depKey) >= 0) {
        depSubTree.cyclic = true;
      } else {
        // if not, add it
        depPath.push(depKey);
        // repeat the process for dependencies of looked-up dep
        const newDeps = dep.requires ? Object.keys(dep.requires) : [];

        await Promise.all(newDeps.map(async (subDep) => {
          depSubTree.dependencies[subDep] = await this.buildSubTreeRecursiveFromPackageLock(
            subDep, [...lockfilePath, depName, 'dependencies'], lockFile, depPath.slice(), isDev);
        }));
      }
      return depSubTree;
    } else {
      // tree was walked to the root and dependency was not found
      if (!lockfilePath.length) {
        throw new OutOfSyncError(depName, 'npm');
      }
      // dependency was not found on a current path, remove last key (move closer to the root) and try again
      // visitedDepPaths can be passed by a reference, because traversing up doesn't update it
      return this.buildSubTreeRecursiveFromPackageLock(depName, lockfilePath.slice(0, -1), lockFile, depPath, isDev);
    }
  }
}