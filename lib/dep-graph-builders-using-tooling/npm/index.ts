import { DepGraph } from '@snyk/dep-graph';
import { getNpmListOutput } from './npm-list-processor';
import { buildDepGraph } from './depgraph-builder';
import { NpmProjectProcessorOptions } from './types';

export { NpmProjectProcessorOptions };

export async function processNpmProjDir(
  dir: string,
  options: NpmProjectProcessorOptions,
): Promise<DepGraph> {
  const npmListJson = await getNpmListOutput(dir, options);
  const dg = buildDepGraph(npmListJson, options);
  return dg;
}
