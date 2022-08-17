import {
  FlatDependenciesMap,
  FormattedCliOutput,
  YarnListTree,
} from './cli-parser-types';
import { extractCorrectIdentifierBySemver } from './cli-parser-utils';

export const parseYarnListOutput = (
  rawYarnListOutput: string,
  manifestDependencies: Record<string, string>,
): FormattedCliOutput => {
  const formattedYarnList: YarnListTree[] =
    JSON.parse(rawYarnListOutput).data.trees;

  // Reference to all (resolved) dep names to help cleanup in next step
  const names = formattedYarnList.map((tree) => tree.name);

  const formattedListOutput: FlatDependenciesMap = formattedYarnList.reduce(
    (result, tree) => {
      const dependencies = tree.children.map((child) =>
        extractCorrectIdentifierBySemver(names, child.name),
      );

      return result.set(tree.name, dependencies);
    },
    new Map<string, string[]>(),
  );

  const topLevelDeps = getTopLevelDependencies(
    formattedListOutput,
    manifestDependencies,
  );

  return { topLevelDeps, dependencies: formattedListOutput };
};

const getTopLevelDependencies = (
  formattedListOutput: FlatDependenciesMap,
  topLevelDeps: Record<string, string>,
) => {
  // This logic is to construct an item for the rootPkg because
  // we are dealing with a flat map so far so can't tell
  const names = [...formattedListOutput.keys()];
  return Object.entries(topLevelDeps).map(([name, version]) =>
    extractCorrectIdentifierBySemver(names, `${name}@${version}`),
  );
};
