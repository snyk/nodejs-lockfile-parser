import { OutOfSyncError } from '../../errors';
import { LockfileType } from '../../parsers';
import { getChildNode, PkgNode } from '../util';
import { PnpmNormalisedPkgs } from './type';

export const getChildNodePnpmLockV7Workspace = (
  name: string,
  depInfo: { version: string; isDev: boolean },
  workspacePkgNameToVersion: Record<string, string>,
  pkgs: PnpmNormalisedPkgs,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
) => {
  let childNode: PkgNode;

  if (workspacePkgNameToVersion[name]) {
    const version = workspacePkgNameToVersion[name];

    // This is just to mimic old behavior where when StrictOutOfSync is turned on,
    // any cross referencing between workspace packages will lead to a throw
    if (strictOutOfSync) {
      throw new OutOfSyncError(`${name}@${version}`, LockfileType.pnpm);
    }

    childNode = {
      id: `${name}@${version}`,
      name: name,
      version: version,
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
