import { join } from 'path';
import { buildDepTreeFromFiles } from '../../lib';
import { load } from '../utils';

describe('buildDepTreeFromFiles for yarn2', () => {
  it('should be able to parse very big yarn.lock files', async () => {
    const rootPath = join(__dirname, '../fixtures/yarn/yarn2/big');
    const manifestFileFullPath = join(rootPath, 'package.json');
    const lockFileFullPath = join(rootPath, 'yarn.lock');

    // any sort of equality assertion runs into running out of heap memory hence we only assert against error for huge files
    expect(async () => {
      await buildDepTreeFromFiles(
        rootPath,
        manifestFileFullPath,
        lockFileFullPath,
        false,
        true,
      );
    }).not.toThrow();
  });

  it('should be able to parse medium file', async () => {
    const rootPath = join(__dirname, '../fixtures/goof');
    const manifestFileFullPath = join(rootPath, 'package.json');
    const lockFileFullPath = join(rootPath, 'yarn2/yarn.lock');

    const result = await buildDepTreeFromFiles(
      rootPath,
      manifestFileFullPath,
      lockFileFullPath,
      false,
      true,
    );

    const expectedTree = load('goof/yarn2/expected-tree.json');
    expect(result).toStrictEqual(expectedTree);
  });
});
