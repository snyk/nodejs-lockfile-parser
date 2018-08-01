const fs = require('fs');
const _ = require('lodash');

const packageJsonFile = fs.readFileSync('./package.json');
const packageJson = JSON.parse(packageJsonFile);

const packageLockFile = fs.readFileSync('./package-lock.json');
const packageLock = JSON.parse(packageLockFile);

result = ''


function resolveDepsRec(depName, depKeys, level) {
  let depsString = 'dependencies';
  if (depKeys.length) {
    depsString += '#';
    depsString += depKeys.join('#dependencies#');
    depsString += '#dependencies';
  }
  const deps = _.get(packageLock, depsString.split('#'));
  if (deps && deps[depName]) {
    result += '\t'.repeat(level)+depName+'@'+deps[depName].version+'\n';
    if (deps[depName].requires) {
      const newDepKeys = depKeys.slice();
      newDepKeys.push(depName);
      Object.keys(deps[depName].requires).forEach((dep) => {
        resolveDepsRec(dep, newDepKeys, level+1);
      });
    }
  } else {
    if (!depKeys.length) {
      console.log(depName)
      process.exit(24)
    }
    depKeys = depKeys.slice(0, -1);
    resolveDepsRec(depName, depKeys, level+1);
  }
}

Object.keys(packageJson.dependencies).forEach((dep) => {
  resolveDepsRec(dep, [], 0);
})

console.log(result)
