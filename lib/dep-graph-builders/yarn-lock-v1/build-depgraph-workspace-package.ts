import { DepGraphBuilder } from '@snyk/dep-graph';
import { PackageJsonBase } from '../types';

// Parse a single workspace package using yarn.lock v1
// workspaces feature
export const buildDepGraphYarnLockV1Workspace = (
  extractedYarnLockV1Pkgs: Record<
    string,
    {
      version: string;
      dependencies: Record<string, string>;
    }
  >,
  pkgJson: PackageJsonBase,
  workspacePkgNameToVersion: Record<string, string>,
  options: { includeDevDeps: boolean },
) => {
  const depGraphBuilder = new DepGraphBuilder(
    { name: 'yarn' },
    { name: pkgJson.name, version: pkgJson.version },
  );
  const topLevelDeps = getTopLevelDeps(pkgJson, {
    includeDevDeps: options.includeDevDeps,
  });
  // Start with the root node in our queue
  const nodesForDepGraph = [
    {
      name: pkgJson.name,
      version: pkgJson.version,
      dependencies: topLevelDeps,
      isDev: false,
      isRoot: true,
    },
  ];
  const ancestorMap: Record<string, Set<string>> = {};

  const nodesPrunedAsCyclic: Set<string> = new Set();

  while (nodesForDepGraph.length > 0) {
    const nodeData = nodesForDepGraph.shift();
    const parentId = nodeData?.isRoot
      ? 'root-node'
      : `${nodeData!.name}@${nodeData!.version}`;

    for (const [name, depInfo] of Object.entries(
      nodeData?.dependencies || {},
    )) {
      const isWorkspacePkg = workspacePkgNameToVersion[name] ? true : false;

      const depData = isWorkspacePkg
        ? { version: workspacePkgNameToVersion[name], dependencies: {} }
        : extractedYarnLockV1Pkgs[`${name}@${depInfo.version}`];
      let childId = `${name}@${depData.version}`;

      // Is it cyclic
      const isCyclic =
        ancestorMap.hasOwnProperty(parentId) &&
        ancestorMap[parentId].has(childId);

      ancestorMap[childId] = new Set([
        ...(ancestorMap[parentId] || []),
        ...(ancestorMap[childId] || []),
        parentId,
      ]);

      if (isCyclic) {
        childId = `${childId}|1`;
      }
      if (!nodesPrunedAsCyclic.has(childId)) {
        if (isCyclic) {
          nodesPrunedAsCyclic.add(childId);
        }
        depGraphBuilder.addPkgNode(
          { name, version: depData.version },
          childId,
          {
            labels: {
              scope: depInfo.isDev || nodeData?.isDev ? 'dev' : 'prod',
              ...(isWorkspacePkg && { pruned: 'true' }),
              ...(isCyclic && { pruned: 'cyclic' }),
            },
          },
        );
      }

      depGraphBuilder.connectDep(parentId, childId);

      if (!isCyclic && !isWorkspacePkg) {
        const dependencies = Object.entries(depData.dependencies || {}).reduce(
          (
            acc: Record<string, { version: string; isDev: boolean }>,
            [name, semver],
          ) => {
            acc[name] = { version: semver, isDev: depInfo.isDev };
            return acc;
          },
          {},
        );

        nodesForDepGraph.push({
          name,
          dependencies,
          isDev: nodeData?.isDev || false,
          version: depData.version,
          isRoot: false,
        });
      }
    }
  }
  return depGraphBuilder.build();
};

const getTopLevelDeps = (
  pkgJson: PackageJsonBase,
  options: { includeDevDeps: boolean },
): Record<string, { version: string; isDev: boolean }> => {
  const prodDeps = Object.entries(pkgJson.dependencies || {}).reduce(
    (
      acc: Record<string, { version: string; isDev: boolean }>,
      [name, semver],
    ) => {
      acc[name] = { version: semver, isDev: false };
      return acc;
    },
    {},
  );

  const devDeps = options.includeDevDeps
    ? Object.entries(pkgJson.devDependencies || {}).reduce(
        (
          acc: Record<string, { version: string; isDev: boolean }>,
          [name, semver],
        ) => {
          acc[name] = { version: semver, isDev: true };
          return acc;
        },
        {},
      )
    : {};
  return { ...prodDeps, ...devDeps };
};
