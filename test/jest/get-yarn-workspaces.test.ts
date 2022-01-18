import { getYarnWorkspacesFromFiles } from '../../lib';

it('should recognise no yarn workspaces if there are not any defined in manifest', () => {
  const workspaces = getYarnWorkspacesFromFiles(
    `${__dirname}/../fixtures/external-tarball/`,
    'package.json',
  );

  expect(workspaces).toEqual(false);
});

it('should recognise yarn workspaces defined as an array of strings', () => {
  const workspaces = getYarnWorkspacesFromFiles(
    `${__dirname}/../fixtures/yarn-workspace/`,
    'package.json',
  );

  expect(workspaces).toEqual(['packages/*', 'libs/*']);
});

it('should recognise yarn workspaces defined as an object with packages key', () => {
  const workspaces = getYarnWorkspacesFromFiles(
    `${__dirname}/../fixtures/yarn-workspace-packages-key/`,
    'package.json',
  );

  expect(workspaces).toEqual(['packages/*']);
});

it('should recognise yarn workspaces defined as an object with nohoist key', () => {
  const workspaces = getYarnWorkspacesFromFiles(
    `${__dirname}/../fixtures/yarn-workspace-nohoist-key/`,
    'package.json',
  );

  expect(workspaces).toEqual(['**/puppeteer', '**/puppeteer/**']);
});

it('should recognise yarn workspaces defined as an object from both nohoist key and packages key', () => {
  const workspaces = getYarnWorkspacesFromFiles(
    `${__dirname}/../fixtures/yarn-workspace-packages-and-nohoist-keys/`,
    'package.json',
  );

  expect(workspaces).toEqual(['packages/*', '**/puppeteer', '**/puppeteer/**']);
});
