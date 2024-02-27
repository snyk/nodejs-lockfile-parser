import { OutOfSyncError } from '../../errors';
import { LockfileType } from '../../parsers';
import { NormalisedPkgs } from '../types';
import { getChildNode, PkgNode } from '../util';

export const getChildNodeYarnLockV1Workspace = (
  name: string,
  depInfo: { version: string; isDev: boolean },
  workspacePkgNameToVersion: Record<string, string>,
  pkgs: NormalisedPkgs,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
) => {
  let childNode: PkgNode;

  if (workspacePkgNameToVersion[name]) {
    const version = workspacePkgNameToVersion[name];

    // This is just to mimic old behavior where when StrictOutOfSync is turned on,
    // any cross referencing between workspace packages will lead to a throw
    if (strictOutOfSync) {
      throw new OutOfSyncError(`${name}@${version}`, LockfileType.yarn);
    }

    childNode = {
      id: `${name}@${version}`,
      name: name,
      version: version,
      resolved: 'FIXME nodejs-lockfile-parser/lib/dep-graph-builders/yarn-lock-v1/util.ts',
      integrity: 'lib/dep-graph-builders/yarn-lock-v1/util.ts',
      dependencies: {},
      isDev: depInfo.isDev,
    };
  } else {
    childNode = getChildNode(
      name,
      depInfo,
      pkgs,
      strictOutOfSync,
      includeOptionalDeps,
    );
  }

  return childNode;
};
