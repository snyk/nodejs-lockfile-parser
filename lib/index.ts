import 'source-map-support/register';
import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';

export {
  buildDepTree,
  buildDepTreeFromFiles,
};

async function buildDepTree(targetFileRaw, lockFileRaw, options) {

  const lockFile = JSON.parse(lockFileRaw);
  const targetFile = JSON.parse(targetFileRaw);

  if (!targetFile.dependencies) {
    throw new Error("No 'dependencies' property in package.json");
  }
  if (!lockFile.dependencies) {
    throw new Error("No 'dependencies' property in package-lock.json");
  }

  const depTree = {
    dependencies: {},
    name: targetFile.name || undefined,
    version: targetFile.version || undefined,
  };

  const topLevelDeps = Object.keys(targetFile.dependencies);

  await Promise.all(topLevelDeps.map(async (dep) => {
    depTree.dependencies[dep] = await buildSubTreeRecursive(dep, [], lockFile);
  }));

  return depTree;
}

async function buildSubTreeRecursive(dep: string, depKeys: string[], lockFile: object) {

  const depSubTree = {
    dependencies: {},
    name: dep,
    version: undefined,
  };

  // Get path to the nested dependencies from list ['package1', 'package2']
  // to ['dependencies', 'package1', 'dependencies', 'package2', 'dependencies']
  const depPath = getDepPath(depKeys);
  // try to get list of deps on the path
  const deps = _.get(lockFile, depPath);

  // If exists and looked-up dep is there
  if (deps && deps[dep]) {
    // update the tree
    depSubTree.version = deps[dep].version;
    // repeat the process for dependencies of looked-up dep
    const newDeps = deps[dep].requires ? Object.keys(deps[dep].requires) : [];
    await Promise.all(newDeps.map(async (subDep) => {
      depSubTree.dependencies[subDep] = await buildSubTreeRecursive(subDep, [...depKeys, dep], lockFile);
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
    return buildSubTreeRecursive(dep, depKeys.slice(0, -1), lockFile);
  }
}

function getDepPath(depKeys: string[]) {
  const depPath = depKeys.reduce((acc, key) => {
        return acc.concat([key, 'dependencies']);
      }, ['dependencies']);

  return depPath;
}

function buildDepTreeFromFiles(root, targetFilePath, lockFilePath, options) {
  if (!root || !lockFilePath || !lockFilePath) {
    throw new Error('Missing required parameters for parseLockFile()');
  }

  const targetFileFullPath = path.resolve(root, targetFilePath);
  const lockFileFullPath = path.resolve(root, lockFilePath);

  if (!fs.existsSync(targetFileFullPath)) {
    throw new Error(`Target file package.json not found at location: ${targetFileFullPath}`);
  }
  if (!fs.existsSync(lockFileFullPath)) {
    throw new Error(`LockFile package-lock.json not found at location: ${lockFileFullPath}`);
  }

  const targetFile = fs.readFileSync(targetFileFullPath);
  const lockFile = fs.readFileSync(lockFileFullPath);

  return buildDepTree(targetFile, lockFile, options);
}
