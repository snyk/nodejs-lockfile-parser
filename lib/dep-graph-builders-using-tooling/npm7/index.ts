import { DepGraph, DepGraphBuilder } from '@snyk/dep-graph';

import { execute } from '../exec';
import { writeFileSync } from 'fs';
import {
  NpmDependency,
  NpmListOutput,
  isNpmListOutput,
} from './npm-list-types';

type NpmDependencyWithId = NpmDependency & { id: string; name: string };

export type Npm7ParseOptions = {
  /** Whether to include development dependencies */
  includeDevDeps: boolean;
  /** Whether to include optional dependencies */
  includeOptionalDeps: boolean;
  /** Whether to include peer dependencies */
  includePeerDeps?: boolean;
  /** Whether to prune cycles in the dependency graph */
  pruneCycles: boolean;
  /** Whether to prune within top-level dependencies */
  pruneWithinTopLevelDeps: boolean;
  /** Whether to honor package aliases */
  honorAliases?: boolean;
};

export async function processNpmProjDir(
  dir: string,
  options: Npm7ParseOptions,
): Promise<DepGraph> {
  const npmListJson = await getNpmListOutput(dir);
  const dg = buildDepGraph(npmListJson, options);
  return dg;
}

async function getNpmListOutput(dir: string): Promise<NpmListOutput> {
  const npmListRawOutput = await execute(
    'npm',
    ['list', '--all', '--json', '--package-lock-only'],
    { cwd: dir },
  );

  // Save the raw output for debugging
  writeFileSync('./help.json', npmListRawOutput);

  try {
    const parsed = JSON.parse(npmListRawOutput);
    writeFileSync('./npm-list.json', JSON.stringify(parsed, null, 2));
    if (isNpmListOutput(parsed)) {
      return parsed;
    } else {
      throw new Error(
        'Parsed JSON does not match expected NpmListOutput structure',
      );
    }
  } catch (e) {
    throw new Error('Failed to parse JSON from npm list output');
  }
}

function buildDepGraph(
  npmListJson: NpmListOutput,
  options: Npm7ParseOptions,
): DepGraph {
  const depGraphBuilder = new DepGraphBuilder(
    { name: 'npm' },
    { name: npmListJson.name, ...(npmListJson.version && { version: npmListJson.version }) },
  );

  // First pass: Build a map of all full dependency definitions
  const fullDependencyMap = new Map<string, NpmDependency>();
  collectFullDependencies(npmListJson.dependencies, fullDependencyMap);
  console.log(
    `Collected ${fullDependencyMap.size} full dependency definitions`,
  );

  const rootNode: NpmDependencyWithId = {
    id: 'root-node',
    name: npmListJson.name,
    version: npmListJson.version || 'undefined',
    dependencies: npmListJson.dependencies,
    resolved: '',
    overridden: false,
  };

  processNpmDependency(
    depGraphBuilder,
    rootNode,
    options,
    new Set<string>(),
    fullDependencyMap,
  );

  return depGraphBuilder.build();
}

/**
 * Recursively collects all full dependency definitions (those with resolved, overridden, etc.)
 * and stores them in a map keyed by "package-name@version"
 */
function collectFullDependencies(
  dependencies: Record<string, NpmDependency>,
  fullDependencyMap: Map<string, NpmDependency>,
): void {
  for (const [name, dependency] of Object.entries(dependencies)) {
    const key = `${name}@${dependency.version}`;

    // Store if this is a full definition (has resolved, overridden, or dependencies)
    if (
      dependency.resolved ||
      dependency.overridden !== undefined ||
      dependency.dependencies
    ) {
      fullDependencyMap.set(key, dependency);
    }

    // Recursively collect from nested dependencies
    if (dependency.dependencies) {
      collectFullDependencies(dependency.dependencies, fullDependencyMap);
    }
  }
}

/**
 * Checks if a dependency is deduplicated (only has version field)
 */
function isDeduplicatedDependency(dependency: any): boolean {
  return (
    typeof dependency === 'object' &&
    dependency !== null &&
    typeof dependency.version === 'string' &&
    !dependency.resolved &&
    dependency.overridden === undefined &&
    !dependency.dependencies
  );
}

/**
 * Resolves a deduplicated dependency by looking up the full definition
 */
function resolveDeduplicatedDependency(
  name: string,
  version: string,
  fullDependencyMap: Map<string, NpmDependency>,
): NpmDependency | null {
  const key = `${name}@${version}`;
  return fullDependencyMap.get(key) || null;
}

function processNpmDependency(
  depGraphBuilder: DepGraphBuilder,
  node: NpmDependencyWithId,
  options: Npm7ParseOptions,
  visited: Set<string>,
  fullDependencyMap: Map<string, NpmDependency>,
) {
  for (const [name, dependency] of Object.entries(node.dependencies || {})) {
    let processedDependency = dependency;

    // Handle deduplicated dependencies
    if (isDeduplicatedDependency(dependency)) {
      const fullDefinition = resolveDeduplicatedDependency(
        name,
        dependency.version,
        fullDependencyMap,
      );

      if (fullDefinition) {
        processedDependency = fullDefinition;
      } else {
        // If we can't find the full definition, log a warning and continue with the deduplicated version
        console.warn(
          `Warning: Could not find full definition for deduplicated dependency ${name}@${dependency.version}`,
        );
        // Create a minimal full definition from the deduplicated one
        processedDependency = {
          version: dependency.version,
          resolved: '',
          overridden: false,
          dependencies: {},
        };
      }
    }

    const childNode: NpmDependencyWithId = {
      id: `${name}@${processedDependency.version}`,
      name: name,
      ...processedDependency,
    };

    if (visited.has(childNode.id) || childNode.id === 'root-node') {
      depGraphBuilder.connectDep(node.id, childNode.id);
      continue;
    }

    depGraphBuilder.addPkgNode(
      { name: childNode.name, version: childNode.version },
      childNode.id,
      {
        labels: {
          scope: 'prod',
        },
      },
    );
    depGraphBuilder.connectDep(node.id, childNode.id);
    visited.add(childNode.id);
    processNpmDependency(
      depGraphBuilder,
      childNode,
      options,
      visited,
      fullDependencyMap,
    );
  }
}
