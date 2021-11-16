import { PackageLock } from './package-lock-parser';
import { YarnLock } from './yarn-lock-parser';
import { InvalidUserInputError } from '../errors';
import { Yarn2Lock } from './yarn2-lock-parser';
import { PnpmFileLock } from './pnpm-lock-parser';
import * as yaml from 'js-yaml';
import * as pnpmLockfileLib from '@pnpm/lockfile-file';

export interface Dep {
  name: string;
  version: string;
  dev?: boolean;
}

interface WorkspacesAlternateConfig {
  packages?: string[];
}

export type ManifestDependencies = {
  [dep: string]: string;
};

export interface ManifestFile {
  name: string;
  private?: string;
  engines?: {
    node?: string;
  };
  workspaces?: string[] | WorkspacesAlternateConfig;
  dependencies?: ManifestDependencies;
  devDependencies?: ManifestDependencies;
  optionalDependencies?: ManifestDependencies;
  peerDependencies?: ManifestDependencies;
  resolutions?: ManifestDependencies;
  version?: string;
}

export interface WorkspaceFile {
  packages: string[];
}

// This is a copy/paste from https://github.com/snyk/dep-graph/blob/master/src/legacy/index.ts
// and should be removed in favour of depgraph library interface

export interface DepTreeDep {
  name?: string; // shouldn't, but might happen
  version?: string; // shouldn't, but might happen
  dependencies?: {
    [depName: string]: DepTreeDep;
  };
  labels?: {
    [key: string]: string | undefined;
    scope?: 'dev' | 'prod';
    pruned?: 'cyclic' | 'true';
    missingLockFileEntry?: 'true';
  };
}

export interface PkgTree extends DepTreeDep {
  type?: string;
  packageFormatVersion?: string;
  dependencies: {
    [depName: string]: DepTreeDep;
  };
  meta?: {
    nodeVersion?: string;
    lockfileVersion?: number;
    packageManager?: string;
  };
  hasDevDependencies?: boolean;
  cyclic?: boolean;
  size?: number;
}

export enum Scope {
  prod = 'prod',
  dev = 'dev',
}

export enum LockfileType {
  npm = 'npm',
  npm7 = 'npm7',
  yarn = 'yarn',
  yarn2 = 'yarn2',
  pnpm = 'pnpm',
}

export interface LockfileParser {
  parseLockFile: (lockFileContents: string) => Lockfile;
  getDependencyTree: (
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev?: boolean,
    strict?: boolean,
    workspace?: string,
  ) => Promise<PkgTree>;
}

export type Lockfile = PackageLock | YarnLock | Yarn2Lock | PnpmFileLock;

export function parseManifestFile(manifestFileContents: string): ManifestFile {
  try {
    return JSON.parse(manifestFileContents);
  } catch (e) {
    const error = e as Error;
    throw new InvalidUserInputError(
      'package.json parsing failed with error ' + error.message,
    );
  }
}

export function parseWorkspaceFile(
  manifestFileContents: string,
): WorkspaceFile {
  try {
    const workspaceFile = yaml.load(manifestFileContents, {
      json: true,
    });

    return workspaceFile as WorkspaceFile;
  } catch (e) {
    const error = e as Error;
    throw new InvalidUserInputError(
      'pnpm-workspace.yaml parsing failed with error ' + error.message,
    );
  }
}

export function getTopLevelDeps(
  targetFile: ManifestFile,
  includeDev: boolean,
  lockfile: Lockfile,
  workspace?: string,
): {
  dependenciesArray: Dep[];
  pnpmDependencies: pnpmLockfileLib.ResolvedDependencies | undefined;
  pnpmDevDeps: pnpmLockfileLib.ResolvedDependencies | undefined;
} {
  const dependencies: Dep[] = [];
  let pnpmDependencies;
  let pnpmDevDep;

  if (lockfile.type === 'pnpm') {
    const pnpmResult = getPnpmTopLevel(lockfile, workspace, includeDev);
    return pnpmResult;
  } else {
    const dependenciesIterator = Object.entries({
      ...targetFile.dependencies,
      ...(includeDev ? targetFile.devDependencies : null),
      ...(targetFile.optionalDependencies || {}),
    });

    for (const [name, version] of dependenciesIterator) {
      dependencies.push({
        dev:
          includeDev && targetFile.devDependencies
            ? !!targetFile.devDependencies[name]
            : false,
        name,
        version,
      });
    }
    //  }

    // Only include peerDependencies if using npm and npm is at least
    // version 7 as npm v7 automatically installs peerDependencies
    if (lockfile.type === LockfileType.npm7 && targetFile.peerDependencies) {
      for (const [name, version] of Object.entries(
        targetFile.peerDependencies,
      )) {
        dependencies.push({
          name,
          version,
        });
      }
    }
  }

  return {
    dependenciesArray: dependencies,
    pnpmDependencies: pnpmDependencies,
    pnpmDevDeps: pnpmDevDep,
  };
}

// pnpm have link in the lockfile  ie: '@helpers/enzyme-redux': link:../../helpers/enzyme-redux
// those can link to any other package in the project
// Find the path the the link package
// to extra the dev dependencies from it
export function findPnpmLink(linkPath: string, workspace: string): string {
  // build a new linkPath with the useful info from linkPath (removing all the ..)
  const list = linkPath.split('/');
  const packagesNameList = workspace.split('/');
  const newList: string[] = [];
  let up = 0;

  // count how many file up we need to go
  list.forEach((filename) => {
    if (filename.includes('..')) {
      up = up + 1;
    }
  });

  // add current package name if needed
  // if up is smaller than packagesNameList length
  // the link is out of the current package
  if (up <= packagesNameList.length) {
    for (let index = 0; index < up; index++) {
      newList.push(packagesNameList[index]);
    }
  }

  // add the linked folder name
  list.forEach((filename) => {
    if (!(filename.includes('..') || filename.includes('link:..'))) {
      newList.push(filename);
    }
  });
  const newPath = newList.join('/');

  return newPath;
}

export function createDepTreeDepFromDep(dep: Dep): DepTreeDep {
  return {
    labels: {
      scope: dep.dev ? Scope.dev : Scope.prod,
    },
    name: dep.name,
    version: dep.version,
  };
}

export function getYarnWorkspaces(targetFile: string): string[] | false {
  try {
    const packageJson: ManifestFile = parseManifestFile(targetFile);
    if (!!packageJson.workspaces && !!packageJson.private) {
      const workspacesPackages = packageJson.workspaces as string[];
      const workspacesAlternateConfigPackages = (packageJson.workspaces as WorkspacesAlternateConfig)
        .packages;
      return [...(workspacesAlternateConfigPackages || workspacesPackages)];
    }
    return false;
  } catch (e) {
    const error = e as Error;
    throw new InvalidUserInputError(
      'package.json parsing failed with ' + `error ${error.message}`,
    );
  }
}

export function getPnpmWorkspaces(targetFile: string): string[] | false {
  try {
    const workspaceFile: WorkspaceFile = parseWorkspaceFile(targetFile);
    if (workspaceFile.packages) {
      const workspacesPackages = workspaceFile.packages as string[];

      return [...workspacesPackages];
    }
    return false;
  } catch (e) {
    const error = e as Error;
    throw new InvalidUserInputError(
      'package.json parsing failed with ' + `error ${error.message}`,
    );
  }
}

function getPnpmTopLevel(
  lockfile,
  workspace,
  includeDev,
): {
  dependenciesArray: Dep[];
  pnpmDependencies: pnpmLockfileLib.ResolvedDependencies | undefined;
  pnpmDevDeps: pnpmLockfileLib.ResolvedDependencies | undefined;
} {
  const pnpmLock = lockfile as PnpmFileLock;
  const dependencies: Dep[] = [];
  let pnpmDependencies;
  let pnpmDevDep;

  if (workspace) {
    // If this is a workspace project then the top level dependencies will be
    // specified in importers[package_name]
    for (const [PackageName, dep] of Object.entries(pnpmLock.importers)) {
      // To make an accurate tree and avoid infinite loop we need to use only
      // the top level deps of package we are building a tree for
      if (PackageName.includes(workspace)) {
        if (dep.dependencies != undefined) {
          for (const [depKeys, depValue] of Object.entries(dep.dependencies)) {
            // If the package needs an other package it will look like
            // packages/packagesName: link../packageName
            // We delete the link and replace with the appropriate package deps
            if (depValue.includes('link:..')) {
              const linkedPkgName = findPnpmLink(depValue, workspace);
              delete dep.dependencies[depKeys];
              if (pnpmLock.importers[linkedPkgName]) {
                dep.dependencies = {
                  ...dep.dependencies,
                  ...pnpmLock.importers[linkedPkgName].dependencies,
                };
              }
            }
          }
        }

        // Same as above but for devDependencies
        if (dep.devDependencies != undefined) {
          for (const [depKeys, depValue] of Object.entries(
            dep.devDependencies,
          )) {
            if (depValue.includes('link:..')) {
              const linkedPkgName = findPnpmLink(depValue, workspace);
              delete dep.devDependencies[depKeys];
              if (pnpmLock.importers[linkedPkgName]) {
                dep.devDependencies = {
                  ...dep.devDependencies,
                  ...pnpmLock.importers[linkedPkgName].devDependencies,
                };
              }
            }
          }
        }

        // Getting the top level dependencies details
        const dependenciesIterator = Object.entries({
          ...dep.dependencies,
          ...(includeDev ? dep.devDependencies : null),
        });

        // in a workspace configuration
        // top level deps are empty for pnpm
        // assigning it here to be reused later
        // while creating the depMap
        pnpmDependencies = dep.dependencies;
        pnpmDevDep = dep.devDependencies;

        for (const [name, version] of dependenciesIterator) {
          dependencies.push({
            dev:
              includeDev && pnpmLock.devDependencies
                ? !!pnpmLock.devDependencies[name]
                : false,
            name,
            version,
          });
        }
      }
    }
  } else {
    // Getting the top level dependencies details
    const dependenciesIterator = Object.entries({
      ...pnpmLock.dependencies,
      ...(includeDev ? pnpmLock.devDependencies : null),
    });

    for (const [name, version] of dependenciesIterator) {
      dependencies.push({
        dev:
          includeDev && pnpmLock.devDependencies
            ? !!pnpmLock.devDependencies[name]
            : false,
        name,
        version,
      });
    }
  }
  return {
    dependenciesArray: dependencies,
    pnpmDependencies: pnpmDependencies,
    pnpmDevDeps: pnpmDevDep,
  };
}
