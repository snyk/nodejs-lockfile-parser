import { ProjectSnapshot, ResolvedDependencies } from '@pnpm/lockfile-types';
import {
  SpecifierAndResolution,
  parsePnpm7lockfile,
} from './parse-pnpm7-lock-file';
import { PnpmNormalisedPkgs, PnpmNormalisedProject } from './type';

function normaliseDependencies(deps): ResolvedDependencies {
  if (!deps) {
    return {};
  }
  return deps;
}

export const extractPkgsFromPnpmLockV7 = (
  pnpmLockContent: string,
): PnpmNormalisedProject => {
  const parsedLockFile = parsePnpm7lockfile(pnpmLockContent);
  const { packages = {}, snapshots = {}, importers = {} } = parsedLockFile;

  function retrieveDependencies(
    deps: Record<string, SpecifierAndResolution> | undefined,
    info: { optional: boolean; dev: boolean },
    dependencies: PnpmNormalisedPkgs,
  ) {
    if (deps) {
      Object.keys(deps).forEach((pkgId) => {
        const dependencyInfo: SpecifierAndResolution = deps?.[
          pkgId
        ] as unknown as SpecifierAndResolution;
        if (!dependencyInfo) {
          return;
        }

        const packageSpecifier = `${pkgId}@${dependencyInfo.version}`;
        const snapshotInfo = snapshots[packageSpecifier];
        dependencies[pkgId] = {
          version: dependencyInfo.version,
          dependencies: normaliseDependencies(snapshotInfo.dependencies),
          optionalDependencies: normaliseDependencies(
            snapshotInfo.optionalDependencies,
          ),
          dev: info.dev,
        };
      });
    }
  }

  function normaliseWorkspacePackages(
    workspace: ProjectSnapshot,
  ): PnpmNormalisedPkgs {
    const workspaceDependencies: PnpmNormalisedPkgs = {};

    retrieveDependencies(
      workspace.dependencies as
        | Record<string, SpecifierAndResolution>
        | undefined,
      { optional: false, dev: false },
      workspaceDependencies,
    );

    retrieveDependencies(
      workspace.devDependencies as
        | Record<string, SpecifierAndResolution>
        | undefined,
      { optional: false, dev: true },
      workspaceDependencies,
    );

    retrieveDependencies(
      workspace.optionalDependencies as
        | Record<string, SpecifierAndResolution>
        | undefined,
      { optional: true, dev: false },
      workspaceDependencies,
    );

    return workspaceDependencies;
  }

  const project: PnpmNormalisedProject = {};
  Object.keys(importers).forEach((importerId) => {
    const importerInfo = importers[importerId];
    const normalisedPkgs = normaliseWorkspacePackages(importerInfo);
    project[importerId] = normalisedPkgs;
  });

  return project;
};
