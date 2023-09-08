import { DepGraph } from '@snyk/dep-graph';
import { NpmListTreeNode } from './npm-list-tree';
import { GraphNode, PkgInfo } from '@snyk/dep-graph/dist/core/types';

export function convertDepGraphToNpmListTree(
  depGraph: DepGraph,
): NpmListTreeNode {
  const data = depGraph.toJSON();
  const graphNodes: Map<string, GraphNode> = new Map(
    data.graph.nodes.map((it) => [it.nodeId, it]),
  );
  const packages: Map<string, PkgInfo> = new Map(
    data.pkgs.map((it) => [it.id, it.info]),
  );
  const rootNodeId = data.graph.rootNodeId;

  return convertGraphNodeToTree(graphNodes, packages, rootNodeId, []);
}

export function convertNpmListTreeToString(tree: NpmListTreeNode): string {
  const lines = [`${tree.name}@${tree.version}`];
  collectDepsToLines(tree.deps, '', lines);
  return lines.join('\n');
}

function collectDepsToLines(
  deps: NpmListTreeNode[],
  prefix,
  lines: string[],
): void {
  const sortedDeps = deps.sort((a, b) => a.name.localeCompare(b.name));
  sortedDeps.forEach((dep, index) => {
    let branch = '├─ ';
    const last = index === sortedDeps.length - 1;
    if (last) {
      branch = '└─ ';
    }

    const line = `${prefix}${branch}${dep.name}@${dep.version}${
      dep.deduped ? ' deduped' : ''
    }`;
    lines.push(line);

    if (dep.deps) {
      collectDepsToLines(dep.deps, prefix + (last ? '  ' : '│ '), lines);
    }
  });
}

export function diffNpmListTrees(
  actual: NpmListTreeNode,
  expected: NpmListTreeNode,
): string[] {
  const diff: NpmListDifference[] = [];
  const expectedPath = [`${expected.name}@${expected.version}`];
  if (actual.name === expected.name && actual.version === expected.version) {
    collectNpmListTreeDifferences(actual, expected, expectedPath, diff);
  } else {
    diff.push({
      actualPath: [`${actual.name}@${actual.version}`],
      expectedPath,
    });
  }

  const diffLines: string[] = [];
  for (const difference of diff) {
    if (difference.expectedPath && !difference.actualPath) {
      diffLines.push(`MISSING ${difference.expectedPath.join(' -> ')}`);
    } else if (difference.expectedPath && difference.actualPath) {
      diffLines.push(
        `DIFFERENT VERSION AT ${difference.actualPath.join(' -> ')} EXPECTED ${
          difference.expectedPath[difference.expectedPath.length - 1]
        }`,
      );
    } else if (!difference.expectedPath && difference.actualPath) {
      diffLines.push(`EXTRA ${difference.actualPath.join(' -> ')}`);
    }
  }

  return diffLines;
}

function collectNpmListTreeDifferences(
  actual: NpmListTreeNode,
  expected: NpmListTreeNode,
  path: string[],
  diff: NpmListDifference[],
): void {
  const sortedExpectedDeps = expected.deps.sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  // Find missing deps or at wrong versions
  for (const expectedDep of sortedExpectedDeps) {
    const actualDep = actual.deps.find((it) => it.name === expectedDep.name);
    if (actualDep === undefined) {
      // Missing dep
      const difference: NpmListDifference = {
        expectedPath: [...path, `${expectedDep.name}@${expectedDep.version}`],
      };
      diff.push(difference);
    } else if (actualDep.version !== expectedDep.version) {
      // Different versions
      const difference: NpmListDifference = {
        expectedPath: [...path, `${expectedDep.name}@${expectedDep.version}`],
        actualPath: [...path, `${actualDep.name}@${actualDep.version}`],
      };
      diff.push(difference);
    } else if (!expectedDep.deduped) {
      // If no difference, dive deeper (unless deduped, in which case hard to compare)
      collectNpmListTreeDifferences(
        actualDep,
        expectedDep,
        [...path, `${expectedDep.name}@${expectedDep.version}`],
        diff,
      );
    }
  }

  // Find extra deps
  for (const actualDep of actual.deps) {
    const expectedDep = expected.deps.find((it) => it.name === actualDep.name);
    if (expectedDep === undefined) {
      // Extra dep
      const difference: NpmListDifference = {
        actualPath: [...path, `${actualDep.name}@${actualDep.version}`],
      };
      diff.push(difference);
    }
  }
}

function convertGraphNodeToTree(
  graphNodes: Map<string, GraphNode>,
  packages: Map<string, PkgInfo>,
  nodeId: string,
  path: string[],
): NpmListTreeNode {
  const node = graphNodes.get(nodeId);
  if (node === undefined) {
    throw new Error(`Node with ID '${nodeId}' not found in graph nodes`);
  }
  const pkg = packages.get(node.pkgId);
  if (pkg === undefined) {
    throw new Error(
      `Package with ID '${node.pkgId}' not found in packages. Referenced from node '${nodeId}'`,
    );
  }

  const isCyclic = path.indexOf(node.pkgId) !== -1;

  path.push(node.pkgId);
  const deps = isCyclic
    ? []
    : node.deps.map((dep) =>
        convertGraphNodeToTree(graphNodes, packages, dep.nodeId, path),
      );
  path.pop();

  return {
    name: pkg.name,
    version: pkg.version ?? '',
    deduped: isCyclic,
    deps,
  };
}

interface NpmListDifference {
  /**
   * Undefined if the dependency does not exist in the expected tree.
   */
  expectedPath?: string[];

  /**
   * Undefined if the dependency does not exist in the actual tree.
   */
  actualPath?: string[];
}
