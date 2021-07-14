import { join } from 'path';
import * as fs from 'fs';

import { PnpmPackageLockParser } from '../../lib/parsers/pnpm-lock-parser';
import { PackageLockParser } from '../../lib/parsers/package-lock-parser';
import { buildDepTreeFromFiles } from '../../lib';
import { json } from '@yarnpkg/core/lib/formatUtils';

describe('getDepMap pnpm', () => {
  it('simple pnpm', async () => {
    const rootPath = join(__dirname, '../fixtures/pnpm-simple');
    const lockFileFullPath = join(rootPath, 'pnpm-lock.yaml');
    const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');
    const lockfileParser = new PnpmPackageLockParser();
    const loaded = lockfileParser.parseLockFile(lockFileContents);
    const depMap = lockfileParser.getDepMap(loaded);
    expect(depMap).toMatchSnapshot();
  });

  it('goof depmap', () => {
    const rootPath = join(__dirname, '../fixtures/pnpm-goof');
    const lockFileFullPath = join(rootPath, 'pnpm-lock.yaml');
    const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');
    const lockfileParser = new PnpmPackageLockParser();
    const loaded = lockfileParser.parseLockFile(lockFileContents);
    const depMap = lockfileParser.getDepMap(loaded);
    expect(depMap).toMatchSnapshot();
  });

  it('cyclic pnpm', async () => {
    const rootPath = join(__dirname, '../fixtures/pnpm-cyclic');
    const lockFileFullPath = join(rootPath, 'pnpm-lock.yaml');
    const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');
    const lockfileParser = new PnpmPackageLockParser();
    const loaded = lockfileParser.parseLockFile(lockFileContents);
    const depMap = lockfileParser.getDepMap(loaded);
    expect(depMap).toMatchSnapshot();

  });

  it('npm depMap', async () => {
    const rootPath = join(__dirname, '../fixtures/cyclic-dep-simple');
    const lockFileFullPath = join(rootPath, 'package-lock.json');
    const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');
    const lockfileParser = new PackageLockParser();
    const loaded = lockfileParser.parseLockFile(lockFileContents);
    const depMap = lockfileParser.getDepMap(loaded);
    console.log(JSON.stringify(depMap));
    expect(depMap).toMatchSnapshot();
  });
});




describe('buildDepTreeFromFiles', () => {
  it('simple pnpm', async () => {
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

    expect(resPnpm).toMatchSnapshot();
  });

  it('cyclic pnpm compared to npm', async () => {
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

  it.only('medium pnpm compared to npm', async () => {
    const rootPath = join(__dirname, '../fixtures/pnpm-goof');
    const manifestFileFullPath = join(rootPath, 'package.json');
    const lockFileFullPath = join(rootPath, 'pnpm-lock.yaml');


    const resPnpm = await buildDepTreeFromFiles(
      rootPath,
      manifestFileFullPath,
      lockFileFullPath,
      false,
      true,
    );

    const npmrootPath = join(__dirname, '../fixtures/pnpm-goof');
    const npmManifestFileFullPath = join(npmrootPath, 'package.json');
    const npmLockFileFullPath = join(npmrootPath, 'package-lock.json');

    const resNpm = await buildDepTreeFromFiles(
      npmrootPath,
      npmManifestFileFullPath,
      npmLockFileFullPath,
      false,
      true,
    );
    console.log(JSON.stringify(resPnpm));
    expect(resPnpm).toMatchSnapshot();
    expect(resNpm).toMatchSnapshot();

    expect(resPnpm).toEqual(resNpm);
  });
});


