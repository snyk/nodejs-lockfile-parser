import { DepGraphBuilder } from '@snyk/dep-graph';
import { PackageJsonBase } from '../types';

// Build dep graph from a parsed yarn.lock v1
// for a non workspace project
export const buildDepGraphYarnLockV1Simple = (
  parsedYarnLockV1: Record<
    string,
    {
      version: string;
      dependencies: Record<string, string>;
    }
  >,
  pkgJson: PackageJsonBase,
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
      const depData = parsedYarnLockV1[`${name}@${depInfo.version}`];

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

      // ...and check if we have already done so.
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
              ...(isCyclic && { pruned: 'cyclic' }),
            },
          },
        );
      }

      depGraphBuilder.connectDep(parentId, childId);

      if (!isCyclic) {
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
