import {buildDepTreeFromFiles} from '../../lib';
import * as fs from 'fs';

const load = (filename:string) => JSON.parse(
  fs.readFileSync(`${__dirname}/fixtures/${filename}`, 'utf8'),
);

describe('package-lock.json parser', () => {
  test('parses package-lock.json with no devDependencies', async () => {
    const expectedDepTree = load('goof/dep-tree-no-dev-deps.json');
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/goof/`,
      'package.json',
      'package-lock.json',
    );

    expect(depTree).toEqual(expectedDepTree);
  });

  test('parses package-lock.json with devDependencies', async() => {
    const expectedDepTree = load('goof/dep-tree-with-dev-deps.json');

    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/goof/`,
      'package.json',
      'package-lock.json',
      true,
    );

    expect(depTree).toEqual(expectedDepTree);
  });

  test('Parse npm package.json with empty devDependencies', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/empty-dev-deps/`,
      'package.json',
      'package-lock.json',
      true,
    );

    expect(depTree.hasDevDependencies).toBe(false);
    expect(depTree.dependencies).toHaveProperty('adm-zip');
  });

  test('parses a package-lock.json with missing dependency', async () => {
    await expect(buildDepTreeFromFiles(
      `${__dirname}/fixtures/goof/`,
      'package.json',
      'package-lock_missing_dep.json',
    )).rejects.toThrow();
  });

  test('parses a package-lock.json with repeated dependency', async () => {
    const expectedDepTree = load('package-repeated-in-manifest/expected-tree.json');

    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/package-repeated-in-manifest/`,
      'package.json',
      'package-lock.json',
      false,
    );

    expect(depTree).toEqual(expectedDepTree);
  });

  test('parses a package-lock.json with a missing package name', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/missing-name/`,
      'package.json',
      'package-lock.json',
      true,
    );

    expect(depTree.dependencies).not.toEqual({});
    expect(depTree.name).toBeUndefined();
  });

  test('parses a package-lock.json with empty dependencies and includeDev = false', async () => {
    const expectedDepTree = load('missing-deps/expected-tree.json');
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/missing-deps/`,
      'package.json',
      'package-lock.json',
      false,
    );

    expect(depTree).toEqual(expectedDepTree);
  });

  test('parses package-lock.json with empty dependencies and includeDev = true', async () => {
    const expectedDepTree = load('missing-deps/expected-tree.json');
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/missing-deps/`,
      'package.json',
      'package-lock.json',
      true,
    );

    expect(depTree).toEqual(expectedDepTree);
  });

  test('parses a package-lock.json with dev deps only', async () => {
    const expectedDepTree = load('dev-deps-only/expected-tree.json');
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/dev-deps-only/`,
      'package.json',
      'package-lock.json',
      true,
    );

    expect(depTree).toEqual(expectedDepTree);
  });

  test('parses a package-lock.json with cyclic deps', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/cyclic-dep-simple/`,
      'package.json',
      'package-lock.json',
    );

    expect(depTree)
      .toHaveProperty('dependencies.debug.dependencies.ms.dependencies.debug.cyclic', true);
  });

  test('parses big npm package-lock.json with cyclic deps and dev-deps (performance)', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/fixtures/cyclic-dep/`,
      'package.json',
      'package-lock.json',
      true,
    );

    expect(depTree.name).toBe('trucolor');
    expect(depTree).toMatchSnapshot();
  });

  test('parses an invalid package-lock.json', async () => {
    await expect(buildDepTreeFromFiles(
      `${__dirname}/fixtures/invalid-files/`,
      'package.json',
      'package-lock_missing_dep.json',
    )).rejects.toThrowErrorMatchingSnapshot();
  });

  test('parses an invalid package.json', async () => {
    await expect(buildDepTreeFromFiles(
      `${__dirname}/fixtures/invalid-files/`,
      'package.json_invalid',
      'package-lock.json',
    )).rejects.toThrowErrorMatchingSnapshot();
  });
});
