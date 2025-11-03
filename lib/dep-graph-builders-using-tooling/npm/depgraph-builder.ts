import { DepGraph, DepGraphBuilder } from '@snyk/dep-graph';
import {
  NpmDependency,
  NpmListOutput,
  NpmProjectProcessorOptions,
} from './types';

type NpmDependencyWithId = NpmDependency & { id: string; name: string };

export function buildDepGraph(
  npmListJson: NpmListOutput,
  options: NpmProjectProcessorOptions,
): DepGraph {
  const depGraphBuilder = new DepGraphBuilder(
    { name: 'npm' },
    {
      name: npmListJson.name,
      ...(npmListJson.version && { version: npmListJson.version }),
    },
  );

  // First pass: Build a map of all full dependency definitions
  const fullDependencyMap = new Map<string, NpmDependency>();
  collectFullDependencies(npmListJson.dependencies, fullDependencyMap);

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
  options: NpmProjectProcessorOptions,
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
        // If we can't find the full definition, continue with the deduplicated version
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
