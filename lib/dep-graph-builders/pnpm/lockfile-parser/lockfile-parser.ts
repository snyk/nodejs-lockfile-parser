import { PnpmWorkspaceArgs } from '../../types';
import {
  NormalisedPnpmPkg,
  NormalisedPnpmPkgs,
  ParsedDepPath,
  PnpmDepPath,
  PnpmDeps,
  PnpmImporters,
  PnpmLockPkg,
} from '../types';
import { valid } from 'semver';
import * as pathUtil from 'path';

export abstract class PnpmLockfileParser {
  public lockFileVersion: string;
  public rawPnpmLock: any;
  public packages: Record<PnpmDepPath, PnpmLockPkg>;
  public extractedPackages: NormalisedPnpmPkgs;
  public importers: PnpmImporters;
  public workspaceArgs?: PnpmWorkspaceArgs;

  public constructor(rawPnpmLock: any, workspaceArgs?: PnpmWorkspaceArgs) {
    this.rawPnpmLock = rawPnpmLock;
    this.lockFileVersion = rawPnpmLock.lockfileVersion;
    this.workspaceArgs = workspaceArgs;
    this.packages = rawPnpmLock.packages || {};
    this.extractedPackages = {};
    this.importers = this.normaliseImporters(rawPnpmLock);
  }

  public isWorkspaceLockfile() {
    return this.workspaceArgs?.isWorkspace;
  }

  public extractPackages() {
    // Packages should be parsed only one time for a parser
    if (Object.keys(this.extractedPackages).length > 0) {
      return this.extractedPackages;
    }
    const packages: NormalisedPnpmPkgs = {};
    Object.entries(this.packages).forEach(
      ([depPath, versionData]: [string, any]) => {
        // name and version are optional in version data - if they don't show up in version data, they can be deducted from the dependency path
        const { name, version } = versionData;
        let parsedPath: ParsedDepPath = {};
        if (!(version && name)) {
          parsedPath = this.parseDepPath(depPath);
        }

        const pkg: NormalisedPnpmPkg = {
          id: depPath,
          name: name || parsedPath.name,
          version: version || parsedPath.version || depPath,
          isDev: versionData.dev == 'true',
          dependencies: versionData.dependencies || {},
          devDependencies: versionData.devDependencies || {},
          optionalDependencies: versionData.optionalDependencies || {},
        };
        packages[`${pkg.name}@${pkg.version}`] = pkg;
      },
    );
    return packages;
  }

  public extractTopLevelDependencies(
    options: {
      includeDevDeps: boolean;
      includeOptionalDeps?: boolean;
      includePeerDeps?: boolean;
    },
    importer?: string,
  ): PnpmDeps {
    let root = this.rawPnpmLock;
    if (importer) {
      root = this.rawPnpmLock.importers[importer];
    }

    const prodDeps = this.normalizeTopLevelDeps(
      root.dependencies || {},
      false,
      importer,
    );
    const devDeps = options.includeDevDeps
      ? this.normalizeTopLevelDeps(root.devDependencies || {}, true, importer)
      : {};

    const optionalDeps = options.includeOptionalDeps
      ? this.normalizeTopLevelDeps(
          root.optionalDependencies || {},
          false,
          importer,
        )
      : {};

    const peerDeps = options.includePeerDeps
      ? this.normalizeTopLevelDeps(root.peerDependencies || {}, false, importer)
      : {};

    return { ...prodDeps, ...devDeps, ...optionalDeps, ...peerDeps };
  }

  public normalizeVersion(
    name: string,
    version: string,
    isDev: boolean,
    importerName?: string,
  ): string {
    if (this.isWorkspaceLockfile()) {
      version = this.resolveWorkspacesCrossReference(
        name,
        version,
        isDev,
        importerName,
      );
    }
    if (!valid(version)) {
      version = this.excludeTransPeerDepsVersions(version);
      if (!valid(version)) {
        // for npm and git ref packages
        // they show up in packages with keys equal to the version in top level deps
        // e.g. body-parser with version github.com/expressjs/body-parser/263f602e6ae34add6332c1eb4caa808893b0b711
        if (this.packages[version]) {
          return this.packages[version].version || version;
        }
        if (this.packages[`${name}@${version}`]) {
          return this.packages[`${name}@${version}`].version || version;
        }
      }
    }
    return version;
  }

  public resolveWorkspacesCrossReference(
    name: string,
    version: string,
    isDev: boolean,
    importerName?: string,
  ): string {
    if (!this.workspaceArgs) {
      return version;
    }
    if (version.startsWith('link:')) {
      // In  workspaces example:
      // package-b:
      //   specifier: 1.0.0
      //   version: link:../pkg-b
      const depPath = version.split('link:')[1];
      const resolvedPathDep = pathUtil
        .join(importerName || '.', depPath)
        .replace(/\\/g, '/');
      // cross referenced package, we add it to the extracted packages
      version = this.workspaceArgs.projectsVersionMap[resolvedPathDep];
      if (!version) {
        version = 'undefined';
      }

      const subDeps = this.rawPnpmLock.importers[resolvedPathDep] || {
        dependencies: {},
        devDependencies: {},
        optionalDependencies: {},
      };

      const resolvedDeps = this.normalizePackagesDeps(
        subDeps.dependencies || {},
        isDev,
        resolvedPathDep,
      );

      const resolvedDevDeps = this.normalizePackagesDeps(
        subDeps.devDependencies || {},
        true,
        resolvedPathDep,
      );

      const resolvedOptionalDeps = this.normalizePackagesDeps(
        subDeps.optionalDependencies || {},
        true,
        resolvedPathDep,
      );

      this.extractedPackages[`${name}@${version}`] = {
        name,
        version,
        id: `${name}@${version}`,
        isDev,
        dependencies: resolvedDeps,
        devDependencies: resolvedDevDeps,
        optionalDependencies: resolvedOptionalDeps,
      };
    }
    return version;
  }

  // The different lockfile versions present dependencies and versions in
  // slightly different formats that require slightly different processing

  // Top level dependencies are presented slightly different based on lockfile versions
  // version and specifier are grouped together in v6 and separately in v5
  // v5:
  // specifiers:
  //    accepts: 1.3.7
  // dependencies:
  //   accepts: 1.3.7
  // v6:
  // dependencies:
  //    accepts:
  //      specifier: 1.3.7
  //      version: 1.3.7

  abstract normalizePackagesDeps(
    dependencies,
    isDev,
    importerName?,
  ): Record<string, string>;

  abstract normalizeTopLevelDeps(dependencies, isDev, importerName?): PnpmDeps;

  // Dependency paths are parsed differently based on lockfile version
  // For lockfile v5, pnpm provides the 'dependency-path' package that parses a dep path
  // The previously mentioned packages doesn't have support for lockfile v6 dependency paths
  // Diff basic example: v5 - '/accepts/1.3.7' VS v6 - '/accepts@1.3.7'
  abstract parseDepPath(depPath: string): ParsedDepPath;

  // Transitive peer dependencies are concated to the package version in
  // different ways dependning on the lockfile version
  // v5 example: '/@babel/preset-typescript/7.12.13_@babel+core@7.12.13'
  // v6 example: '/cdktf-cli@0.20.3(ink@3.2.0)(react@17.0.2)'
  abstract excludeTransPeerDepsVersions(fullVersionStr: string): string;

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  abstract normaliseImporters(rawPnpmLock: any): PnpmImporters;
}
