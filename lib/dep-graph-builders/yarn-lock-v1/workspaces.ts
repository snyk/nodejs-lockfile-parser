import { DepGraph } from '@snyk/dep-graph';
import { PackageJsonBase } from '../types';
import { buildDepGraphYarnLockV1WorkspaceCyclesPruned } from './build-depgraph-workspace-package-pruned';
import { buildDepGraphYarnLockV1Workspace } from './build-depgraph-workspace-package';
import { extractPkgsFromYarnLockV1 } from './extract-yarnlock-v1-pkgs';

export const parseYarnLockV1WorkspaceProject = async (
  yarnLockContent: string,
  workspacePackagesPkgJsons: string[],
  options: {
    includeDevDeps: boolean;
    includeOptionalDeps: boolean;
    pruneCycles: boolean;
  },
): Promise<DepGraph[]> => {
  const { includeDevDeps, includeOptionalDeps, pruneCycles } = options;

  const extractedYarnLockV1Pkgs = await extractPkgsFromYarnLockV1(
    yarnLockContent,
    {
      includeOptionalDeps,
    },
  );

  // Parse all lockfiles and also extract names cross referencing later
  const workspacePkgNameToVersion = {};
  const parsedWorkspacePkgJsons = workspacePackagesPkgJsons.map(
    (wsPkgJsonContent) => {
      const parsedPkgJson: PackageJsonBase = JSON.parse(wsPkgJsonContent);
      workspacePkgNameToVersion[parsedPkgJson.name] = parsedPkgJson.version;
      return parsedPkgJson;
    },
  );

  const depGraphs = parsedWorkspacePkgJsons.map((parsedPkgJson) => {
    return pruneCycles
      ? buildDepGraphYarnLockV1WorkspaceCyclesPruned(
          extractedYarnLockV1Pkgs,
          parsedPkgJson,
          workspacePkgNameToVersion,
          {
            includeDevDeps,
          },
        )
      : buildDepGraphYarnLockV1Workspace(
          extractedYarnLockV1Pkgs,
          parsedPkgJson,
          workspacePkgNameToVersion,
          { includeDevDeps },
        );
  });

  return depGraphs;
};
