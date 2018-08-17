import 'source-map-support/register';
import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';

enum DepType {
  prod = 'prod',
  dev = 'dev',
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

interface Lockfile {
  name: string;
  version: string;
  dependencies?: LockfileDeps;
}

interface LockfileDeps {
  [depName: string]: LockfileDep;
}

interface LockfileDep {
  version: string;
  requires?: {
    [depName: string]: string;
  };
  dependencies?: LockfileDeps;
  dev?: boolean;
}

export {
  buildDepTree,
  buildDepTreeFromFiles,
  PkgTree,
  DepType,
};

async function buildDepTree(
  manifestFileContents: string, lockFileContents: string, includeDev = false): Promise<PkgTree> {

  const lockFile: Lockfile = JSON.parse(lockFileContents);
  const manifestFile: ManifestFile = JSON.parse(manifestFileContents);

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

  if (!lockFile.dependencies && !includeDev) {
    throw new Error("No 'dependencies' property in package-lock.json");
  }
  const topLevelDeps = getTopLevelDeps(manifestFile, includeDev);

  await Promise.all(topLevelDeps.map(async (dep) => {
    depTree.dependencies[dep] = await buildSubTreeRecursive(dep, ['dependencies'], lockFile, []);
  }));

  return depTree;
}

function getTopLevelDeps(targetFile: ManifestFile, includeDev: boolean): string[] {
  return Object.keys({
    ...targetFile.dependencies,
    ...(includeDev ? targetFile.devDependencies : null),
  });
}

async function buildSubTreeRecursive(
  depName: string, lockfilePath: string[], lockFile: Lockfile, depPath: string[]): Promise<PkgTree> {

  const depSubTree: PkgTree = {
    depType: undefined,
    dependencies: {},
    name: depName,
    version: undefined,
  };

  // try to get list of deps on the path
  const deps: LockfileDeps = _.get(lockFile, lockfilePath);
  const dep: LockfileDep = _.get(deps, depName);
  // If exists and looked-up dep is there
  if (dep) {
    // update the tree
    depSubTree.version = dep.version;
    depSubTree.depType = dep.dev ? DepType.dev : DepType.prod;
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
        depSubTree.dependencies[subDep] = await buildSubTreeRecursive(
          subDep, [...lockfilePath, depName, 'dependencies'], lockFile, depPath.slice());
      }));
    }
    return depSubTree;
  } else {
    // tree was walked to the root and dependency was not found
    if (!lockfilePath.length) {
      throw new Error(`Dependency ${depName} was not found in package-lock.json.
        Your package.json and package-lock.json are probably out of sync.
        Please run npm install and try to parse the log again.`);
    }
    // dependency was not found on a current path, remove last key (move closer to the root) and try again
    // visitedDepPaths can be passed by a reference, because traversing up doesn't update it
    return buildSubTreeRecursive(depName, lockfilePath.slice(0, -1), lockFile, depPath);
  }
}

async function buildDepTreeFromFiles(
  root: string, manifestFilePath: string, lockFilePath: string, includeDev = false): Promise<PkgTree> {
  if (!root || !lockFilePath || !lockFilePath) {
    throw new Error('Missing required parameters for buildDepTreeFromFiles()');
  }

  const manifestFileFullPath = path.resolve(root, manifestFilePath);
  const lockFileFullPath = path.resolve(root, lockFilePath);

  if (!fs.existsSync(manifestFileFullPath)) {
    throw new Error(`Target file package.json not found at location: ${manifestFileFullPath}`);
  }
  if (!fs.existsSync(lockFileFullPath)) {
    throw new Error(`Lockfile package-lock.json not found at location: ${lockFileFullPath}`);
  }

  const manifestFileContents = fs.readFileSync(manifestFileFullPath, 'utf-8');
  const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');

  return await buildDepTree(manifestFileContents, lockFileContents, includeDev);
}
