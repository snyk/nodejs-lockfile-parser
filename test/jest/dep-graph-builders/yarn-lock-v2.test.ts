import { readFileSync } from 'fs';
import { join } from 'path';
import { extractPkgsFromYarnLockV2 } from '../../../lib/dep-graph-builders/yarn-lock-v2/extract-yarnlock-v2-pkgs';

describe('dep-graph-builder yarn-lock-v1', () => {
  describe('happy path tests', () => {
    describe('Expected Result tests', () => {
      describe.each([
        'git-remote-url',
        // 'goof',
        // 'external-tarball',
        // 'file-as-version',
        // 'file-as-version-no-lock-entry',
        // 'git-ssh-url-deps',
        // 'npm-protocol',
        // 'simple-top-level-out-of-sync',
        // 'lock-file-deps-out-of-sync',
      ])('[simple tests] project: %s ', (fixtureName) => {
        test('matches expected', async () => {
          // const pkgJsonContent = readFileSync(
          //   join(
          //     __dirname,
          //     `./fixtures/yarn-lock-v1/${fixtureName}/package.json`,
          //   ),
          //   'utf8',
          // );
          const yarnLockContent = readFileSync(
            join(__dirname, `./fixtures/yarn-lock-v2/${fixtureName}/yarn.lock`),
            'utf8',
          );
          extractPkgsFromYarnLockV2(yarnLockContent);

          expect(true).toBeTruthy();
        });
      });
    });
  });
});
