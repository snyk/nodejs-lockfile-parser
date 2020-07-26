import { InvalidUserInputError } from '..';
import * as _isEmpty from 'lodash.isempty';
import { DepGraphBuilder, DepGraph } from '@snyk/dep-graph';
import { DepTreeDep, Dep } from '.';

export interface PackageLock {
  name: string;
  version: string;
  dependencies?: PackageLockDeps;
  lockfileVersion: number;
  type: LockfileType.npm;
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
}

export enum LockfileType {
  npm = 'npm',
  yarn = 'yarn',
  yarn2 = 'yarn2',
}

export interface ManifestFile {
  name: string;
  private?: string;
  engines?: {
    node?: string;
  };
  dependencies?: {
    [dep: string]: string;
  };
  devDependencies?: {
    [dep: string]: string;
  };
  version?: string;
}

export type Lockfile = PackageLock;

export interface PackageLock {
  name: string;
  version: string;
  dependencies?: PackageLockDeps;
  lockfileVersion: number;
  type: LockfileType.npm;
}

export interface LockfileParser {
  parseLockFile: (lockFileContents: string) => Lockfile;
  getDependencyGraph: (
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev?: boolean,
    strict?: boolean,
  ) => Promise<DepGraph>;
}

interface DepMap {
  [path: string]: DepMapItem;
}

interface DepMapItem extends DepTreeDep {
  requires: string[];
  isRoot: boolean;
}

export enum Scope {
  prod = 'prod',
  dev = 'dev',
}

export class PackageLockParser implements LockfileParser {
  // package names must not contain URI unsafe characters, so one of them is
  // a good delimiter (https://www.ietf.org/rfc/rfc1738.txt)
  private pathDelimiter = '|';

  public parseLockFile(lockFileContents: string): PackageLock {
    try {
      const packageLock: PackageLock = JSON.parse(lockFileContents);
      packageLock.type = LockfileType.npm;
      return packageLock;
    } catch (e) {
      throw new InvalidUserInputError(
        'package-lock.json parsing failed with ' + `error ${e.message}`,
      );
    }
  }

  public async getDependencyGraph(
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev = false,
    strict = true,
  ): Promise<DepGraph> {
    if (lockfile.type !== LockfileType.npm) {
      throw new InvalidUserInputError(
        'Unsupported lockfile provided. Please ' +
          'provide `package-lock.json`.',
      );
    }

    const packageLock = lockfile as PackageLock;

    const graph = new DepGraphBuilder(
      { name: 'npm' },
      { name: manifestFile.name, version: manifestFile.version },
    );

    // TODO @boost
    // const nodeVersion = manifestFile?.engines?.node;
    // if (nodeVersion) {
    //   _set(graph, 'meta.nodeVersion', nodeVersion);
    // }

    // returns empty dep-graph
    if (_isEmpty(manifestFile.dependencies) && !includeDev) {
      return graph.build();
    }

    // prepare a flat map, where dependency path is a key to dependency object
    // path is an unique identifier for each dependency and corresponds to the
    // relative path on disc
    const depMap: DepMap = this.flattenLockfile(packageLock);

    // get trees for dependencies from manifest file
    const topLevelDeps: string[] = this.getTopLevelDeps(
      manifestFile,
      includeDev,
    );

    // [
    //   '@thebespokepixel/es-tinycolor',
    //   '@thebespokepixel/meta',
    //   '@thebespokepixel/string',
    //   'color-convert',
    //   'common-tags',
    //   'deep-assign',
    //   'escape-string-regexp',
    //   'lodash',
    //   'read-pkg-up',
    //   'sgr-composer',
    //   'term-ng',
    //   'truwrap',
    //   'update-notifier',
    //   'verbosity',
    //   'yargs',
    // ];

    const childrenChain = new Map();
    const ancestorsChain = new Map();
    const alreadyVisited = new Set();

    const buildDepGraph = (
      graph,
      parent: string,
      dependencies,
      depMap: DepMap,
      alreadyVisited,
    ) => {
      for (const dep of dependencies) {
        const { name, version, requires } = depMap[dep];

        if (
          parent !== 'root-node' &&
          alreadyVisited.has(`${name}@${version}`)
        ) {
          continue;
        }

        const currentChildren = childrenChain.get(parent) || [];
        const currentAncestors = ancestorsChain.get(parent) || [];
        const isAncestorOrChild =
          currentChildren.includes(`${name}@${version}`) ||
          currentAncestors.includes(`${name}@${version}`);

        if (isAncestorOrChild) {
          continue;
        }

        graph.addPkgNode({ name, version }, `${name}@${version}`);
        graph.connectDep(parent, `${name}@${version}`);

        if (name && requires && requires.length > 0) {
          alreadyVisited.add(`${name}@${version}`);
          buildDepGraph(
            graph,
            `${name}@${version}`,
            requires,
            depMap,
            alreadyVisited,
          );
          childrenChain.set(parent, [...currentChildren, `${name}@${version}`]);
          ancestorsChain.set(`${name}@${version}`, [
            ...currentAncestors,
            parent,
          ]);
        }
      }
    };

    buildDepGraph(graph, 'root-node', topLevelDeps, depMap, alreadyVisited);

    return graph.build();
  }

  // prepare a flat map, where dependency path is a key to dependency object
  // path is an unique identifier for each dependency and corresponds to the
  // relative path on disc
  private flattenLockfile(lockfile: PackageLock): DepMap {
    const depMap: DepMap = {};

    const flattenLockfileRec = (lockfileDeps: PackageLockDeps, isRoot) => {
      for (const [depName, dep] of Object.entries(lockfileDeps)) {
        const depNode: DepMapItem = {
          labels: {
            scope: dep.dev ? Scope.dev : Scope.prod,
          },
          name: depName,
          requires: [],
          version: dep.version,
          isRoot,
        };

        if (dep.requires) {
          depNode.requires = Object.keys(dep.requires);
        }

        depMap[depName] = depNode;
        if (dep.dependencies) {
          flattenLockfileRec(dep.dependencies, false);
        }
      }
    };

    flattenLockfileRec(lockfile.dependencies || {}, true);

    return depMap;
  }

  private getTopLevelDeps(
    targetFile: ManifestFile,
    includeDev: boolean,
  ): string[] {
    const dependencies: string[] = [];

    const dependenciesIterator = Object.entries({
      ...targetFile.dependencies,
      ...(includeDev ? targetFile.devDependencies : null),
    });

    for (const [name] of dependenciesIterator) {
      dependencies.push(name);
    }

    return dependencies;
  }
}
