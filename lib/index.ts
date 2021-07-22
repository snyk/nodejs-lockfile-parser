import * as fs from 'fs';
import * as path from 'path';
import {
  LockfileParser,
  Lockfile,
  ManifestFile,
  PkgTree,
  Scope,
  parseManifestFile,
  LockfileType,
  getYarnWorkspaces,
  getPnpmWorkspaces,
} from './parsers';
import { PackageLockParser } from './parsers/package-lock-parser';
import { YarnLockParser } from './parsers/yarn-lock-parser';
import { Yarn2LockParser } from './parsers/yarn2-lock-parser';
import { PnpmPackageLockParser } from './parsers/pnpm-lock-parser';
import {
  UnsupportedRuntimeError,
  InvalidUserInputError,
  OutOfSyncError,
} from './errors';

export {
  buildDepTree,
  buildDepTreeFromFiles,
  getYarnWorkspacesFromFiles,
  getYarnWorkspaces,
  getPnpmWorkspacesFromFiles,
  getPnpmWorkspaces,
  PkgTree,
  Scope,
  LockfileType,
  UnsupportedRuntimeError,
  InvalidUserInputError,
  OutOfSyncError,
  ManifestFile,
};

async function buildDepTree(
  manifestFileContents: string,
  lockFileContents: string,
  includeDev = false,
  lockfileType?: LockfileType,
  strict: boolean = true,
  defaultManifestFileName: string = 'package.json',
): Promise<PkgTree> {
  if (!lockfileType) {
    lockfileType = LockfileType.npm;
  } else if (lockfileType === LockfileType.yarn) {
    lockfileType = getYarnLockfileType(lockFileContents);
  } else if (lockfileType === LockfileType.pnpm) {
    lockfileType = LockfileType.pnpm;
  }

  let lockfileParser: LockfileParser;
  switch (lockfileType) {
    case LockfileType.npm:
      lockfileParser = new PackageLockParser();
      break;
    case LockfileType.yarn:
      lockfileParser = new YarnLockParser();
      break;
    case LockfileType.yarn2:
      lockfileParser = new Yarn2LockParser();
      break;
    case LockfileType.pnpm:
      lockfileParser = new PnpmPackageLockParser();
      break;
    default:
      throw new InvalidUserInputError(
        'Unsupported lockfile type ' +
          `${lockfileType} provided. Only 'npm', 'yarn' or 'pnpm' is currently ` +
          'supported.',
      );
  }

  const manifestFile: ManifestFile = parseManifestFile(manifestFileContents);
  if (!manifestFile.name) {
    manifestFile.name = path.isAbsolute(defaultManifestFileName)
      ? path.basename(defaultManifestFileName)
      : defaultManifestFileName;
  }

  const lockFile: Lockfile = await lockfileParser.parseLockFile(
    lockFileContents,
  );
  return lockfileParser.getDependencyTree(
    manifestFile,
    lockFile,
    includeDev,
    strict,
  );
}

async function buildDepTreeFromFiles(
  root: string,
  manifestFilePath: string,
  lockFilePath: string,
  includeDev = false,
  strict = true,
): Promise<PkgTree> {
  if (!root || !manifestFilePath || !lockFilePath) {
    throw new Error('Missing required parameters for buildDepTreeFromFiles()');
  }

  const manifestFileFullPath = path.resolve(root, manifestFilePath);
  const lockFileFullPath = path.resolve(root, lockFilePath);

  if (!fs.existsSync(manifestFileFullPath)) {
    throw new InvalidUserInputError(
      'Target file package.json not found at ' +
        `location: ${manifestFileFullPath}`,
    );
  }
  if (!fs.existsSync(lockFileFullPath)) {
    throw new InvalidUserInputError(
      'Lockfile not found at location: ' + lockFileFullPath,
    );
  }

  const manifestFileContents = fs.readFileSync(manifestFileFullPath, 'utf-8');
  const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');

  let lockFileType: LockfileType;
  if (lockFilePath.endsWith('package-lock.json')) {
    lockFileType = LockfileType.npm;
  } else if (lockFilePath.endsWith('yarn.lock')) {
    lockFileType = getYarnLockfileType(lockFileContents, root, lockFilePath);
  } else if (lockFilePath.endsWith('pnpm-lock.yaml')) {
    lockFileType = LockfileType.pnpm;
  } else {
    throw new InvalidUserInputError(
      `Unknown lockfile ${lockFilePath}. ` +
        'Please provide either package-lock.json, yarn.lock or pnpm-lock.yaml.',
    );
  }

  return await buildDepTree(
    manifestFileContents,
    lockFileContents,
    includeDev,
    lockFileType,
    strict,
    manifestFilePath,
  );
}

function getYarnWorkspacesFromFiles(
  root,
  manifestFilePath: string,
): string[] | false {
  if (!root || !manifestFilePath) {
    throw new Error(
      'Missing required parameters for getYarnWorkspacesFromFiles()',
    );
  }
  const manifestFileFullPath = path.resolve(root, manifestFilePath);
  if (!fs.existsSync(manifestFileFullPath)) {
    throw new InvalidUserInputError(
      'Target file package.json not found at ' +
        `location: ${manifestFileFullPath}`,
    );
  }
  const manifestFileContents = fs.readFileSync(manifestFileFullPath, 'utf-8');

  return getYarnWorkspaces(manifestFileContents);
}

function getPnpmWorkspacesFromFiles(
  root,
  pnpmWorkspaceFilePath: string,
): string[] | false {
  if (!root || !pnpmWorkspaceFilePath) {
    throw new Error(
      'Missing required parameters for getPnpmWorkspacesFromFiles()',
    );
  }
  const pnpmWorksapceFileFullPath = path.resolve(root, pnpmWorkspaceFilePath);

  if (!fs.existsSync(pnpmWorksapceFileFullPath)) {
    throw new InvalidUserInputError(
      `Target file not found at : ${pnpmWorksapceFileFullPath}`,
    );
  }
  const pnpmWorkspaceFileContents = fs.readFileSync(
    pnpmWorksapceFileFullPath,
    'utf-8',
  );

  return getPnpmWorkspaces(pnpmWorkspaceFileContents);
}

function getYarnLockfileType(
  lockFileContents: string,
  root?: string,
  lockFilePath?: string,
): LockfileType {
  if (
    lockFileContents.includes('__metadata') ||
    (root &&
      lockFilePath &&
      fs.existsSync(
        path.resolve(root, lockFilePath.replace('yarn.lock', '.yarnrc.yml')),
      ))
  ) {
    return LockfileType.yarn2;
  } else {
    return LockfileType.yarn;
  }
}
