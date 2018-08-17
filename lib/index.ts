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

interface TargetFile {
  name?: string;
  dependencies?: {
    [dep: string]: object;
  };
  devDependencies?: {
    [dep: string]: object;
  };
}

export {
  buildDepTree,
  buildDepTreeFromFiles,
  PkgTree,
  DepType,
};

async function buildDepTree(targetFileRaw: string, lockFileRaw: string, includeDev = false): Promise<PkgTree> {

  const lockFile = JSON.parse(lockFileRaw);
  const targetFile = JSON.parse(targetFileRaw);

  if (!targetFile.dependencies && !includeDev) {
    throw new Error("No 'dependencies' property in package.json");
  }

  const depTree: PkgTree = {
    dependencies: {},
    hasDevDependencies: !!targetFile.devDependencies && Object.keys(targetFile.devDependencies).length > 0,
    name: targetFile.name,
    version: targetFile.version,
  };

  // asked to process empty deps
  if (_.isEmpty(targetFile.dependencies) && !includeDev) {
    return depTree;
  }

  if (!lockFile.dependencies && !includeDev) {
    throw new Error("No 'dependencies' property in package-lock.json");
  }
  const topLevelDeps = getTopLevelDeps(targetFile, includeDev);

  await Promise.all(topLevelDeps.map(async (dep) => {
    depTree.dependencies[dep] = await buildSubTreeRecursive(dep, [], lockFile, []);
  }));

  return depTree;
}

function getTopLevelDeps(targetFile: TargetFile, includeDev: boolean): string[] {
  let topLevelDeps = targetFile.dependencies;

  if (includeDev && targetFile.devDependencies) {
    topLevelDeps = {
      ...topLevelDeps,
      ...targetFile.devDependencies,
    };
  }

  return _.uniq(Object.keys(topLevelDeps));
}

async function buildSubTreeRecursive(
  dep: string, lockfileKeys: string[], lockFile: object, depPath: string[]): Promise<PkgTree> {

  const depSubTree: PkgTree = {
    depType: undefined,
    dependencies: {},
    name: dep,
    version: undefined,
  };

  // Get path to the nested dependencies from list ['package1', 'package2']
  // to ['dependencies', 'package1', 'dependencies', 'package2', 'dependencies']
  const lockfilePath = getDepPath(lockfileKeys);
  // try to get list of deps on the path
  const deps = _.get(lockFile, lockfilePath);

  // If exists and looked-up dep is there
  if (deps && deps[dep]) {
    // update the tree
    depSubTree.version = deps[dep].version;
    depSubTree.depType = deps[dep].dev ? DepType.dev : DepType.prod;
    const depKey = `${dep}@${deps[dep].version}`;
    // check if we already have a package at particular version in the traversed path
    if (depPath.includes(depKey)) {
      depSubTree.cyclic = true;
    } else {
      // if not, add it
      depPath.push(depKey);
      // repeat the process for dependencies of looked-up dep
      const newDeps = deps[dep].requires ? Object.keys(deps[dep].requires) : [];

      await Promise.all(newDeps.map(async (subDep) => {
        depSubTree.dependencies[subDep] = await buildSubTreeRecursive(
          subDep, [...lockfileKeys, dep], lockFile, depPath.slice());
      }));
    }
    return depSubTree;
  } else {
    // tree was walked to the root and dependency was not found
    if (!lockfileKeys.length) {
      throw new Error(`Dependency ${dep} was not found in package-lock.json.
        Your package.json and package-lock.json are probably out of sync.
        Please run npm install and try to parse the log again.`);
    }
    // dependency was not found on a current path, remove last key (move closer to the root) and try again
    // visitedDepPaths can be passed by a reference, because traversing up doesn't update it
    return buildSubTreeRecursive(dep, lockfileKeys.slice(0, -1), lockFile, depPath);
  }
}

function getDepPath(depKeys: string[]) {
  const depPath = depKeys.reduce((acc, key) => {
        return acc.concat([key, 'dependencies']);
      }, ['dependencies']);

  return depPath;
}

async function buildDepTreeFromFiles(
  root: string, targetFilePath: string, lockFilePath: string, includeDev = false): Promise<PkgTree> {
  if (!root || !lockFilePath || !lockFilePath) {
    throw new Error('Missing required parameters for buildDepTreeFromFiles()');
  }

  const targetFileFullPath = path.resolve(root, targetFilePath);
  const lockFileFullPath = path.resolve(root, lockFilePath);

  if (!fs.existsSync(targetFileFullPath)) {
    throw new Error(`Target file package.json not found at location: ${targetFileFullPath}`);
  }
  if (!fs.existsSync(lockFileFullPath)) {
    throw new Error(`Lockfile package-lock.json not found at location: ${lockFileFullPath}`);
  }

  const targetFile = fs.readFileSync(targetFileFullPath, 'utf-8');
  const lockFile = fs.readFileSync(lockFileFullPath, 'utf-8');

  return await buildDepTree(targetFile, lockFile, includeDev);
}
