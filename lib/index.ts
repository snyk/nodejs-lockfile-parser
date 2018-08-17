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
    depTree.dependencies[dep] = await buildSubTreeRecursive(dep, [], lockFile, new Set());
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
  dep: string, depKeys: string[], lockFile: object, visitedDepPaths: Set<string>): Promise<PkgTree> {

  const depSubTree: PkgTree = {
    depType: undefined,
    dependencies: {},
    name: dep,
    version: undefined,
  };

  // Get path to the nested dependencies from list ['package1', 'package2']
  // to ['dependencies', 'package1', 'dependencies', 'package2', 'dependencies']
  const depPath = getDepPath(depKeys);
  // storing looked up paths to catch cyclic reference,
  // i.e. 'dependencies-package1-dependencies-package2-dependencies-${currentDep}
  const depPathString = depPath.join('-') + `-${dep}`;
  // if we already tried to look up the path and error about the not found dependency was not thrown,
  // it means dependency was already found either on the path or upwards, therefore current one is cyclic
  if (visitedDepPaths.has(depPathString)) {
    depSubTree.cyclic = true;
    return depSubTree;
  }
  // if path is new, store it in the visited ones
  visitedDepPaths.add(depPathString);
  // try to get list of deps on the path
  const deps = _.get(lockFile, depPath);

  // If exists and looked-up dep is there
  if (deps && deps[dep]) {
    // update the tree
    depSubTree.version = deps[dep].version;
    depSubTree.depType = deps[dep].dev ? DepType.dev : DepType.prod;
    // repeat the process for dependencies of looked-up dep
    const newDeps = deps[dep].requires ? Object.keys(deps[dep].requires) : [];

    await Promise.all(newDeps.map(async (subDep) => {
      depSubTree.dependencies[subDep] = await buildSubTreeRecursive(
        subDep, [...depKeys, dep], lockFile, new Set(visitedDepPaths));
    }));
    return depSubTree;
  } else {
    // tree was walked to the root and dependency was not found
    if (!depKeys.length) {
      throw new Error(`Dependency ${dep} was not found in package-lock.json.
        Your package.json and package-lock.json are probably out of sync.
        Please run npm install and try to parse the log again.`);
    }
    // dependency was not found on a current path, remove last key (move closer to the root) and try again
    // visitedDepPaths can be passed by a reference, because traversing up doesn't update it
    return buildSubTreeRecursive(dep, depKeys.slice(0, -1), lockFile, visitedDepPaths);
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
