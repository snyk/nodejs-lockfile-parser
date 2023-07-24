import { LockfileType } from '../parsers';

const LOCK_FILE_NAME = {
  npm: 'package-lock.json',
  npm7: 'package-lock.json',
  yarn: 'yarn.lock',
  yarn2: 'yarn.lock',
  pnpm: 'pnpm-lock.yaml',
};

const INSTALL_COMMAND = {
  npm: 'npm install',
  npm7: 'npm install',
  yarn: 'yarn install',
  yarn2: 'yarn install',
  pnpm: 'pnpm install',
};

export class OutOfSyncError extends Error {
  public code = 422;
  public name = 'OutOfSyncError';
  public dependencyName: string;
  public lockFileType: string;

  constructor(dependencyName: string, lockFileType: LockfileType) {
    super(
      `Dependency ${dependencyName} was not found in ` +
      `${LOCK_FILE_NAME[lockFileType]}. Your package.json and ` +
      `${LOCK_FILE_NAME[lockFileType]} are probably out of sync. Please run ` +
      `"${INSTALL_COMMAND[lockFileType]}" and try again.`,
    );
    this.dependencyName = dependencyName;
    this.lockFileType = lockFileType;
    Error.captureStackTrace(this, OutOfSyncError);
  }
}
