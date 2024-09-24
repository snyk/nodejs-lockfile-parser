import { PnpmWorkspaceArgs } from '../../types';
import { LockfileV6Parser } from './lockfile-v6';

const DEFAULT_WORKSPACE_ARGS: PnpmWorkspaceArgs = {
  isWorkspace: true,
  projectsVersionMap: {},
};
export class LockfileV9Parser extends LockfileV6Parser {
  public settings;
  public snapshots;

  public constructor(
    rawPnpmLock: any,
    workspaceArgs: PnpmWorkspaceArgs = DEFAULT_WORKSPACE_ARGS,
  ) {
    super(rawPnpmLock, workspaceArgs);
    this.settings = rawPnpmLock.settings;
    this.packages = {};
    this.snapshots = rawPnpmLock.snapshots || {};
    Object.entries(this.snapshots).forEach(
      ([depPath, versionData]: [string, any]) => {
        const normalizedDepPath = this.excludeTransPeerDepsVersions(depPath);
        this.packages[normalizedDepPath] = {
          ...rawPnpmLock.packages[normalizedDepPath],
          ...versionData,
        };
      },
    );
    this.extractPackages();
  }
}
