import * as path from 'path';
import * as fs from 'fs';
import { LockfileType } from '../..';
import { getGraphDependencies } from '../util';
import { PnpmLockfileParser } from './lockfile-parser/lockfile-parser';
import { NormalisedPnpmPkgs, PnpmNode } from './types';
import { valid } from 'semver';
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
  let resolvedVersion =
    valid(depInfo.version) || depInfo.version === undefined
      ? depInfo.version
      : lockfileParser.excludeTransPeerDepsVersions(depInfo.version);
  let childNodeKey = `${name}@${resolvedVersion}`;
  // For aliases, the version is the dependency path that
  // shows up in the packages section of lockfiles
  if (lockfileParser.resolvedPackages[depInfo.version]) {
    childNodeKey = lockfileParser.resolvedPackages[depInfo.version];
    const pkgData = pkgs[childNodeKey];
    name = pkgData.name;
    resolvedVersion = pkgData.version;
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
    const dependencies = getGraphDependencies(
      depData.dependencies || {},
      depInfo.isDev,
    );
    const devDependencies = includeDevDeps
      ? getGraphDependencies(depData.devDependencies || {}, true)
      : {};
    const optionalDependencies = includeOptionalDeps
      ? getGraphDependencies(depData.optionalDependencies || {}, depInfo.isDev)
      : {};
    return {
      id: `${name}@${depData.version}`,
      name: name,
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
