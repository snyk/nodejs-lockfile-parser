import { DepGraph } from '@snyk/dep-graph';
import { PackageJsonBase } from '../types';
import { buildDepGraphYarnLockV1WorkspaceCyclesPruned } from './build-depgraph-workspace-package-pruned';
import { buildDepGraphYarnLockV1Workspace } from './build-depgraph-workspace-package';
import { extractPkgsFromYarnLockV1 } from './extract-yarnlock-v1-pkgs';
import { parsePkgJson } from '../util';
import { ProjectParseOptions } from '../types';
import { cMap } from '../../c-map';

export const parseYarnLockV1WorkspaceProject = async (
  yarnLockContent: string,
  workspacePackagesPkgJsons: string[],
  options: ProjectParseOptions,
): Promise<DepGraph[]> => {
  const { includeDevDeps, includeOptionalDeps, pruneCycles, strictOutOfSync } =
    options;

  const extractedYarnLockV1Pkgs = extractPkgsFromYarnLockV1(yarnLockContent);

  // Parse all package.json files and also extract names cross referencing later
  const workspacePkgNameToVersion = {};
  const parsedWorkspacePkgJsons = workspacePackagesPkgJsons.map(
    (wsPkgJsonContent) => {
      const parsedPkgJson: PackageJsonBase = parsePkgJson(wsPkgJsonContent);
      workspacePkgNameToVersion[parsedPkgJson.name] = parsedPkgJson.version;
      return parsedPkgJson;
    },
  );

  const depGraphs = cMap(parsedWorkspacePkgJsons, async (parsedPkgJson) => {
    return pruneCycles
      ? await buildDepGraphYarnLockV1WorkspaceCyclesPruned(
          extractedYarnLockV1Pkgs,
          parsedPkgJson,
          workspacePkgNameToVersion,
          {
            includeDevDeps,
            strictOutOfSync,
            includeOptionalDeps,
          },
        )
      : await buildDepGraphYarnLockV1Workspace(
          extractedYarnLockV1Pkgs,
          parsedPkgJson,
          workspacePkgNameToVersion,
          {
            includeDevDeps,
            strictOutOfSync,
            includeOptionalDeps,
          },
        );
  });

  return depGraphs;
};
