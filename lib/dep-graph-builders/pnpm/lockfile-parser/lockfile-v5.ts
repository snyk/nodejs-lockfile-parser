import { parse } from 'dependency-path';
import { ParsedDepPath, PnpmDeps, PnpmImporters } from '../types';
import { PnpmLockfileParser } from './lockfile-parser';
import { PnpmWorkspaceArgs } from '../../types';

export class LockfileV5Parser extends PnpmLockfileParser {
  public specifiers: Record<string, string>;

  public constructor(rawPnpmLock: any, workspaceArgs?: PnpmWorkspaceArgs) {
    super(rawPnpmLock, workspaceArgs);
    const depsRoot = this.getRoot(rawPnpmLock);
    this.specifiers = depsRoot.specifiers;
  }

  public parseDepPath(depPath: string): ParsedDepPath {
    // The 'dependency-path' parsing package only works for lockfiles v5
    const { name, version } = parse(depPath);
    if (!version) {
      return { name };
    }
    return {
      name,
      version: this.excludeTransPeerDepsVersions(version),
    };
  }

  public normalizeTopLevelDeps(
    dependencies: Record<string, string>,
    isDev: boolean,
  ): PnpmDeps {
    return Object.entries(dependencies).reduce(
      (pnpmDeps: PnpmDeps, [name, version]) => {
        version = this.normalizeVersion(name, version, isDev);
        pnpmDeps[name] = {
          name,
          version,
          isDev,
          specifier: this.specifiers[name],
        };
        return pnpmDeps;
      },
      {},
    );
  }

  public normalizePackagesDeps(
    dependencies: Record<string, string>,
    isDev: boolean,
  ): Record<string, string> {
    return Object.entries(dependencies).reduce(
      (pnpmDeps: Record<string, string>, [name, version]) => {
        version = this.normalizeVersion(name, version, isDev);
        pnpmDeps[name] = version;
        return pnpmDeps;
      },
      {},
    );
  }

  // Dependency path and versions include transitive peer dependencies separated by '_'
  // e.g. in dependencies
  // dependencies:
  //    acorn-jsx: 5.3.2_acorn@7.4.1
  // OR in dependency path:
  // '/@babel/preset-typescript/7.12.13_@babel+core@7.12.13'
  // https://github.com/pnpm/spec/blob/master/dependency-path.md
  public excludeTransPeerDepsVersions(fullVersionStr: string): string {
    return fullVersionStr.split('_')[0];
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public normaliseImporters(rawPnpmLock: any): PnpmImporters {
    if (!('importers' in rawPnpmLock)) {
      return {};
    }

    const rawImporters = rawPnpmLock.importers as Record<
      string,
      { dependencies?: Record<string, string> }
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
          Object.entries(deps).map(([depName, version]) => {
            return [depName, version];
          }),
        );
        return { ...acc, [key]: depsNormalized };
      },
      {},
    );
  }
}
