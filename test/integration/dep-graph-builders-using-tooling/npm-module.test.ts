import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { processNpmProjDir } from '../../../lib/dep-graph-builders-using-tooling/npm7';
import {
  assertDepGraphDataMatch,
  compareDepGraphData,
  formatComparisonResult,
} from '../../utils/depgraph-comparison';

describe('NPM Module Integration Tests', () => {
  describe('Happy path tests', () => {
    describe('Expected Result tests', () => {
      describe.each([
        'goof',
        'one-dep',
        'cyclic-dep',
        // 'deeply-nested-packages',
        // 'deeply-scoped',
        // 'different-versions',
        // 'local-pkg-without-workspaces',
        // 'dist-tag-sub-dependency',
        // 'bundled-top-level-dep',
      ])('[simple tests] project: %s ', (fixtureName) => {
        it('matches expected', async () => {
          const fixtureDir = join(
            __dirname,
            `../../jest/dep-graph-builders/fixtures/npm-lock-v2/${fixtureName}`,
          );

          const newDepGraph = await processNpmProjDir(fixtureDir, {
            includeDevDeps: false,
            includeOptionalDeps: true,
            pruneCycles: true,
            pruneWithinTopLevelDeps: true,
          });
          const newDepGraphData = newDepGraph.toJSON();

          // Debug: Write the actual result to a file for manual verification
          const debugOutputPath = join(
            __dirname,
            `../../jest/dep-graph-builders/fixtures/npm-lock-v2/${fixtureName}/expected-npm-list.json`,
          );
          writeFileSync(
            debugOutputPath,
            JSON.stringify(newDepGraphData, null, 2) + '\n',
          );
          console.log(
            `Debug: Written actual DepGraphData to ${debugOutputPath}`,
          );

          const expectedDepGraphJson = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `../../jest/dep-graph-builders/fixtures/npm-lock-v2/${fixtureName}/expected.json`,
              ),
              'utf8',
            ),
          );

          // Use the new comparison utility for better error messages
          try {
            assertDepGraphDataMatch(newDepGraphData, expectedDepGraphJson, {
              ignoreOrder: true,
              verbose: true,
            });
          } catch (error) {
            // If assertion fails, provide detailed comparison info
            const comparison = compareDepGraphData(
              newDepGraphData,
              expectedDepGraphJson,
              {
                ignoreOrder: true,
                verbose: true,
              },
            );

            console.log('\n' + formatComparisonResult(comparison));
            throw error;
          }
        });
      });
    });
  });
});
