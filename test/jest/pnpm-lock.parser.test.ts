import { join } from 'path';
import * as fs from 'fs';

import { PnpmPackageLockParser } from '../../lib/parsers/pnpm-lock-parser';
import { PackageLockParser } from '../../lib/parsers/package-lock-parser';
import { buildDepTreeFromFiles } from '../../lib';

describe('getDepMap pnpm', () => {
  it.skip('simple pnpm', async () => {
    const rootPath = join(__dirname, '../fixtures/pnpm-simple');
    const manifestFileFullPath = join(rootPath, 'package.json');
    const lockFileFullPath = join(rootPath, 'pnpm-lock.yaml');
    const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');


    const lockfileParser = new PnpmPackageLockParser();
    const loaded = lockfileParser.parseLockFile(lockFileContents);

    const depMap = lockfileParser.getDepMap(loaded);

    console.log(JSON.stringify(depMap));
    expect(depMap).toEqual({});
  });

  it('cyclic pnpm', async () => {
    const rootPath = join(__dirname, '../fixtures/pnpm-cyclic');
    const manifestFileFullPath = join(rootPath, 'package.json');
    const lockFileFullPath = join(rootPath, 'pnpm-lock.yaml');
    const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');


    const lockfileParser = new PnpmPackageLockParser();
    const loaded = lockfileParser.parseLockFile(lockFileContents);

    const depMap = lockfileParser.getDepMap(loaded);

    console.log(JSON.stringify(depMap));
    expect(depMap).toEqual({});
  });

  it('npm depMap', async () => {
    const rootPath = join(__dirname, '../fixtures/cyclic-dep-simple');
    const lockFileFullPath = join(rootPath, 'package-lock.json');
    const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');


    const lockfileParser = new PackageLockParser();
    const loaded = lockfileParser.parseLockFile(lockFileContents);

    const depMap = lockfileParser.getDepMap(loaded);

    console.log(JSON.stringify(depMap));
    expect(depMap).toEqual({});
  });
});




describe.only('getDepMap pnpm', () => {
  it.skip('simple pnpm', async () => {
    const rootPath = join(__dirname, '../fixtures/pnpm-simple');
    const manifestFileFullPath = join(rootPath, 'package.json');
    const lockFileFullPath = join(rootPath, 'pnpm-lock.yaml');

    const resPnpm = await buildDepTreeFromFiles(
      rootPath,
      manifestFileFullPath,
      lockFileFullPath,
      false,
      true,
    )

    expect(resPnpm).toEqual({});
  });

  it('cyclic pnpm', async () => {
    const rootPath = join(__dirname, '../fixtures/pnpm-cyclic');
    const manifestFileFullPath = join(rootPath, 'package.json');
    const lockFileFullPath = join(rootPath, 'pnpm-lock.yaml');


    const resPnpm = await buildDepTreeFromFiles(
      rootPath,
      manifestFileFullPath,
      lockFileFullPath,
      false,
      true,
    );

    const npmrootPath = join(__dirname, '../fixtures/cyclic-dep-simple');
    const npmManifestFileFullPath = join(npmrootPath, 'package.json');
    const npmLockFileFullPath = join(npmrootPath, 'package-lock.json');

    const resNpm = await buildDepTreeFromFiles(
      npmrootPath,
      npmManifestFileFullPath,
      npmLockFileFullPath,
      false,
      true,
    )

    expect(resPnpm).toEqual(resNpm);
  });
});


