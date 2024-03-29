import { join } from 'path';
import { buildDepTreeFromFiles } from '../../lib';
import { load } from '../utils';

describe('buildDepTreeFromFiles for pnpm7', () => {
  it('should be able to parse medium file', async () => {
    const rootPath = join(__dirname, '../fixtures/pnpm-7');
    const manifestFileFullPath = join(rootPath, 'package.json');
    const lockFileFullPath = join(rootPath, 'pnpm-lock.yaml');

    const result = await buildDepTreeFromFiles(
      rootPath,
      manifestFileFullPath,
      lockFileFullPath,
      false,
      true,
    );

    const expectedTree = load('pnpm-7/expected-tree.json');
    expect(result).toStrictEqual(expectedTree);
  });
});
