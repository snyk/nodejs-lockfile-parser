import { extractPkgsFromYarnLockV2 } from './extract-yarnlock-v2-pkgs';
import { parsePkgJson } from '../util';
import {
  PackageJsonBase,
  YarnLockV2ProjectParseOptions,
  YarnLockV2WorkspaceArgs,
} from '../types';
import { buildDepGraphYarnLockV2Simple } from './build-depgraph-simple';
import { DepGraph } from '@snyk/dep-graph';
import { rewriteAliasesPkgJson } from '../../aliasesPreprocessors/pkgJson';
import * as debugModule from 'debug';

const debug = debugModule('snyk-nodejs-lockfile-parser:component-metadata');

export const parseYarnLockV2Project = async (
  pkgJsonContent: string,
  yarnLockContent: string,
  options: YarnLockV2ProjectParseOptions,
  workspaceArgs?: YarnLockV2WorkspaceArgs,
): Promise<DepGraph> => {
  const {
    includeDevDeps,
    includeOptionalDeps,
    strictOutOfSync,
    pruneWithinTopLevelDeps,
    honorAliases,
    showNpmScope,
    includeComponentMetadata,
  } = options;

  if (includeComponentMetadata) {
    // Berry lockfiles store no tarball URL and only a `checksum` over yarn's cache artifact
    // (not the published tarball SRI), so component-metadata labels are deferred for yarn berry.
    debug(
      'includeComponentMetadata is set but component-metadata labels are not yet produced ' +
        'for yarn berry (v2-4) lockfiles; skipping',
    );
  }

  const pkgs = extractPkgsFromYarnLockV2(yarnLockContent);
  const pkgJson: PackageJsonBase = parsePkgJson(
    honorAliases ? rewriteAliasesPkgJson(pkgJsonContent) : pkgJsonContent,
  );

  const depgraph = await buildDepGraphYarnLockV2Simple(
    pkgs,
    pkgJson,
    {
      includeDevDeps,
      strictOutOfSync,
      includeOptionalDeps,
      pruneWithinTopLevelDeps,
      showNpmScope,
    },
    workspaceArgs,
  );

  return depgraph;
};
