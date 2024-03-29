import { load, FAILSAFE_SCHEMA } from 'js-yaml';

import { LockParserBase, DepMap } from './lock-parser-base';
import {
  Dep,
  Lockfile,
  LockfileType,
  ManifestDependencies,
  ManifestFile,
  PkgTree,
  Scope,
} from '.';
import { config } from '../config';
import { InvalidUserInputError } from '../errors';

export interface PnpmLock {
  type: string;
  object: PnpmLockDeps;
  dependencies?: PnpmLockDeps;
  lockfileType: LockfileType.pnpm;
}

export interface PnpmLockDeps {
  [depName: string]: PnpmLockDep;
}

export interface PnpmLockDep {
  version: string;
  dependencies?: {
    [depName: string]: string;
  };
  optionalDependencies?: {
    [depName: string]: string;
  };
}

export interface PnpmLock {
  type: string;
  object: PnpmLockDeps;
  dependencies?: PnpmLockDeps;
  lockfileType: LockfileType.pnpm;
}

export class PnpmLockParser extends LockParserBase {
  constructor() {
    super(LockfileType.pnpm, config.PNPM_TREE_SIZE_LIMIT);
  }

  public parseLockFile(lockFileContents: string): Lockfile {
    try {
      const rawPnpmLock: any = load(lockFileContents, {
        json: true,
        schema: FAILSAFE_SCHEMA,
      });

      const dependencies: PnpmLockDeps = {};

      Object.entries(rawPnpmLock.packages).forEach(
        ([fullDescriptor]: [string, any]) => {
          const [name, version] = parseDepPath(fullDescriptor);
          dependencies[name] = {
            version,
          };
        },
      );

      return {
        dependencies,
        lockfileType: LockfileType.pnpm,
        object: dependencies,
        type: LockfileType.pnpm,
      };
    } catch (e) {
      throw new InvalidUserInputError(
        `Pnpm.lock parsing failed with an error: ${(e as Error).message}`,
      );
    }
  }

  public async getDependencyTree(
    manifestFile: ManifestFile,
    lockfile: Lockfile,
    includeDev = false,
    strictOutOfSync = true,
  ): Promise<PkgTree> {
    if (lockfile.type !== this.type) {
      throw new InvalidUserInputError(
        'Unsupported lockfile provided. Please ' + 'provide `pnpm-lock.yaml`.',
      );
    }

    //
    const depTree = await super.getDependencyTree(
      manifestFile,
      lockfile,
      includeDev,
      // forcefully disable sync checks
      false,
    );

    return depTree;
  }

  protected getDepMap(
    lockfile: Lockfile,
    resolutions?: ManifestDependencies,
  ): DepMap {
    const PnpmLockfile = lockfile as PnpmLock;
    const depMap: DepMap = {};

    const dependencies = (lockfile.dependencies as PnpmLockDeps) || {};

    for (const [depName, dep] of Object.entries(PnpmLockfile.object)) {
      const subDependencies = Object.entries({
        ...(dep.dependencies || {}),
        ...(dep.optionalDependencies || {}),
      }).map(
        ([key, ver]) =>
          findResolutions(dependencies, depName, key, resolutions) ||
          `${key}@${ver}`,
      );

      depMap[depName] = {
        labels: {
          scope: Scope.prod,
        },
        name: getName(depName),
        requires: subDependencies,
        version: dep.version,
      };
    }

    return depMap;
  }

  protected getDepTreeKey(dep: Dep): string {
    return `${dep.name}@${dep.version}`;
  }
}

function getName(depName: string) {
  return depName.slice(0, depName.indexOf('@', 1));
}

function findResolutions(
  dependencies: PnpmLockDeps,
  depName: string,
  subDepKey: string,
  resolutions?: ManifestDependencies,
): string | undefined {
  if (!resolutions) return;

  const resolutionKeys = Object.keys(resolutions);

  const index = depName.indexOf('@', 1);
  const name = depName.slice(0, index);
  const version = depName.slice(index + 1);

  const firstMatchingResolution = resolutionKeys.find((res) => {
    if (!res.endsWith(subDepKey)) {
      return false;
    }

    const leadingPkg = res.split(subDepKey)[0].slice(0, -1);

    const noSpecifiedParent = !leadingPkg;
    const specifiedParentMatchesCurrentDep = leadingPkg === name;
    const specifiedParentWithVersionMatches =
      leadingPkg.includes(name) &&
      leadingPkg.includes(dependencies[`${name}@${version}`].version);

    return (
      noSpecifiedParent ||
      specifiedParentMatchesCurrentDep ||
      specifiedParentWithVersionMatches
    );
  });

  if (resolutionKeys && firstMatchingResolution) {
    return `${subDepKey}@${resolutions[firstMatchingResolution]}`;
  }
}

/**
 *
 * @param depPath
 * @param versionSep
 * @returns
 */
function parseDepPath(
  depPath: string,
  versionSep: string = '@',
): [string, string] {
  // Skip registry
  // e.g.
  //    - "registry.npmjs.org/lodash/4.17.10" => "lodash/4.17.10"
  //    - "registry.npmjs.org/@babel/generator/7.21.9" => "@babel/generator/7.21.9"
  //    - "/lodash/4.17.10" => "lodash/4.17.10"
  depPath = depPath.substring(depPath.indexOf('/') + 1);

  // Parse scope
  // e.g.
  //    - v5:  "@babel/generator/7.21.9" => {"babel", "generator/7.21.9"}
  //    - v6+: "@babel/helper-annotate-as-pure@7.18.6" => "{"babel", "helper-annotate-as-pure@7.18.6"}
  let scope = '';
  if (depPath.startsWith('@')) {
    const scopeEndIndex = depPath.indexOf('/');
    scope = depPath.substring(0, scopeEndIndex);
    depPath = depPath.substring(scopeEndIndex + 1);
  }

  // Parse package name
  // e.g.
  //    - v5:  "generator/7.21.9" => {"generator", "7.21.9"}
  //    - v6+: "helper-annotate-as-pure@7.18.6" => {"helper-annotate-as-pure", "7.18.6"}
  let [name, version] = depPath.split(versionSep);
  if (scope) {
    name = `${scope}/${name}`;
  }

  // Trim peer deps
  // e.g.
  //    - v5:  "7.21.5_@babel+core@7.21.8" => "7.21.5"
  //    - v6+: "7.21.5(@babel/core@7.20.7)" => "7.21.5"
  const idx = version.search(/[_(]/);
  if (idx !== -1) {
    version = version.substring(0, idx);
  }

  return [name, version];
}
