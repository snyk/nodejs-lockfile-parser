import { PnpmWorkspaceArgs } from '../../types';
import { ParsedDepPath, PnpmDeps, PnpmImporters } from '../types';
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
    importerName?: string,
  ): PnpmDeps {
    return Object.entries(dependencies).reduce(
      (pnpmDeps: PnpmDeps, [name, depInfo]) => {
        const version = this.normalizeVersion(
          name,
          depInfo.version,
          isDev,
          importerName,
        );
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
    importerName?: string,
  ): Record<string, string> {
    return Object.entries(dependencies).reduce(
      (pnpmDeps: Record<string, string>, [name, depInfo]) => {
        const version = this.normalizeVersion(
          name,
          depInfo.version,
          isDev,
          importerName,
        );
        pnpmDeps[name] = version;
        return pnpmDeps;
      },
      {},
    );
  }

  // Dependency path and versions include transitive peer dependencies encapsulated in dependencies
  // e.g. '/cdktf-cli@0.20.3(ink@3.2.0)(react@17.0.2)' -> cdktf-cli@0.20.3
  public excludeTransPeerDepsVersions(fullVersionStr: string): string {
    return fullVersionStr.split('(')[0];
  }

  public static isAbsoluteDepenencyPath(dependencyPath: string): boolean {
    return dependencyPath[0] !== '/';
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public normaliseImporters(rawPnpmLock: any): PnpmImporters {
    if (!('importers' in rawPnpmLock)) {
      return {};
    }

    const rawImporters = rawPnpmLock.importers as Record<
      string,
      { dependencies?: Record<string, { version: string }> }
    >;
    return Object.entries(rawImporters).reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (acc, [key, val]) => {
        // No deps case
        if (!('dependencies' in val)) {
          return { ...acc, [key]: {} };
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const deps = val.dependencies!;
        const depsNormalized = Object.fromEntries(
          Object.entries(deps).map(([depName, depInfo]) => {
            return [depName, depInfo.version];
          }),
        );
        return { ...acc, [key]: depsNormalized };
      },
      {},
    );
  }
}
