import 'source-map-support/register';
import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import {getRuntimeVersion} from './utils';
let yarnLockfile = {
  parse: ((param?) => {
    const unsupportedRuntimeError = new Error();
    unsupportedRuntimeError.name = 'UnsupportedRuntimeError';
    // tslint:disable:max-line-length
    unsupportedRuntimeError.message = 'Parsing `yarn.lock` is not supported on Node.js version less than 6. Please upgrade your Node.js environment or use `package-lock.json`';
    throw unsupportedRuntimeError;
  }),
};
if (getRuntimeVersion() >= 6) {
  // tslint:disable:no-var-requires
  yarnLockfile = require('@yarnpkg/lockfile');
}

enum DepType {
  prod = 'prod',
  dev = 'dev',
}

enum LockfileType {
  npm = 'npm',
  yarn = 'yarn',
}

interface PkgTree {
  name: string;
  version: string;
  dependencies?: {
    [dep: string]: PkgTree;
  };
  depType?: DepType;
  hasDevDependencies?: boolean;
  cyclic?: boolean;
}

interface ManifestFile {
  name?: string;
  dependencies?: {
    [dep: string]: string;
  };
  devDependencies?: {
    [dep: string]: string;
  };
  version?: string;
}

interface PackageLock {
  name: string;
  version: string;
  dependencies?: PackageLockDeps;
  lockfileVersion: number;
}

interface PackageLockDeps {
  [depName: string]: PackageLockDep;
}

interface PackageLockDep {
  version: string;
  requires?: {
    [depName: string]: string;
  };
  dependencies?: PackageLockDeps;
  dev?: boolean;
}

interface YarnLock {
  type: string;
  object: {
    [depName: string]: YarnLockDep;
  };
}

interface YarnLockDep {
  version: string;
  dependencies?: {
    [depName: string]: string;
  };
  optionalDependencies?: {
    [depName: string]: string;
  };
}

interface Dep {
  name: string;
  version: string;
  dev?: boolean;
}

export {
  buildDepTree,
  buildDepTreeFromFiles,
  PkgTree,
  DepType,
  LockfileType,
};

async function buildDepTree(
  manifestFileContents: string, lockFileContents: string,
  includeDev = false, lockfileType?: LockfileType): Promise<PkgTree> {

  let manifestFile: ManifestFile;
  try {
    manifestFile = JSON.parse(manifestFileContents);
  } catch (e) {
    throw new Error(`package.json parsing failed with error ${e.message}`);
  }

  if (!manifestFile.dependencies && !includeDev) {
    throw new Error("No 'dependencies' property in package.json");
  }

  const depTree: PkgTree = {
    dependencies: {},
    hasDevDependencies: !_.isEmpty(manifestFile.devDependencies),
    name: manifestFile.name,
    version: manifestFile.version,
  };

  // asked to process empty deps
  if (_.isEmpty(manifestFile.dependencies) && !includeDev) {
    return depTree;
  }

  const lockFile: PackageLock | YarnLock = parseLockFile(lockFileContents, lockfileType, includeDev);
  const topLevelDeps: Dep[] = getTopLevelDeps(manifestFile, includeDev);

  switch (lockfileType) {
    case LockfileType.npm:
      await Promise.all(topLevelDeps.map(async (dep) => {
        depTree.dependencies[dep.name] = await buildSubTreeRecursiveFromPackageLock(
          dep.name, ['dependencies'], lockFile as PackageLock, [], dep.dev);
      }));
      break;
    case LockfileType.yarn:
      await Promise.all(topLevelDeps.map(async (dep) => {
        depTree.dependencies[dep.name] =
          await buildSubTreeRecursiveFromYarnLock(dep, lockFile as YarnLock, []);
      }));
      break;
  }

  return depTree;
}

function getTopLevelDeps(targetFile: ManifestFile, includeDev: boolean): Dep[] {
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

async function buildSubTreeRecursiveFromPackageLock(
  depName: string, lockfilePath: string[], lockFile: PackageLock, depPath: string[], isDev = false): Promise<PkgTree> {

  const depSubTree: PkgTree = {
    depType: undefined,
    dependencies: {},
    name: depName,
    version: undefined,
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
        depSubTree.dependencies[subDep] = await buildSubTreeRecursiveFromPackageLock(
          subDep, [...lockfilePath, depName, 'dependencies'], lockFile, depPath.slice(), isDev);
      }));
    }
    return depSubTree;
  } else {
    // tree was walked to the root and dependency was not found
    if (!lockfilePath.length) {
      throw new Error(`Dependency ${depName} was not found in package-lock.json.
        Your package.json and package-lock.json are probably out of sync.
        Please run "npm install" and try again.`);
    }
    // dependency was not found on a current path, remove last key (move closer to the root) and try again
    // visitedDepPaths can be passed by a reference, because traversing up doesn't update it
    return buildSubTreeRecursiveFromPackageLock(depName, lockfilePath.slice(0, -1), lockFile, depPath, isDev);
  }
}

async function buildSubTreeRecursiveFromYarnLock(
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
      depSubTree.dependencies[name] = await buildSubTreeRecursiveFromYarnLock(
        newDep, lockFile, [...depPath]);
    }));
  }

  return depSubTree;
}

function parseLockFile(lockFileRaw: string, lockfileType: LockfileType, includeDev: boolean): PackageLock | YarnLock {
  let lockfile: PackageLock | YarnLock ;
  switch (lockfileType) {
    case LockfileType.npm:
      try {
        lockfile = JSON.parse(lockFileRaw);
      } catch (e) {
        throw new Error(`package-lock.json parsing failed with error ${e.message}`);
      }
      if (!(lockfile as PackageLock).dependencies && !includeDev) {
        throw new Error("No 'dependencies' property in package-lock.json");
      }
      break;
    case LockfileType.yarn:
      try {
        lockfile = yarnLockfile.parse(lockFileRaw);
      } catch (e) {
        if (e.name === 'UnsupportedRuntimeError') {
          throw e;
        }
        throw new Error(`yarn.lock parsing failed with an error: ${e.message}`);
      }
      if ((lockfile as YarnLock).type !== 'success') {
        throw new Error('yarn.lock file parsing failed.');
      }
      break;
  }

  return lockfile;
}

async function buildDepTreeFromFiles(
  root: string, manifestFilePath: string, lockFilePath: string, includeDev = false): Promise<PkgTree> {
  if (!root || !manifestFilePath || !lockFilePath) {
    throw new Error('Missing required parameters for buildDepTreeFromFiles()');
  }

  let lockFileType: LockfileType;
  if (lockFilePath.endsWith('package-lock.json')) {
    lockFileType = LockfileType.npm;
  } else if (lockFilePath.endsWith('yarn.lock')) {
    lockFileType = LockfileType.yarn;
  } else {
    throw new Error(`Unknown lockfile ${lockFilePath}.
      Please provide either package-lock.json or yarn.lock.`);
  }

  const manifestFileFullPath = path.resolve(root, manifestFilePath);
  const lockFileFullPath = path.resolve(root, lockFilePath);

  if (!fs.existsSync(manifestFileFullPath)) {
    throw new Error(`Target file package.json not found at location: ${manifestFileFullPath}`);
  }
  if (!fs.existsSync(lockFileFullPath)) {
    throw new Error(`Lockfile not found at location: ${lockFileFullPath}`);
  }

  const manifestFileContents = fs.readFileSync(manifestFileFullPath, 'utf-8');
  const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');

  return await buildDepTree(manifestFileContents, lockFileContents, includeDev, lockFileType);
}
