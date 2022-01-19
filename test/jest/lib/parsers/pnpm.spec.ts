import { load } from '../../../utils';
import { buildDepTreeFromFiles } from '../../../../lib';

describe('buildDepTreeFromFiles', () => {
  it('Parse pnpm package-lock.json', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/../../../fixtures/goof`,
      'package.json',
      'pnpm-lock.yaml',
      true,
    );

    expect(depTree).toMatchSnapshot();
  });

  // package.json dependencies key is empty
  it('Throws when package.json has no dependencies (because lockfile is missing)', async () => {
    expect(
      buildDepTreeFromFiles(
        `${__dirname}/../../../fixtures/pnpm/no_deps/`,
        'package.json',
        'pnpm-lock.yaml',
      ),
    ).rejects.toThrowError('Lockfile not found at location:');
  });

  // no lockfile
  it('no lockfile', async () => {
    expect(
      buildDepTreeFromFiles(
        `${__dirname}/../../../fixtures/pnpm/no_deps`,
        'package.json',
        'pnpm-lock.yaml',
      ),
    ).rejects.toThrowError('Lockfile not found at location:');
  });

  // package.json dependencies && devDependencies key are empty
  it('Correctly returns an empty depTree when dependencies is empty with --dev', async () => {
    expect(
      buildDepTreeFromFiles(
        `${__dirname}/../../../fixtures/pnpm/no_deps/`,
        'package.json',
        'pnpm-lock.yaml',
        true,
      ),
    ).rejects.toThrowError('Lockfile not found at location:');
  });

  // package.json dependencies is empty but devDependencies key has deps
  it('Correctly returns a depTree when dependencies is empty with --dev (dev deps only)', async () => {
    const expectedDepTree = load('pnpm/dev-deps-only/expected-tree-pnpm.json');

    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/../../../fixtures/pnpm/dev-deps-only`,
      'package.json',
      'pnpm-lock.yaml',
      true,
    );

    expect(depTree).toEqual(expectedDepTree);
  });

  it(`package.json has empty name property, expected project name to be a fallback`, async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/../../../fixtures/pnpm/empty_name_property`,
      'package.json',
      'pnpm-lock.yaml',
      true,
    );

    expect(depTree.name).toMatch('package.json');
    expect(depTree).toMatchSnapshot();
  });

  it('invalid lockfile => parsing lockfile failed', async () => {
    expect(
      buildDepTreeFromFiles(
        `${__dirname}/../../../fixtures/pnpm/no_deps`,
        'package.json',
        'pnpm-lock.yaml',
      ),
    ).rejects.toThrowError('');
  });

  it('Parse pnpm package-lock.json with devDependencies with --dev', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/../../../fixtures/pnpm/mix_devdep_and_deps/`,
      'package.json',
      'pnpm-lock.yaml',
      true, // includeDev
    );

    expect(depTree).toMatchSnapshot();
  });

  it('Parse pnpm package-lock.json without devDependencies (--dev false)', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/../../../fixtures/pnpm/mix_devdep_and_deps/`,
      'package.json',
      'pnpm-lock.yaml',
      false, // includeDev
    );

    expect(depTree).toMatchSnapshot();
  });

  it('with optional deps pnpm', async () => {
    const expectedDepTree = load('pnpm/optional_deps_only/expected-tree.json');

    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/../../../fixtures/pnpm/optional_deps_only`,
      'package.json',
      'pnpm-lock.yaml',
      false,
      false,
    );

    expect(depTree).toEqual(expectedDepTree);
  });

  it('with workspace pnpm-lock', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/../../../fixtures/pnpm/workspacesWithPackages`,
      'packages/web/package.json',
      'pnpm-lock.yaml',
      false,
      false,
      'web',
    );

    expect(depTree).toMatchSnapshot();
  });

  it('with another workspace pnpm-lock', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/../../../fixtures/pnpm/workspacesWithMorePackages`,
      'content-copy/package.json',
      'pnpm-lock.yaml',
      true,
      false,
      'content-copy',
    );

    expect(depTree).toMatchSnapshot();
  });

  it('Parse simple react pnpm package-lock.json with devDependencies (cyclic)', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/../../../fixtures/pnpm/react_simple/`,
      'packages/demo/package.json',
      'pnpm-lock.yaml',
      true, // includeDev
      false,
      'packages/demo',
    );

    expect(depTree).toMatchSnapshot();
  });

  it('Parse full demo package of react project pnpm package-lock.json without devDependencies (cyclic)', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/../../../fixtures/pnpm/react_project/`,
      'packages/demo/package.json',
      'pnpm-lock.yaml',
      false, // includeDev
      false,
      'packages/demo',
    );

    expect(depTree).toMatchSnapshot();
  });

  it('Parse full demo package of react project pnpm package-lock.json with devDependencies full includeDev', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/../../../fixtures/pnpm/react_project/`,
      'packages/demo/package.json',
      'pnpm-lock.yaml',
      true, // includeDev
      false,
      'packages/demo',
    );

    expect(depTree).toMatchSnapshot();
  });

  it('Parse full demo react-vapor package of react project pnpm package-lock.json with devDependencies', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/../../../fixtures/pnpm/react_project/`,
      'packages/demo/package.json',
      'pnpm-lock.yaml',
      false, // includeDev
      false,
      'packages/react-vapor',
    );

    expect(depTree).toMatchSnapshot();
  });

  it('Parse pnpm simple pnpm rush project', async () => {
    const depTree = await buildDepTreeFromFiles(
      `${__dirname}/../../../fixtures/pnpm/pnpm-rush-simple/`,
      'package.json',
      'pnpm-lock.yaml',
      false, // includeDev
      false,
    );

    expect(depTree).toMatchSnapshot();
  });
});
