import * as path from 'path';
import * as fs from 'fs';
import { InvalidUserInputError, UnsupportedError } from './errors';
import {
  Lockfile,
  LockfileParser,
  LockfileType,
  ManifestFile,
  parseManifestFile,
} from './parsers';
import { PackageLockParser } from './parsers/package-lock-parser';
import { YarnLockParser } from './parsers/yarn-lock-parse';

export function parseManifestAndLock(
  manifestFileContents: string,
  lockFileContents: string,
  lockfileParser: LockfileParser,
  defaultManifestFileName: string = 'package.json',
): {
  manifestFile: ManifestFile;
  lockFile: Lockfile;
} {
  const manifestFile: ManifestFile = parseManifestFile(manifestFileContents);
  if (!manifestFile.name) {
    manifestFile.name = path.isAbsolute(defaultManifestFileName)
      ? path.basename(defaultManifestFileName)
      : defaultManifestFileName;
  }

  const lockFile: Lockfile = lockfileParser.parseLockFile(lockFileContents);
  return { manifestFile, lockFile };
}

export function getLockFileParser(
  lockFileContents: string,
  lockfileType?: LockfileType,
): LockfileParser {
  if (!lockfileType) {
    lockfileType = LockfileType.npm;
  } else if (lockfileType === LockfileType.yarn) {
    lockfileType = getYarnLockfileType(lockFileContents);
  }

  switch (lockfileType) {
    case LockfileType.npm:
      return new PackageLockParser();
    case LockfileType.yarn:
      return new YarnLockParser();
    case LockfileType.yarn2:
      throw new UnsupportedError(
        'Yarn2 support has been temporarily removed to support Node.js versions 8.x.x',
      );
    /**
     * Removing yarn 2 support as this breaks support for yarn with Node.js 8
     * See: https://github.com/snyk/snyk/issues/1270
     *
     * Uncomment following code once Snyk stops Node.js 8 support
     * // parsing yarn.lock is supported for Node.js v10 and higher
     * if (getRuntimeVersion() >= 10) {
     *  lockfileParser = new Yarn2LockParser();
     *  } else {
     *   throw new UnsupportedRuntimeError(
     *     'Parsing `yarn.lock` is not ' +
     *       'supported on Node.js version less than 10. Please upgrade your ' +
     *       'Node.js environment or use `package-lock.json`',
     *   );
     * }
     * break;
     */
    default:
      throw new InvalidUserInputError(
        'Unsupported lockfile type ' +
          `${lockfileType} provided. Only 'npm' or 'yarn' is currently ` +
          'supported.',
      );
  }
}

export function getFilesContent(
  root: string,
  manifestFilePath: string,
  lockFilePath: string,
) {
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
  return { manifestFileContents, lockFileContents, lockFileType };
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
