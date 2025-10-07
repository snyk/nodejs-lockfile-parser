import { DepGraphData } from '@snyk/dep-graph';

export interface ComparisonResult {
  matches: boolean;
  differences: string[];
  summary: {
    totalDifferences: number;
    categories: {
      schemaVersion?: number;
      pkgManager?: number;
      packages?: number;
      graph?: number;
    };
  };
}

export interface PackageInfo {
  id: string;
  name: string;
  version: string;
}

export interface GraphNode {
  nodeId: string;
  pkgId: string;
  deps?: Array<{ nodeId: string }>;
}

/**
 * Compares two DepGraphData objects and provides detailed insights into differences
 */
export function compareDepGraphData(
  actual: DepGraphData,
  expected: DepGraphData,
  options: {
    ignoreOrder?: boolean;
    verbose?: boolean;
  } = {}
): ComparisonResult {
  const { ignoreOrder = true, verbose = false } = options;
  const differences: string[] = [];
  const categories = {
    schemaVersion: 0,
    pkgManager: 0,
    packages: 0,
    graph: 0,
  };

  // Compare schema version
  if (actual.schemaVersion !== expected.schemaVersion) {
    differences.push(
      `Schema version mismatch: actual=${actual.schemaVersion}, expected=${expected.schemaVersion}`
    );
    categories.schemaVersion++;
  }

  // Compare package manager
  if (JSON.stringify(actual.pkgManager) !== JSON.stringify(expected.pkgManager)) {
    differences.push(
      `Package manager mismatch: actual=${JSON.stringify(actual.pkgManager)}, expected=${JSON.stringify(expected.pkgManager)}`
    );
    categories.pkgManager++;
  }

  // Compare packages
  const packageDifferences = comparePackages(actual.pkgs, expected.pkgs, ignoreOrder);
  differences.push(...packageDifferences);
  categories.packages = packageDifferences.length;

  // Compare graph structure
  const graphDifferences = compareGraph(actual.graph, expected.graph, ignoreOrder, verbose);
  differences.push(...graphDifferences);
  categories.graph = graphDifferences.length;

  return {
    matches: differences.length === 0,
    differences,
    summary: {
      totalDifferences: differences.length,
      categories,
    },
  };
}

function comparePackages(
  actualPkgs: any[],
  expectedPkgs: any[],
  ignoreOrder: boolean
): string[] {
  const differences: string[] = [];

  if (actualPkgs.length !== expectedPkgs.length) {
    differences.push(
      `Package count mismatch: actual=${actualPkgs.length}, expected=${expectedPkgs.length}`
    );
  }

  // Create maps for easier comparison
  const actualPkgMap = new Map(actualPkgs.map(pkg => [pkg.id, pkg]));
  const expectedPkgMap = new Map(expectedPkgs.map(pkg => [pkg.id, pkg]));

  // Find missing packages
  for (const [id, expectedPkg] of expectedPkgMap) {
    if (!actualPkgMap.has(id)) {
      differences.push(`Missing package: ${id} (${expectedPkg.info.name}@${expectedPkg.info.version})`);
    }
  }

  // Find extra packages
  for (const [id, actualPkg] of actualPkgMap) {
    if (!expectedPkgMap.has(id)) {
      differences.push(`Extra package: ${id} (${actualPkg.info.name}@${actualPkg.info.version})`);
    }
  }

  // Compare common packages
  for (const [id, expectedPkg] of expectedPkgMap) {
    const actualPkg = actualPkgMap.get(id);
    if (actualPkg) {
      const pkgDiffs = comparePackageDetails(actualPkg, expectedPkg, id);
      differences.push(...pkgDiffs);
    }
  }

  return differences;
}

function comparePackageDetails(actual: any, expected: any, packageId: string): string[] {
  const differences: string[] = [];

  if (actual.info.name !== expected.info.name) {
    differences.push(`Package ${packageId}: name mismatch (actual=${actual.info.name}, expected=${expected.info.name})`);
  }

  if (actual.info.version !== expected.info.version) {
    differences.push(`Package ${packageId}: version mismatch (actual=${actual.info.version}, expected=${expected.info.version})`);
  }

  // Compare other properties if they exist
  const actualKeys = Object.keys(actual.info).sort();
  const expectedKeys = Object.keys(expected.info).sort();
  
  // Filter out undefined values for comparison
  const actualFilteredKeys = actualKeys.filter(key => actual.info[key] !== undefined);
  const expectedFilteredKeys = expectedKeys.filter(key => expected.info[key] !== undefined);
  
  // Only report key differences if there are actual differences in the non-undefined keys
  if (JSON.stringify(actualFilteredKeys) !== JSON.stringify(expectedFilteredKeys)) {
    differences.push(`Package ${packageId}: info properties mismatch (actual keys: ${actualFilteredKeys.join(', ')}, expected keys: ${expectedFilteredKeys.join(', ')})`);
  }

  // Compare all properties in the info object, ignoring undefined values
  const allKeys = [...new Set([...actualKeys, ...expectedKeys])];
  for (const key of allKeys) {
    const actualValue = actual.info[key];
    const expectedValue = expected.info[key];
    
    // Skip comparison if both values are undefined
    if (actualValue === undefined && expectedValue === undefined) {
      continue;
    }
    
    // Skip comparison if one is undefined and the other doesn't exist
    if ((actualValue === undefined && !(key in expected.info)) || 
        (expectedValue === undefined && !(key in actual.info))) {
      continue;
    }
    
    if (actualValue !== expectedValue) {
      differences.push(`Package ${packageId}: ${key} mismatch (actual=${actualValue}, expected=${expectedValue})`);
    }
  }

  return differences;
}

function compareGraph(
  actualGraph: any,
  expectedGraph: any,
  ignoreOrder: boolean,
  verbose: boolean
): string[] {
  const differences: string[] = [];

  // Compare root node ID
  if (actualGraph.rootNodeId !== expectedGraph.rootNodeId) {
    differences.push(
      `Root node ID mismatch: actual=${actualGraph.rootNodeId}, expected=${expectedGraph.rootNodeId}`
    );
  }

  // Compare node count
  if (actualGraph.nodes.length !== expectedGraph.nodes.length) {
    differences.push(
      `Node count mismatch: actual=${actualGraph.nodes.length}, expected=${expectedGraph.nodes.length}`
    );
  }

  // Create maps for easier comparison
  const actualNodeMap = new Map(actualGraph.nodes.map((node: any) => [node.nodeId, node]));
  const expectedNodeMap = new Map(expectedGraph.nodes.map((node: any) => [node.nodeId, node]));

  // Find missing nodes
  for (const [nodeId, expectedNode] of expectedNodeMap) {
    if (!actualNodeMap.has(nodeId)) {
      differences.push(`Missing node: ${nodeId} (pkgId: ${(expectedNode as any).pkgId})`);
    }
  }

  // Find extra nodes
  for (const [nodeId, actualNode] of actualNodeMap) {
    if (!expectedNodeMap.has(nodeId)) {
      differences.push(`Extra node: ${nodeId} (pkgId: ${(actualNode as any).pkgId})`);
    }
  }

  // Compare common nodes
  for (const [nodeId, expectedNode] of expectedNodeMap) {
    const actualNode = actualNodeMap.get(nodeId);
    if (actualNode) {
      const nodeDiffs = compareNodeDetails(actualNode as any, expectedNode as any, nodeId as string, verbose);
      differences.push(...nodeDiffs);
    }
  }

  return differences;
}

function compareNodeDetails(
  actual: any,
  expected: any,
  nodeId: string,
  verbose: boolean
): string[] {
  const differences: string[] = [];

  if (actual.pkgId !== expected.pkgId) {
    differences.push(`Node ${nodeId}: pkgId mismatch (actual=${actual.pkgId}, expected=${expected.pkgId})`);
  }

  // Compare dependencies
  const actualDeps = actual.deps || [];
  const expectedDeps = expected.deps || [];

  if (actualDeps.length !== expectedDeps.length) {
    differences.push(
      `Node ${nodeId}: dependency count mismatch (actual=${actualDeps.length}, expected=${expectedDeps.length})`
    );
  }

  // Compare dependency lists
  const actualDepIds = actualDeps.map((dep: any) => dep.nodeId).sort();
  const expectedDepIds = expectedDeps.map((dep: any) => dep.nodeId).sort();

  if (JSON.stringify(actualDepIds) !== JSON.stringify(expectedDepIds)) {
    differences.push(
      `Node ${nodeId}: dependencies mismatch (actual: [${actualDepIds.join(', ')}], expected: [${expectedDepIds.join(', ')}])`
    );
    
    if (verbose) {
      // Find missing dependencies
      const missingDeps = expectedDepIds.filter(id => !actualDepIds.includes(id));
      const extraDeps = actualDepIds.filter(id => !expectedDepIds.includes(id));
      
      if (missingDeps.length > 0) {
        differences.push(`Node ${nodeId}: missing dependencies: [${missingDeps.join(', ')}]`);
      }
      if (extraDeps.length > 0) {
        differences.push(`Node ${nodeId}: extra dependencies: [${extraDeps.join(', ')}]`);
      }
    }
  }

  return differences;
}

/**
 * Utility function to format comparison results for console output
 */
export function formatComparisonResult(result: ComparisonResult): string {
  if (result.matches) {
    return '✅ DepGraphData objects match perfectly!';
  }

  const output = [
    '❌ DepGraphData objects do not match:',
    '',
    `Total differences: ${result.summary.totalDifferences}`,
    '',
    'Categories:',
    `  - Schema Version: ${result.summary.categories.schemaVersion} differences`,
    `  - Package Manager: ${result.summary.categories.pkgManager} differences`,
    `  - Packages: ${result.summary.categories.packages} differences`,
    `  - Graph Structure: ${result.summary.categories.graph} differences`,
    '',
    'Detailed differences:',
    ...result.differences.map(diff => `  • ${diff}`),
  ];

  return output.join('\n');
}

/**
 * Simple assertion function for use in tests
 */
export function assertDepGraphDataMatch(
  actual: DepGraphData,
  expected: DepGraphData,
  options?: { ignoreOrder?: boolean; verbose?: boolean }
): void {
  const result = compareDepGraphData(actual, expected, options);
  
  if (!result.matches) {
    throw new Error(`DepGraphData mismatch:\n${formatComparisonResult(result)}`);
  }
}
