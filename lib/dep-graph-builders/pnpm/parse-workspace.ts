import { DepGraph } from '@snyk/dep-graph';
import * as debugModule from 'debug';
import * as path from 'path';
import { getPnpmLockfileVersion } from '../../utils';
import {
  PackageJsonBase,
  PnpmProjectParseOptions,
  ScannedNodeProject,
} from '../types';
import { parsePkgJson } from '../util';
import { buildDepGraphPnpm } from './build-dep-graph-pnpm';
import { UNDEFINED_VERSION } from './constants';
import { getPnpmLockfileParser } from './lockfile-parser/index';
import { PnpmLockfileParser } from './lockfile-parser/lockfile-parser';
import { getFileContents } from './utils';

const debug = debugModule('snyk-pnpm-workspaces');

// Compute project versions map
// This is needed because the lockfile doesn't present the version of
// a project that's part of a workspace, we need to retrieve it from
// its corresponding package.json
function computeProjectVersionMaps(root: string, targets: string[]) {
  const projectsVersionMap = {};
  for (const target of targets) {
    const directory = path.join(root, target);
    const packageJsonFileName = path.join(directory, 'package.json');
    const packageJson = getFileContents(root, packageJsonFileName);

    try {
      const parsedPkgJson = parsePkgJson(packageJson.content);
      projectsVersionMap[target] = {
        version: parsedPkgJson.version || UNDEFINED_VERSION,
        name: parsedPkgJson.name,
      };
    } catch (err: any) {
      debug(
        `Error getting version for project: ${packageJsonFileName}. ERROR: ${err}`,
      );
      continue;
    }
  }
  return projectsVersionMap;
}

export const parsePnpmWorkspace = async (
  root: string,
  workspaceDir: string,
  options: PnpmProjectParseOptions,
) => {
  const scannedProjects: ScannedNodeProject[] = [];
  const {
    includeDevDeps,
    includePeerDeps,
    includeOptionalDeps,
    strictOutOfSync,
    pruneWithinTopLevelDeps,
    exclude,
  } = options;

  const pnpmLockfileContents = getFileContents(
    root,
    path.join(workspaceDir, 'pnpm-lock.yaml'),
  ).content;

  const lockfileVersion = getPnpmLockfileVersion(pnpmLockfileContents);
  const lockFileParser: PnpmLockfileParser = getPnpmLockfileParser(
    pnpmLockfileContents,
    lockfileVersion,
  );

  const projectVersionsMaps = computeProjectVersionMaps(
    workspaceDir,
    Object.keys(lockFileParser.importers),
  );

  const excludeList = exclude ? exclude.split(',').map((s) => s.trim()) : [];

  for (const importer of Object.keys(lockFileParser.importers)) {
    if (excludeList.length > 0) {
      const importerParts = importer.split('/');
      const shouldExclude = excludeList.some((excludeName) =>
        importerParts.includes(excludeName),
      );

      if (shouldExclude) {
        debug(`Skipping excluded importer: ${importer}`);
        continue;
      }
    }
    const resolvedImporterPath = path.join(workspaceDir, importer);
    const packagePath = path.join(resolvedImporterPath, 'package.json');
    debug(`Processing project ${packagePath} as part of a pnpm workspace`);
    const pkgJsonFile = getFileContents(root, packagePath);

    const pkgJson: PackageJsonBase = parsePkgJson(pkgJsonFile.content);

    lockFileParser.workspaceArgs = {
      isWorkspace: true,
      projectsVersionMap: projectVersionsMaps,
    };

    try {
      const depGraph: DepGraph = await buildDepGraphPnpm(
        lockFileParser,
        pkgJson,
        {
          includeDevDeps,
          includePeerDeps,
          strictOutOfSync,
          includeOptionalDeps,
          pruneWithinTopLevelDeps,
        },
        importer,
      );

      const project: ScannedNodeProject = {
        packageManager: 'pnpm',
        targetFile: path.relative(root, pkgJsonFile.fileName),
        depGraph,
        plugin: {
          name: 'snyk-nodejs-lockfile-parser',
          runtime: process.version,
        },
      };
      scannedProjects.push(project);
    } catch (e) {
      debug(`Error process workspace: ${pkgJsonFile.fileName}. ERROR: ${e}`);
    }
  }
  return scannedProjects;
};
