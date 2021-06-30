export interface FormattedCliOutput {
  topLevelDeps: string[];
  dependencies: FlatDependenciesMap;
}

export type FlatDependenciesMap = Map<string, string[]>;

export type YarnInfoOutput = Array<{
  value: string;
  // `children` has many possible keys in the objects but
  // these are the types we care about though
  children: {
    Version: string;
    Dependents?: string[];
    Dependencies?: {
      descriptor: string;
      locator: string;
    }[];
  };
}>;

export interface YarnListTree {
  name: string;
  children: { name: string; color: string; shadow: boolean }[];
  hint: string | null;
  color: string | null;
  depth: number;
}
