import { DepGraphBuilder } from '@snyk/dep-graph';
import { PackageJsonBase } from '../types';

export const parseYarnLockV1 = (
  pkgJsonContent: string,
  yarnLockContent: string,
) => {
  const pkgJson: PackageJsonBase = JSON.parse(pkgJsonContent);
  const depGraphBuilder = new DepGraphBuilder(
    { name: 'yarn' },
    { name: pkgJson.name, version: pkgJson.version },
  );

  const topLevelDeps = getTopLevelDeps(pkgJson);
  const pkgs = extractPkgsFromYarnLockV1(yarnLockContent);

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
      const depData = pkgs[`${name}@${depInfo.version}`];

      let childId = `${name}@${depData.version}`;
      let isCyclic = false;

      // Here is where we figure a node needs to be pruned
      if (
        ancestorMap.hasOwnProperty(parentId) &&
        ancestorMap[parentId].has(childId)
      ) {
        isCyclic = true;
      }

      ancestorMap[childId] = new Set([
        ...(ancestorMap[parentId] || []),
        parentId,
      ]);

      // ...and check if we have already done so.
      if (!nodesPrunedAsCyclic.has(childId)) {
        if (isCyclic) {
          nodesPrunedAsCyclic.add(childId);
          childId = `${childId}|1`;
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

  const devDeps = Object.entries(pkgJson.devDependencies || {}).reduce(
    (
      acc: Record<string, { version: string; isDev: boolean }>,
      [name, semver],
    ) => {
      acc[name] = { version: semver, isDev: true };
      return acc;
    },
    {},
  );
  return { ...prodDeps, ...devDeps };
};

const extractPkgsFromYarnLockV1 = (yarnLockContent: string) => {
  let allDeps: Record<
    string,
    { version: string; dependencies: Record<string, string> }
  > = {};
  for (const newDeps of pkgDependencyGenerator(yarnLockContent)) {
    allDeps = { ...allDeps, ...newDeps };
  }
  return allDeps;
};

function* pkgDependencyGenerator(yarnLockContent: string) {
  const lines = yarnLockContent.split('\n');

  /*
    This checks three things to make sure this is the 
    first line of the dep definition:
      1. Line is non empty
      2. Line does not start with white space
      3. Line is not a comment (they are present in lockfiles)
  */
  const isLineStartOfDepBlock = (line: string) => {
    return line && !/\s/.test(line[0]) && line[0] !== '#';
  };

  /*
    This checks if we are on the version line
  */
  const isLineContainingVersion = (line: string) => {
    return line.includes('version');
  };

  /*
    This checks if we are on the line starting the dependency
    definitions
  */
  const isLineStartOfDependencies = (line: string) => {
    return line.includes('dependencies:');
  };

  /*
    This checks if current line has a matching indent size
  */
  const matchesFrontWhitespace = (line: string, whitespaceCount: number) => {
    return line.search(/\S/) === whitespaceCount;
  };

  while (lines.length) {
    const line = lines.shift() as string;

    // Once we find a block we look at the next lines until we
    // get to the next dep block. We also store the keys from
    // the line itself
    if (isLineStartOfDepBlock(line)) {
      const dependencyKeys = line.split(',').map((key) => {
        return key
          .trim()
          .replace(new RegExp(':', 'g'), '')
          .replace(new RegExp('"', 'g'), '');
      });
      let version: string = '';
      const dependencies: Record<string, string> = {};

      while (lines.length && !isLineStartOfDepBlock(lines[0])) {
        const lineInDepBlock = lines.shift() as string;

        if (isLineContainingVersion(lineInDepBlock)) {
          const resolvedVersion = lineInDepBlock
            .replace(new RegExp('version', 'g'), '')
            .replace(new RegExp('"', 'g'), '')
            .trim();
          version = resolvedVersion;
        }

        if (isLineStartOfDependencies(lineInDepBlock)) {
          const dependencyFrontWhitespaceCount = lines[0].search(/\S/);
          while (
            lines.length &&
            matchesFrontWhitespace(lines[0], dependencyFrontWhitespaceCount)
          ) {
            const dependencyLine = lines.shift() as string;
            const [
              dependencyName,
              dependencyVersionWithQualifiers,
            ] = dependencyLine
              .trimStart()
              .replace(new RegExp('"', 'g'), '')
              .split(/(?<=^\S+)\s/);
            dependencies[dependencyName] = dependencyVersionWithQualifiers;
          }
        }
      }

      const uniqueDepEntries = dependencyKeys.reduce((acc, key) => {
        return { ...acc, [key]: { version, dependencies } };
      }, {});

      yield uniqueDepEntries;
      continue;
    }
  }
}
