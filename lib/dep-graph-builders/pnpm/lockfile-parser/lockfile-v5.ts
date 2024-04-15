import { parse } from 'dependency-path';
import { ParsedDepPath, PnpmDeps } from '../types';
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
}
