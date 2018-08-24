import 'source-map-support/register';
import * as fs from 'fs';
import * as path from 'path';
import {LockfileParser, Lockfile, ManifestFile, PkgTree,
  DepType, parseManifestFile} from './parsers';
import {PackageLockParser} from './parsers/package-lock-parser';
import {YarnLockParser} from './parsers/yarn-lock-parse';
import getRuntimeVersion from './get-node-runtime-version';

enum LockfileType {
  npm = 'npm',
  yarn = 'yarn',
}

export {
  buildDepTree,
  buildDepTreeFromFiles,
  PkgTree,
  DepType,
  LockfileType,
};

async function buildDepTree(
  manifestFileContents: string, lockFileContents: string,
  includeDev = false, lockfileType?: LockfileType): Promise<PkgTree> {

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
        const unsupportedRuntimeError = new Error();
        unsupportedRuntimeError.name = 'UnsupportedRuntimeError';
        // tslint:disable:max-line-length
        unsupportedRuntimeError.message = 'Parsing `yarn.lock` is not supported on Node.js version less than 6. Please upgrade your Node.js environment or use `package-lock.json`';
        throw unsupportedRuntimeError;
      }
      break;
    default:
      throw new Error(`Unsupported lockfile type ${lockfileType} provided.
        Only 'npm' or 'yarn' is currently supported.`);
  }

  const manifestFile: ManifestFile = parseManifestFile(manifestFileContents);
  if (!manifestFile.dependencies && !includeDev) {
    throw new Error("No 'dependencies' property in package.json");
  }
  const lockFile: Lockfile = lockfileParser.parseLockFile(lockFileContents);
  return lockfileParser.getDependencyTree(manifestFile, lockFile, includeDev);
}

async function buildDepTreeFromFiles(
  root: string, manifestFilePath: string, lockFilePath: string, includeDev = false): Promise<PkgTree> {
  if (!root || !manifestFilePath || !lockFilePath) {
    throw new Error('Missing required parameters for buildDepTreeFromFiles()');
  }

  let lockFileType: LockfileType;
  if (lockFilePath.endsWith('package-lock.json')) {
    lockFileType = LockfileType.npm;
  } else if (lockFilePath.endsWith('yarn.lock')) {
    lockFileType = LockfileType.yarn;
  } else {
    throw new Error(`Unknown lockfile ${lockFilePath}.
      Please provide either package-lock.json or yarn.lock.`);
  }

  const manifestFileFullPath = path.resolve(root, manifestFilePath);
  const lockFileFullPath = path.resolve(root, lockFilePath);

  if (!fs.existsSync(manifestFileFullPath)) {
    throw new Error(`Target file package.json not found at location: ${manifestFileFullPath}`);
  }
  if (!fs.existsSync(lockFileFullPath)) {
    throw new Error(`Lockfile not found at location: ${lockFileFullPath}`);
  }

  const manifestFileContents = fs.readFileSync(manifestFileFullPath, 'utf-8');
  const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');

  return await buildDepTree(manifestFileContents, lockFileContents, includeDev, lockFileType);
}
