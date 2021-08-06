import { PackageLock } from './package-lock-parser';
import { YarnLock } from './yarn-lock-parser';
import { InvalidUserInputError } from '../errors';
import { Yarn2Lock } from './yarn2-lock-parser';
import { PnpmFileLock } from './pnpm-lock-parser';
import * as yaml from 'js-yaml';

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
    throw new InvalidUserInputError(
      'package.json parsing failed with error ' + e.message,
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
    throw new InvalidUserInputError(
      'pnpm-workspace.yaml parsing failed with error ' + e.message,
    );
  }
}

export function getTopLevelDeps(
  targetFile: ManifestFile,
  includeDev: boolean,
  lockfile: Lockfile,
  workspace?: string,
): Dep[] {
  const dependencies: Dep[] = [];

  if (lockfile.type === 'pnpm') {
    const pnpmLock = lockfile as PnpmFileLock;
    let topLevelDeps = {};

    if (workspace) {
      // If this is a workspace project then the top level dependencies will be
      // specified in importers[package_name]
      for (const [PackageName, dep] of Object.entries(pnpmLock.importers)) {
        // To make an accurate tree and avoid infinite loop we need to use only
        // the top level deps of package we are building a tree for
        if (PackageName.includes(workspace)) {
          if (dep.dependencies != undefined) {
            for (const [depKeys, depValue] of Object.entries(
              dep.dependencies,
            )) {
              // If the package needs an other package it will look like
              // packages/packagesName: link../packageName
              // We delete the link and replace with the appropriate package deps
              if (depValue.includes('link:..')) {
                const linked = depValue.split('/')[1];
                const linkedPkgName = `packages/${linked}`;
                delete dep.dependencies[depKeys];
                dep.dependencies = {
                  ...dep.dependencies,
                  ...pnpmLock.importers[linkedPkgName].dependencies,
                };
              }
            }
          }

          // Same as above but for devDependencies
          if (dep.devDependencies != undefined) {
            for (const [depKeys, depValue] of Object.entries(
              dep.devDependencies,
            )) {
              if (depValue.includes('link:..')) {
                const linked = depValue.split('/')[1];
                const linkedPkgName = `packages/${linked}`;
                delete dep.devDependencies[depKeys];
                dep.devDependencies = {
                  ...dep.devDependencies,
                  ...pnpmLock.importers[linkedPkgName].devDependencies,
                };
              }
            }
          }

          // Getting the top level dependencies details
          const dependenciesIterator = Object.entries({
            ...dep.dependencies,
            ...(includeDev ? dep.devDependencies : null),
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

  return dependencies;
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
    throw new InvalidUserInputError(
      'package.json parsing failed with ' + `error ${e.message}`,
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
    throw new InvalidUserInputError(
      'package.json parsing failed with ' + `error ${e.message}`,
    );
  }
}
