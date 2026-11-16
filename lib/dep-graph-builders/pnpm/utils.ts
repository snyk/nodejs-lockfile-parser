import * as path from 'path';
import * as fs from 'fs';
import { LockfileType } from '../..';
import * as semver from 'semver';
import { getGraphDependencies, getUnsatisfiedDeclaredRange } from '../util';
import type { PackageJsonBase } from '../types';
import { PnpmLockfileParser } from './lockfile-parser/lockfile-parser';
import { NormalisedPnpmPkgs, PnpmNode } from './types';
import { OpenSourceEcosystems } from '@snyk/error-catalog-nodejs-public';
import {
  INSTALL_COMMAND,
  LOCK_FILE_NAME,
} from '../../errors/out-of-sync-error';
import * as debugModule from 'debug';
import { UNDEFINED_VERSION } from './constants';

const debug = debugModule('snyk-pnpm-workspaces');
export const getPnpmChildNode = (
  name: string,
  depInfo: { version: string; isDev: boolean },
  pkgs: NormalisedPnpmPkgs,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
  includeDevDeps: boolean,
  lockfileParser: PnpmLockfileParser,
): PnpmNode => {
  const resolvedVersion = lockfileParser.excludeTransPeerDepsVersions(
    depInfo.version,
  );
  let childNodeKey = `${name}@${resolvedVersion}`;
  // For aliases, the version is the dependency path that
  // shows up in the packages section of lockfiles
  if (lockfileParser.resolvedPackages[resolvedVersion]) {
    childNodeKey = lockfileParser.resolvedPackages[resolvedVersion];
  }
  if (lockfileParser.resolvedPackages[childNodeKey]) {
    childNodeKey = lockfileParser.resolvedPackages[childNodeKey];
  }
  if (!pkgs[childNodeKey]) {
    if (strictOutOfSync && !/^file:/.test(depInfo.version)) {
      const errMessage =
        `Dependency ${childNodeKey} was not found in ` +
        `${LOCK_FILE_NAME[LockfileType.pnpm]}. Your package.json and ` +
        `${
          LOCK_FILE_NAME[LockfileType.pnpm]
        } are probably out of sync. Please run ` +
        `"${INSTALL_COMMAND[LockfileType.pnpm]}" and try again.`;
      debug(errMessage);
      throw new OpenSourceEcosystems.PnpmOutOfSyncError(errMessage);
    } else {
      return {
        id: childNodeKey,
        name: name,
        version: resolvedVersion || UNDEFINED_VERSION,
        dependencies: {},
        isDev: depInfo.isDev,
        missingLockFileEntry: true,
      };
    }
  } else {
    const depData = pkgs[childNodeKey];
    const dependencies = getGraphDependencies(depData.dependencies || {}, {
      isDev: depInfo.isDev,
    });
    const devDependencies = includeDevDeps
      ? getGraphDependencies(depData.devDependencies || {}, { isDev: true })
      : {};
    const optionalDependencies = includeOptionalDeps
      ? getGraphDependencies(depData.optionalDependencies || {}, {
          isDev: depInfo.isDev,
          isOptional: true,
        })
      : {};
    return {
      id: `${depData.name}@${depData.version}`,
      name: depData.name,
      version: depData.version || UNDEFINED_VERSION,
      dependencies: {
        ...dependencies,
        ...optionalDependencies,
        ...devDependencies,
      },
      isDev: depInfo.isDev,
    };
  }
};

export function getFileContents(
  root: string,
  fileName: string,
): {
  content: string;
  fileName: string;
} {
  const fullPath = path.resolve(root, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      'Manifest ' + fileName + ' not found at location: ' + fileName,
    );
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  return {
    content,
    fileName,
  };
}

const IMPORTER_SECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
];

/**
 * The version string recorded for a direct dependency in the lockfile's importer
 * (v5: a plain string, v6+: `{ specifier, version }`), untouched by any
 * normalisation (workspace link resolution, alias lookups, peer suffix removal).
 */
const getRawImporterVersion = (
  rawPnpmLock: any,
  importer: string | undefined,
  name: string,
): string | undefined => {
  const root = importer ? rawPnpmLock?.importers?.[importer] : rawPnpmLock;
  for (const section of IMPORTER_SECTIONS) {
    const entry = root?.[section]?.[name];
    const version = typeof entry === 'string' ? entry : entry?.version;
    if (typeof version === 'string') {
      return version;
    }
  }
  return undefined;
};

// `foo`, `foo@^1`, `parent>foo`, `parent@1>foo@^2`, `@scope/foo@1` -> `foo`/`@scope/foo`
const overrideKeyTargetsName = (key: string, name: string): boolean => {
  const target = key.split('>').pop() as string;
  const at = target.indexOf('@', 1);
  return (at === -1 ? target : target.slice(0, at)) === name;
};

const isOverridden = (
  name: string,
  pkgJson: PackageJsonBase,
  rawPnpmLock: any,
): boolean => {
  const sources = [
    pkgJson.pnpm?.overrides,
    pkgJson.overrides,
    pkgJson.resolutions,
    // overrides configured outside package.json (e.g. pnpm-workspace.yaml)
    // are recorded in the lockfile
    rawPnpmLock?.overrides,
  ];
  return sources.some(
    (overrides) =>
      overrides &&
      typeof overrides === 'object' &&
      Object.keys(overrides).some((key) => overrideKeyTargetsName(key, name)),
  );
};

/**
 * Returns the range declared in package.json for a direct dependency when the
 * version pnpm locked for it demonstrably does not satisfy that range.
 *
 * Conservative: nothing is reported for peer-only or ambiguously declared
 * dependencies, overridden packages, or when the importer's locked version is
 * not itself a plain registry semver (links, workspace packages, file:, git,
 * tarball and npm: alias resolutions). Non-semver declared ranges are skipped
 * by getUnsatisfiedDeclaredRange.
 */
export const getPnpmUnsatisfiedDeclaredRange = (
  name: string,
  pkgJson: PackageJsonBase,
  rawPnpmLock: any,
  importer?: string,
): string | undefined => {
  const declared = new Set(
    [
      pkgJson.dependencies?.[name],
      pkgJson.devDependencies?.[name],
      pkgJson.optionalDependencies?.[name],
    ].filter((range): range is string => typeof range === 'string'),
  );
  if (declared.size !== 1 || isOverridden(name, pkgJson, rawPnpmLock)) {
    return undefined;
  }
  const raw = getRawImporterVersion(rawPnpmLock, importer, name);
  if (!raw) {
    return undefined;
  }
  // drop transitive peer suffixes: v5 `1.0.0_react@18`, v6+ `1.0.0(react@18)`
  const lockedVersion = raw.split('(')[0].split('_')[0];
  if (!semver.valid(lockedVersion)) {
    return undefined;
  }
  return getUnsatisfiedDeclaredRange([...declared][0], lockedVersion);
};
