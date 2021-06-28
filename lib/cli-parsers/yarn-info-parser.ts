import {
  FlatDependenciesMap,
  FormattedCliOutput,
  YarnInfoOutput,
} from './cli-parser-types';

export const parseYarnInfoOutput = (
  rawYarnInfoOutput: string,
): FormattedCliOutput => {
  const formattedYarnInfo: YarnInfoOutput = rawYarnInfoOutput
    .split('\n')
    .filter(Boolean)
    .map((el) => JSON.parse(el));

  const formattedInfoOutput: FlatDependenciesMap = formattedYarnInfo.reduce(
    (result, { value, children }) => {
      const dependencies =
        children.Dependencies?.map((el) =>
          el.locator.replace(/@virtual:.*#/, '@'),
        ) || [];

      return result.set(value, dependencies);
    },
    new Map<string, string[]>(),
  );

  const rootWorkspaceKey = [...formattedInfoOutput.keys()].find((el) =>
    el.includes('@workspace:.'),
  ) as string;
  const topLevelDeps: string[] =
    formattedInfoOutput.get(rootWorkspaceKey) || [];

  // Now we have rootdeps we delete the key
  formattedInfoOutput.delete(rootWorkspaceKey);

  return { topLevelDeps, dependencies: formattedInfoOutput };
};
