import {
  Dep,
  Lockfile,
  LockfileType,
  ManifestDependencies,
  ManifestFile,
  PkgTree,
  Scope,
} from './index';
import { DepMap, DepMapItem, LockParserBase } from './lock-parser-base';
import { config } from '../config';
import { parseJsonFile } from '../utils';
import { getComponentMetadataLabels } from '../component-metadata-labels';

export interface PackageLock {
  name: string;
  version: string;
  dependencies?: PackageLockDeps;
  lockfileVersion: 1 | 2;
  type: LockfileType.npm | LockfileType.npm7;
}

export interface PackageLockDeps {
  [depName: string]: PackageLockDep;
}

export interface PackageLockDep {
  version: string;
  requires?: {
    [depName: string]: string;
  };
  dependencies?: PackageLockDeps;
  dev?: boolean;
  integrity?: string;
  resolved?: string;
}

export class PackageLockParser extends LockParserBase {
  constructor() {
    super(LockfileType.npm, config.NPM_TREE_SIZE_LIMIT);
  }

  public parseLockFile(lockFileContents: string): PackageLock {
    const packageLock: PackageLock = parseJsonFile<PackageLock>(
      lockFileContents,
      'package-lock.json',
    );
    packageLock.type =
      packageLock.lockfileVersion === 1 ? LockfileType.npm : LockfileType.npm7;
    this.type = packageLock.type;
    return packageLock;
  }

  public async getDependencyTree(
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev: boolean = false,
    strictOutOfSync: boolean = true,
    showNpmScope?: boolean,
    includeComponentMetadata?: boolean,
  ): Promise<PkgTree> {
    const dependencyTree = await super.getDependencyTree(
      manifestFile,
      lockfile,
      includeDev,
      strictOutOfSync,
      showNpmScope,
      includeComponentMetadata,
    );
    const meta = {
      lockfileVersion: (lockfile as PackageLock).lockfileVersion,
      packageManager: 'npm',
    };
    const depTreeWithMeta = {
      ...dependencyTree,
      meta: { ...dependencyTree.meta, ...meta },
    };
    return depTreeWithMeta;
  }

  protected getDepMap(
    lockfile: Lockfile,
    resolutions?: ManifestDependencies,
    showNpmScope?: boolean,
    includeComponentMetadata?: boolean,
  ): DepMap {
    const packageLock = lockfile as PackageLock;
    const depMap: DepMap = {};

    const flattenLockfileRec = (
      lockfileDeps: PackageLockDeps,
      path: string[],
    ) => {
      for (const [depName, dep] of Object.entries(lockfileDeps)) {
        const depNode: DepMapItem = {
          labels: {
            scope: dep.dev ? Scope.dev : Scope.prod,
            ...(showNpmScope && {
              'npm:scope': dep.dev ? Scope.dev : Scope.prod,
            }),
            ...(includeComponentMetadata &&
              getComponentMetadataLabels({
                id: `${depName}@${dep.version}`,
                integrity: dep.integrity,
                resolved: dep.resolved,
              })),
          },
          name: depName,
          requires: [],
          version: dep.version,
        };

        if (dep.requires) {
          depNode.requires = Object.keys(dep.requires);
        }

        const depPath: string[] = [...path, depName];
        const depKey = depPath.join(this.pathDelimiter);
        depMap[depKey] = depNode;
        if (dep.dependencies) {
          flattenLockfileRec(dep.dependencies, depPath);
        }
      }
    };

    flattenLockfileRec(packageLock.dependencies || {}, []);

    return depMap;
  }

  protected getDepTreeKey(dep: Dep): string {
    return dep.name;
  }
}
