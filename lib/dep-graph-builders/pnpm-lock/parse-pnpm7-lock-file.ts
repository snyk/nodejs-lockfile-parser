import { load, FAILSAFE_SCHEMA } from 'js-yaml';
import {
  LockfileResolution,
  LockfileSettings,
  PackageSnapshot,
  PackageSnapshots,
  PatchFile,
  ProjectSnapshot,
} from '@pnpm/lockfile-types';
import * as semver from 'semver';

export const ROOT_PACKAGE_NAME = '.';

export type PackageInfo = Pick<
  PackageSnapshot,
  | 'id'
  | 'patched'
  | 'hasBin'
  | 'name'
  | 'version'
  | 'resolution'
  | 'peerDependencies'
  | 'peerDependenciesMeta'
  | 'bundledDependencies'
  | 'engines'
  | 'cpu'
  | 'os'
  | 'libc'
  | 'deprecated'
>;

export type PackageSnapshotV7 = Pick<
  PackageSnapshot,
  | 'dev'
  | 'optional'
  | 'dependencies'
  | 'optionalDependencies'
  | 'transitivePeerDependencies'
>;

export interface InlineSpecifiersResolvedDependencies {
  [depName: string]: SpecifierAndResolution;
}

export interface SpecifierAndResolution {
  specifier: string;
  version: string;
}

export interface LockfileV7 {
  importers: Record<string, ProjectSnapshot>;
  lockfileVersion: number | string;
  time?: Record<string, string>;
  snapshots?: Record<string, PackageSnapshotV7>;
  packages?: Record<string, PackageInfo>;
  neverBuiltDependencies?: string[];
  onlyBuiltDependencies?: string[];
  overrides?: Record<string, string>;
  packageExtensionsChecksum?: string;
  patchedDependencies?: Record<string, PatchFile>;
  settings?: LockfileSettings;
}

function parsePkgSnapshot(
  packageSpecifier: { name: string; version: string },
  entry: any,
): PackageSnapshot {
  return {
    name: packageSpecifier.name,
    version: packageSpecifier.version,
    resolution: parseResolution(entry.resolution),
    dependencies: entry.dependencies || {},
    peerDependencies: entry.peerDependencies || {},
    optionalDependencies: entry.optionalDependencies || {},
    hasBin: entry.hasBin,
    optional: entry.optional,
    engines: entry.engines,
  };
}

function parsePkgImporter(entry: any): ProjectSnapshot {
  return {
    specifiers: entry.specifiers || {},
    dependencies: entry.dependencies || {},
    optionalDependencies: entry.optionalDependencies || {},
    devDependencies: entry.devDependencies || {},
    dependenciesMeta: entry.dependenciesMeta || {},
    publishDirectory: entry.publishDirectory,
  };
}

function parseResolution(entry: any): LockfileResolution {
  return {
    integrity: entry.integrity,
    tarball: entry.tarball,
    directory: entry.directory,
    repo: entry.repo,
    commit: entry.commit,
  };
}

function parseSnapshot(entry: any): PackageSnapshotV7 {
  return {
    dependencies: entry.dependencies || {},
  };
}

export const parsePnpm7lockfile = (pnpmLockContent: string): LockfileV7 => {
  const rawPnpmLock: any = load(pnpmLockContent, {
    json: true,
    schema: FAILSAFE_SCHEMA,
  });

  const { lockfileVersion, settings = {}, ...lockfileContents } = rawPnpmLock;

  const packageSnapshots: Record<string, PackageSnapshotV7> = {};
  if (typeof lockfileContents.snapshots !== 'undefined') {
    Object.keys(lockfileContents.snapshots).forEach((snapshotId) => {
      const pkgSnapshot = lockfileContents.snapshots[snapshotId];
      packageSnapshots[snapshotId] = parseSnapshot(pkgSnapshot);
    });
  }

  const packages: PackageSnapshots = {};
  if (typeof lockfileContents.packages !== 'undefined') {
    Object.keys(lockfileContents.packages).forEach((packageId) => {
      const pkgInfo = lockfileContents.packages[packageId];
      const packageSpecifier = parsePackageId(packageId);
      if (packageSpecifier.name && packageSpecifier.version) {
        packages[packageId] = parsePkgSnapshot(packageSpecifier, pkgInfo);
      }
    });
  }

  const importers: Record<string, ProjectSnapshot> = {};
  if (typeof lockfileContents.importers !== 'undefined') {
    Object.keys(lockfileContents.importers).forEach((importerId) => {
      const pkgImport = lockfileContents.importers[importerId];
      importers[importerId] = parsePkgImporter(pkgImport);
    });
  }

  const lockfile: LockfileV7 = {
    lockfileVersion,
    settings,
    importers,
    packages: packages,
    snapshots: packageSnapshots,
  };

  return lockfile;
};

function parsePackageId(dependencyPath: string) {
  const sepIndex = dependencyPath.indexOf('@', 1);
  if (sepIndex === -1) {
    return {};
  }

  const name = dependencyPath.substring(0, sepIndex);
  let version = dependencyPath.substring(sepIndex + 1);
  if (version) {
    let peerSepIndex!: number;
    let peersSuffix: string | undefined;
    if (version.includes('(') && version.endsWith(')')) {
      peerSepIndex = version.indexOf('(');
      if (peerSepIndex !== -1) {
        peersSuffix = version.substring(peerSepIndex);
        version = version.substring(0, peerSepIndex);
      }
    }
    if (semver.valid(version)) {
      return {
        name,
        peersSuffix,
        version,
      };
    }
    return {
      name,
      nonSemverVersion: version,
      peersSuffix,
    };
  }
  return {};
}
