import * as fs from 'fs';
import * as path from 'path';

export default function parseLockFile(root, targetFilePath, lockFilePath, options) {
  if (!root || !lockFilePath || !lockFilePath) {
    throw new Error('Missing required parameters for parseLockFile()');
  }
  // TODO: validate only valid options were passed in

  const targetFileFullPath = path.resolve(root, targetFilePath);
  const lockFileFullPath = path.resolve(root, lockFilePath);

  if (!fs.existsSync(targetFilePath)) {
    throw new Error(`Target file package.json not found at location: ${targetFileFullPath}`);
  }
  if (!fs.existsSync(lockFilePath)) {
    throw new Error(`LockFile package-lock.json not found at location: ${lockFileFullPath}`);
  }

  const targetFile = fs.readFileSync(targetFilePath);
  const lockFile = fs.readFileSync(lockFilePath);

  return buildDepTree(targetFile, lockFile, options);
}

function buildDepTree(targetFileRaw, lockFileRaw, options) {

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
  const parentDepList = targetFile.dependencies;
  const fullDepList = lockFile.dependencies;

  const parentDepsMap = Object.keys(parentDepList).reduce((acc, depName) => {
    const version = parentDepList[depName];
    const name = `${depName}@${version}`;
    acc[name] =  {
      name: depName,
      version,
    };
    return acc;
  }, {});

  const depsMap = Object.keys(fullDepList).reduce((acc, dep) => {
    const version = fullDepList[dep];
    const name = `${dep}@${version}`;
    acc[name] = dep;
    return acc;
  }, {});

  for (const dep in depsMap) {
    if (depsMap.hasOwnProperty(dep)) {
      const subTree = buildSubTreeRecursive(dep, new Set(), depsMap);

      if (subTree) {
        depTree.dependencies[subTree.name] = subTree;
      }
    }
  }

  return depTree;
}

function buildSubTreeRecursive(dep, ancestors, depsMap) {
  const newAncestors = (new Set(ancestors)).add(dep);
  // TODO
  const tree = {
    name: depsMap[dep].name,
    version: depsMap[dep].version,
  };

  return tree;
}
