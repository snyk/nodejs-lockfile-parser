import * as fs from 'fs';
import * as path from 'path';
import { getYarnWorkspaces, LockfileType, PkgTree, Scope } from './parsers';
// import { Yarn2LockParser } from './parsers/yarn2-lock-parse';
// import getRuntimeVersion from './get-node-runtime-version';
import {
  InvalidUserInputError,
  OutOfSyncError,
  UnsupportedRuntimeError,
} from './errors';

export { buildDepTree, buildDepTreeFromFiles } from './dep-tree';

export {
  getYarnWorkspacesFromFiles,
  getYarnWorkspaces,
  PkgTree,
  Scope,
  LockfileType,
  UnsupportedRuntimeError,
  InvalidUserInputError,
  OutOfSyncError,
};

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
