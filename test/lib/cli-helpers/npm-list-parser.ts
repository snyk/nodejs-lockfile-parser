import { NpmListTreeNode } from './npm-list-tree';

interface NpmListLine {
  depth: number;
  text: string;
}

/**
 * Parses output of `npm ls --all` command to an `NpmListTreeNode` structure.
 *
 * @param rawNpmListOutput Output of `npm ls --all` command.
 */
export function parseNpmListOutput(rawNpmListOutput: string): NpmListTreeNode {
  // split into lines and for each line deduce indentation
  const nonEmptyTextLines = rawNpmListOutput
    .split('\n')
    .filter((it) => it.length > 0);
  if (nonEmptyTextLines.length === 0) {
    throw new Error(
      `Invalid argument 'output': expecting at least one line, but got none`,
    );
  }
  const lines = nonEmptyTextLines.map(parseLine);

  let path: NpmListTreeNode[] = [];
  for (const line of lines) {
    const node = convertLineTextToTreeNode(line.text);
    path = getPathForDepth(path, line.depth);
    addNodeAtPath(path, node);
  }

  return path[0];
}

function parseLine(line: string): NpmListLine {
  const atSignIndex = line.indexOf('@');
  if (atSignIndex === -1) {
    throw new Error(`Did not find '@' in line '${line}'`);
  }

  const packageNameIndex = line.lastIndexOf(' ', atSignIndex) + 1; // assuming there are no spaces in package name
  if (packageNameIndex === 0) {
    // Root package
    return {
      depth: 0,
      text: line,
    };
  }

  const depth = (packageNameIndex - 2) / 2;
  return {
    depth,
    text: line.substring(packageNameIndex),
  };
}

function convertLineTextToTreeNode(text: string): NpmListTreeNode {
  const atSignIndex = text.indexOf('@');
  if (atSignIndex === -1 || atSignIndex === text.length - 1) {
    throw new Error(
      `Did not find '@' separating name and version in text '${text}'`,
    );
  }

  const packageName = text.substring(0, atSignIndex);
  const packageVersionEndIndex = text.indexOf(' ', atSignIndex);
  if (packageVersionEndIndex === -1) {
    // no suffix
    return {
      name: packageName,
      version: text.substring(atSignIndex + 1),
      deps: [],
      deduped: false,
    };
  }

  // with suffix
  const packageVersion = text.substring(
    atSignIndex + 1,
    packageVersionEndIndex === -1 ? undefined : packageVersionEndIndex,
  );
  const deduped = text.substring(packageVersionEndIndex) === ' deduped';
  return {
    name: packageName,
    version: packageVersion,
    deps: [],
    deduped,
  };
}

function getPathForDepth(
  path: NpmListTreeNode[],
  depth: number,
): NpmListTreeNode[] {
  if (depth > path.length) {
    const pathString = path.map((it) => it.name).join('->');
    throw new Error(
      `The path is too short to apply for given depth. Depth: ${depth}, path: ${pathString}`,
    );
  }

  return path.slice(0, depth);
}

function addNodeAtPath(path: NpmListTreeNode[], node: NpmListTreeNode) {
  if (path.length > 0) {
    const parent = path[path.length - 1];
    parent.deps.push(node);
  }
  path.push(node);
}
