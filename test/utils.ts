import * as fs from 'fs';
import { createFromJSON, DepGraph } from '@snyk/dep-graph';

export function readFixture(filePath: string): string {
  return fs.readFileSync(`${__dirname}/lib/fixtures/${filePath}`, 'utf8');
}

export function load(filePath: string): any {
  try {
    const contents = readFixture(filePath);
    return JSON.parse(contents);
  } catch (e) {
    throw new Error('Could not find test fixture ' + filePath);
  }
}

export function loadDepGraph(filePath: string): DepGraph {
  try {
    const json = load(filePath);
    return createFromJSON(json);
  } catch (e) {
    throw new Error('Could not load dep-graph ' + e);
  }
}
