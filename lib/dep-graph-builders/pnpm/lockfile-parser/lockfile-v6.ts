import { PnpmWorkspaceArgs } from '../../types';
import { ParsedDepPath, PnpmDeps } from '../types';
import { PnpmLockfileParser } from './lockfile-parser';

export class LockfileV6Parser extends PnpmLockfileParser {
  public settings;

  public constructor(rawPnpmLock: any, workspaceArgs?: PnpmWorkspaceArgs) {
    super(rawPnpmLock, workspaceArgs);
    this.settings = rawPnpmLock.settings;
  }

  public parseDepPath(depPath: string): ParsedDepPath {
    // Exclude transitive peer deps from depPath
    // e.g. '/cdktf-cli@0.20.3(ink@3.2.0)(react@17.0.2)' -> cdktf-cli@0.20.3
    depPath = this.excludeTransPeerDepsVersions(depPath);

    // Check if path is absolute (doesn't start with '/')
    // If it's not absolute, omit first '/'
    depPath = LockfileV6Parser.isAbsoluteDepenencyPath(depPath)
      ? depPath
      : depPath.substring(1);

    // Next, get version based on the last occurence of '@' separator
    // e.g. @babel/code-frame@7.24.2 -> name: @babel/code-frame and version: 7.24.2
    const sepIndex = depPath.lastIndexOf('@');
    if (sepIndex === -1) {
      return {};
    }
    const name = depPath.substring(0, sepIndex);
    const version = depPath.substring(sepIndex + 1);
    return {
      name,
      version,
    };
  }

  public normalizeTopLevelDeps(
    dependencies: Record<string, Record<string, string>>,
    isDev: boolean,
  ): PnpmDeps {
    return Object.entries(dependencies).reduce(
      (pnpmDeps: PnpmDeps, [name, depInfo]) => {
        const version = this.normalizeVersion(name, depInfo.version, isDev);
        pnpmDeps[name] = {
          name,
          version,
          specifier: depInfo.specifier,
          isDev,
        };
        return pnpmDeps;
      },
      {},
    );
  }

  public normalizePackagesDeps(
    dependencies: Record<string, Record<string, string>>,
    isDev: boolean,
  ): Record<string, string> {
    return Object.entries(dependencies).reduce(
      (pnpmDeps: Record<string, string>, [name, depInfo]) => {
        const version = this.normalizeVersion(name, depInfo.version, isDev);
        pnpmDeps[name] = version;
        return pnpmDeps;
      },
      {},
    );
  }

  // Dependency path and versions include transitive peer dependencies encapsulated in dependencies
  // e.g. '/cdktf-cli@0.20.3(ink@3.2.0)(react@17.0.2)' -> cdktf-cli@0.20.3
  public excludeTransPeerDepsVersions(fullVersionStr: string): string {
    const match = fullVersionStr.match(/([^)]*)\(/);
    return match?.[1] ?? fullVersionStr;
  }

  public static isAbsoluteDepenencyPath(dependencyPath: string): boolean {
    return dependencyPath[0] !== '/';
  }
}
