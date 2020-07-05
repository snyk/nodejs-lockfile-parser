import { test } from 'tap';
import * as path from 'path';

import { readFixture } from '../utils';
import { buildDepTree, LockfileType } from '../../lib';

test('Default manifest name is used when manifest is missing', async (t) => {
  // Arrange
  const manifestFileContent: string = await readFixture(
    'package-json-without-name/package.json',
  );
  const lockFileContent: string = await readFixture(
    'package-json-without-name/package-lock.json',
  );

  // Act
  const result = await buildDepTree(
    manifestFileContent,
    lockFileContent,
    false,
    LockfileType.npm,
    true,
  );

  // Assert
  t.equal(result.name, 'package.json', 'resolved to correct name');
});

test('Default manifest name is used when path is relative', async (t) => {
  // Arrange
  const manifestFileContent: string = await readFixture(
    'package-json-without-name/package.json',
  );
  const lockFileContent: string = await readFixture(
    'package-json-without-name/package-lock.json',
  );

  // Act
  const result = await buildDepTree(
    manifestFileContent,
    lockFileContent,
    false,
    LockfileType.npm,
    true,
    'fixture/package-json-without-name/package.json',
  );

  // Assert
  t.equal(
    result.name,
    'fixture/package-json-without-name/package.json',
    'resolved to correct name',
  );
});

test('Default manifest name is resolved when path is absolute', async (t) => {
  // Arrange
  const manifestFileContent: string = await readFixture(
    'package-json-without-name/package.json',
  );
  const lockFileContent: string = await readFixture(
    'package-json-without-name/package-lock.json',
  );
  const absolutePath = path.resolve(
    __dirname,
    'lib',
    'fixtures',
    'package.json',
  );

  // Act
  const result = await buildDepTree(
    manifestFileContent,
    lockFileContent,
    false,
    LockfileType.npm,
    true,
    absolutePath,
  );

  // Assert
  t.equal(result.name, 'package.json', 'resolved to correct name');
});
