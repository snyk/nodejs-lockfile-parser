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
} from './parsers';
import { PackageLockParser } from './parsers/package-lock-parser';
import { YarnLockParser } from './parsers/yarn-lock-parser';
import { Yarn2LockParser } from './parsers/yarn2-lock-parser';
import {
  UnsupportedRuntimeError,
  InvalidUserInputError,
  OutOfSyncError,
} from './errors';
import { buildDepGraphFromCliOutput } from './cli-parsers';

export {
  buildDepTree,
  buildDepTreeFromFiles,
  buildDepGraphFromCliOutput,
  getYarnWorkspacesFromFiles,
  getYarnWorkspaces,
  PkgTree,
  Scope,
  LockfileType,
  UnsupportedRuntimeError,
  InvalidUserInputError,
  OutOfSyncError,
  ManifestFile,
};

// Straight to Depgraph Functionality *************
// ************************************************
import {
  parseNpmLockV2Project,
  extractPkgsFromYarnLockV1,
  parseYarnLockV1Project,
  parseYarnLockV1WorkspaceProject,
  buildDepGraphYarnLockV1SimpleCyclesPruned,
  buildDepGraphYarnLockV1Simple,
  buildDepGraphYarnLockV1WorkspaceCyclesPruned,
  buildDepGraphYarnLockV1Workspace,
  extractPkgsFromYarnLockV2,
  parseYarnLockV2Project,
  buildDepGraphYarnLockV2Simple,
} from './dep-graph-builders';
import type {
  PackageJsonBase,
  NormalisedPkgs,
  ProjectParseOptions,
  YarnLockV2ProjectParseOptions,
} from './dep-graph-builders/types';
import {
  getLockfileVersionFromFile,
  getNpmLockfileVersion,
  getYarnLockfileVersion,
  NodeLockfileVersion,
} from './utils';
export {
  parseNpmLockV2Project,
  extractPkgsFromYarnLockV1,
  parseYarnLockV1Project,
  parseYarnLockV1WorkspaceProject,
  buildDepGraphYarnLockV1SimpleCyclesPruned,
  buildDepGraphYarnLockV1Simple,
  buildDepGraphYarnLockV1WorkspaceCyclesPruned,
  buildDepGraphYarnLockV1Workspace,
  extractPkgsFromYarnLockV2,
  parseYarnLockV2Project,
  buildDepGraphYarnLockV2Simple,
  PackageJsonBase,
  ProjectParseOptions,
  YarnLockV2ProjectParseOptions,
  NormalisedPkgs,
  NormalisedPkgs as YarnLockPackages,
  getLockfileVersionFromFile,
  getNpmLockfileVersion,
  getYarnLockfileVersion,
  NodeLockfileVersion,
};
// **********************************

async function buildDepTree(
  manifestFileContents: string,
  lockFileContents: string,
  includeDev = false,
  lockfileType?: LockfileType,
  strictOutOfSync: boolean = true,
  defaultManifestFileName: string = 'package.json',
): Promise<PkgTree> {
  if (!lockfileType || lockfileType === LockfileType.npm) {
    lockfileType = getNpmLockfileType(lockFileContents);
  } else if (lockfileType === LockfileType.yarn) {
    lockfileType = getYarnLockfileType(lockFileContents);
  }

  let lockfileParser: LockfileParser;
  switch (lockfileType) {
    case LockfileType.npm:
    case LockfileType.npm7:
    case LockfileType.npm7v3:
      lockfileParser = new PackageLockParser();
      break;
    case LockfileType.yarn:
      lockfileParser = new YarnLockParser();
      break;
    case LockfileType.yarn2:
      lockfileParser = new Yarn2LockParser();
      break;
    default:
      throw new InvalidUserInputError(
        'Unsupported lockfile type ' +
          `${lockfileType} provided. Only 'npm' or 'yarn' is currently ` +
          'supported.',
      );
  }

  const manifestFile: ManifestFile = parseManifestFile(manifestFileContents);
  if (!manifestFile.name) {
    manifestFile.name = path.isAbsolute(defaultManifestFileName)
      ? path.basename(defaultManifestFileName)
      : defaultManifestFileName;
  }

  const lockFile: Lockfile = lockfileParser.parseLockFile(lockFileContents);
  return lockfileParser.getDependencyTree(
    manifestFile,
    lockFile,
    includeDev,
    strictOutOfSync,
  );
}

async function buildDepTreeFromFiles(
  root: string,
  manifestFilePath: string,
  lockFilePath: string,
  includeDev = false,
  strictOutOfSync = true,
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
  } else {
    throw new InvalidUserInputError(
      `Unknown lockfile ${lockFilePath}. ` +
        'Please provide either package-lock.json or yarn.lock.',
    );
  }

  return await buildDepTree(
    manifestFileContents,
    lockFileContents,
    includeDev,
    lockFileType,
    strictOutOfSync,
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

export function getYarnLockfileType(
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

export function getNpmLockfileType(
  lockFileContents: string,
): LockfileType {
  const lockfileVersion = Number(
    // fast path
    (lockFileContents.slice(0, 200).match(/"lockfileVersion":\s*([0-9]+),/) || [])[1] ||
    // slow path
    JSON.parse(lockFileContents).lockfileVersion
  )
  if (lockfileVersion == 1) {
    return LockfileType.npm;
  } else if (lockfileVersion == 2) {
    return LockfileType.npm7;
  } else if (lockfileVersion == 3) {
    return LockfileType.npm7v3;
  } else {
    throw new Error('Unknown lockfile type');
  }
}
