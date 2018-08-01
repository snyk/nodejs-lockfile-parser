const fs = require('fs');

const packageJsonFile = fs.readFileSync('./package.json');
const packageJson = JSON.parse(packageJsonFile);

const packageLockFile = fs.readFileSync('./package-lock.json');
const packageLock = JSON.parse(packageLockFile);

result = ''


function resolveDepsRec(depName, depsList, level) {
  if (!depsList[depName]) {
    return -1;
  }
  else {
    result += '\t'.repeat(level)+depName+'@'+depsList[depName].version+'\n';
    if (depsList[depName].requires) {
      Object.keys(depsList[depName].requires).forEach((dep) => {
        if (depsList[depName].dependencies) {
          if (resolveDepsRec(dep, depsList[depName].dependencies, level+1) === -1) {
            return resolveDepsRec(dep, depsList, level+1);
          }
        } else {
          return resolveDepsRec(dep, depsList, level+1);
        }
      })
    }
  }
}

Object.keys(packageJson.dependencies).forEach((dep) => {
  resolveDepsRec(dep, packageLock.dependencies, 0);
})

console.log(result)
