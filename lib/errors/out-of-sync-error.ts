const LOCK_FILE_NAME = {
  npm: 'package-lock.json',
  yarn: 'yarn.lock',
};

const INSTALL_COMMAND = {
  npm: 'npm install',
  yarn: 'yarn install',
};

export class OutOfSyncError extends Error {
  public code = 422;
  public name = 'OutOfSyncError';
  public dependencyName: string;
  public lockFileType: string;

  constructor(dependencyName: string, lockFileType: 'yarn' | 'npm') {
    super(`Dependency ${dependencyName} was not found in ` +
      `${LOCK_FILE_NAME[lockFileType]}. Your package.json and ` +
      `${LOCK_FILE_NAME[lockFileType]} are probably out of sync. Please run ` +
      `"${INSTALL_COMMAND[lockFileType]}" and try again.`);
    this.dependencyName = dependencyName;
    this.lockFileType = lockFileType;
    Error.captureStackTrace(this, OutOfSyncError);
  }
}
