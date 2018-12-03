import 'source-map-support/register';
import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import {LockfileParser, Lockfile, ManifestFile, PkgTree,
  DepType, parseManifestFile, LockfileType} from './parsers';
import {PackageLockParser} from './parsers/package-lock-parser';
import {YarnLockParser} from './parsers/yarn-lock-parse';
import getRuntimeVersion from './get-node-runtime-version';
import {UnsupportedRuntimeError, InvalidUserInputError, OutOfSyncError} from './errors';

export {
  buildDepTree,
  buildDepTreeFromFiles,
  PkgTree,
  DepType,
  LockfileType,
  UnsupportedRuntimeError,
  InvalidUserInputError,
  OutOfSyncError,
};

async function buildDepTree(
  manifestFileContents: string, lockFileContents: string,
  includeDev = false, lockfileType?: LockfileType,
  strict: boolean = true): Promise<PkgTree> {

  if (!lockfileType) {
    lockfileType = LockfileType.npm;
  }

  let lockfileParser: LockfileParser;
  switch (lockfileType) {
    case LockfileType.npm:
      lockfileParser = new PackageLockParser();
      break;
    case LockfileType.yarn:
      // parsing yarn.lock is supported for Node.js v6 and higher
      if (getRuntimeVersion() >= 6) {
        lockfileParser = new YarnLockParser();
      } else {
        throw new UnsupportedRuntimeError('Parsing `yarn.lock` is not ' +
          'supported on Node.js version less than 6. Please upgrade your ' +
          'Node.js environment or use `package-lock.json`');
      }
      break;
    default:
      throw new InvalidUserInputError('Unsupported lockfile type ' +
        `${lockfileType} provided. Only 'npm' or 'yarn' is currently ` +
        'supported.');
  }

  const manifestFile: ManifestFile = parseManifestFile(manifestFileContents);

  const lockFile: Lockfile = lockfileParser.parseLockFile(lockFileContents);
  return lockfileParser.getDependencyTree(manifestFile, lockFile, includeDev, strict);
}

async function buildDepTreeFromFiles(
  root: string, manifestFilePath: string, lockFilePath: string, includeDev = false,
  strict = true): Promise<PkgTree> {
  if (!root || !manifestFilePath || !lockFilePath) {
    throw new Error('Missing required parameters for buildDepTreeFromFiles()');
  }

  let lockFileType: LockfileType;
  if (_.endsWith(lockFilePath, 'package-lock.json')) {
    lockFileType = LockfileType.npm;
  } else if (_.endsWith(lockFilePath, 'yarn.lock')) {
    lockFileType = LockfileType.yarn;
  } else {
    throw new InvalidUserInputError(`Unknown lockfile ${lockFilePath}. ` +
      'Please provide either package-lock.json or yarn.lock.');
  }

  const manifestFileFullPath = path.resolve(root, manifestFilePath);
  const lockFileFullPath = path.resolve(root, lockFilePath);

  if (!fs.existsSync(manifestFileFullPath)) {
    throw new InvalidUserInputError('Target file package.json not found at ' +
      `location: ${manifestFileFullPath}`);
  }
  if (!fs.existsSync(lockFileFullPath)) {
    throw new InvalidUserInputError('Lockfile not found at location: ' +
      lockFileFullPath);
  }

  const manifestFileContents = fs.readFileSync(manifestFileFullPath, 'utf-8');
  const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');

  return await buildDepTree(manifestFileContents, lockFileContents, includeDev,
    lockFileType, strict);
}
