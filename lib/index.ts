import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash";

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
    const version = fullDepList[dep].version;
    const name = `${dep}@${version}`;
    acc[name] = dep;
    return acc;
  }, {});

  for (const dep in parentDepsMap) {
    const subTree = buildSubTreeRecursive(depsMap[dep], [depsMap[dep]], lockFile);

    if (subTree) {
      depTree.dependencies[subTree.name] = subTree;
    }
  }

  return depTree;
}

function buildSubTreeRecursive(dep: string, depKeys: Array<string>, depsMap: Object) {
  let depsPath = ['dependencies'];
  if (depKeys.length > 1) {
    const depsPath = _.flattenDeep(depKeys.map((key) => {
      return [key, 'dependencies']
    })
  )}

  const depTree = {
    dependencies: {},
    name: dep || undefined,
    version: undefined,
  };

  const deps = _.get(depsMap, depsPath);

  if (deps && deps[dep]) {
    depTree.version = deps[dep].version
    if (deps[dep].requires) {
      const newDepKeys = depKeys.slice();
      newDepKeys.push(dep);
      Object.keys(deps[dep].requires).forEach((dep) => {
        depTree.dependencies[dep] = buildSubTreeRecursive(dep, newDepKeys, depsMap);
      });
      return depTree;
    } else {
      return depTree;
    }
  } else {
    if (!depKeys.length) {
      throw new Error(`Dependency ${dep} was not found in package-lock.json.`);
    }
    depKeys = depKeys.slice(0, -1);
    depTree.dependencies[dep] = buildSubTreeRecursive(dep, depKeys, depsMap);
  }
}
