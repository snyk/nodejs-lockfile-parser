import { structUtils } from '@yarnpkg/core';
import * as _flatMap from 'lodash.flatmap';
import { OutOfSyncError } from '../../errors';
import { LockfileType } from '../../parsers';
import { NormalisedPkgs, WorkspacePackageManifest } from '../types';
import { Dependencies, getGraphDependencies, PkgNode } from '../util';
import * as semver from 'semver';
import * as debugModule from 'debug';

const debug = debugModule('snyk-nodejs-plugin');

const BUILTIN_PLACEHOLDER = 'builtin';
const MULTIPLE_KEYS_REGEXP = / *, */g;

export type ParseDescriptor = typeof structUtils.parseDescriptor;
export type ParseRange = typeof structUtils.parseRange;

const keyNormalizer =
  (parseDescriptor: ParseDescriptor, parseRange: ParseRange) =>
  (rawDescriptor: string): string[] => {
    // See https://yarnpkg.com/features/protocols
    const descriptors: string[] = [rawDescriptor];
    const descriptor = parseDescriptor(rawDescriptor);
    const name = `${descriptor.scope ? '@' + descriptor.scope + '/' : ''}${
      descriptor.name
    }`;
    const range = parseRange(descriptor.range);
    const protocol = range.protocol;
    switch (protocol) {
      case 'npm:':
      case 'file:':
        // This is space inneficient but will be kept for now,
        // Due to how we wish to index using the dependencies map
        // we want the keys to match name@version but this is handled different
        // for npm alias and normal install.
        descriptors.push(`${name}@${range.selector}`);
        descriptors.push(`${name}@${protocol}${range.selector}`);
        break;
      case 'git:':
      case 'git+ssh:':
      case 'git+http:':
      case 'git+https:':
      case 'github:':
        if (range.source) {
          descriptors.push(
            `${name}@${protocol}${range.source}${
              range.selector ? '#' + range.selector : ''
            }`,
          );
        } else {
          descriptors.push(`${name}@${protocol}${range.selector}`);
        }
        break;
      case 'patch:':
        if (range.source && range.selector.indexOf(BUILTIN_PLACEHOLDER) === 0) {
          descriptors.push(range.source);
        } else {
          descriptors.push(
            `${name}@${protocol}${range.source}${
              range.selector ? '#' + range.selector : ''
            }`,
          );
        }
        break;
      case null:
      case undefined:
        if (range.source) {
          descriptors.push(`${name}@${range.source}#${range.selector}`);
        } else {
          descriptors.push(`${name}@${range.selector}`);
        }
        break;
      case 'http:':
      case 'https:':
      case 'link:':
      case 'portal:':
      case 'exec:':
      case 'workspace:':
      case 'virtual:':
      default:
        // For user defined plugins
        descriptors.push(`${name}@${protocol}${range.selector}`);
        break;
    }
    return descriptors;
  };

export type YarnLockFileKeyNormalizer = (fullDescriptor: string) => Set<string>;

export const yarnLockFileKeyNormalizer =
  (
    parseDescriptor: ParseDescriptor,
    parseRange: ParseRange,
  ): YarnLockFileKeyNormalizer =>
  (fullDescriptor: string) => {
    const allKeys = fullDescriptor
      .split(MULTIPLE_KEYS_REGEXP)
      .map(keyNormalizer(parseDescriptor, parseRange));
    return new Set<string>(_flatMap(allKeys));
  };

/**
 * Yarn Berry merges a workspace package's dependencies, devDependencies and peerDependencies
 * into a single `dependencies` block in yarn.lock, so the dev marker is lost. When such a
 * workspace package is consumed as a production dependency, walking that merged block would
 * promote its dev-only tooling (e.g. webpack, babel) into the production graph.
 *
 * Given the consumed workspace member's own package.json (via `workspaceManifest`), drop the
 * dev-only entries: names that appear in devDependencies but not in dependencies /
 * optionalDependencies / peerDependencies (prod wins on overlap).
 */
const pruneWorkspaceDevDependencies = (
  deps: Dependencies,
  workspaceManifest: WorkspacePackageManifest,
): Dependencies => {
  const nonDev = new Set<string>([
    ...Object.keys(workspaceManifest.dependencies || {}),
    ...Object.keys(workspaceManifest.optionalDependencies || {}),
    ...Object.keys(workspaceManifest.peerDependencies || {}),
  ]);
  const dev = new Set<string>(
    Object.keys(workspaceManifest.devDependencies || {}),
  );

  return Object.entries(deps).reduce((acc: Dependencies, [name, depInfo]) => {
    // Drop only names that are exclusively devDependencies of the workspace member.
    if (dev.has(name) && !nonDev.has(name)) {
      return acc;
    }
    acc[name] = depInfo;
    return acc;
  }, {});
};

export const getYarnLockV2ChildNode = (
  name: string,
  depInfo: {
    version: string;
    isDev: boolean;
    alias?: {
      aliasName: string;
      aliasTargetDepName: string;
      semver: string;
      version: string;
    };
  },
  pkgs: NormalisedPkgs,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
  resolutions: Record<string, string>,
  parentNode: PkgNode,
  includeDevDeps = false,
  workspacePackages?: Record<string, WorkspacePackageManifest>,
) => {
  // First, check if a resolution would be used
  const resolvedVersionFromResolution = (() => {
    // Check for scoped resolution (e.g., "parentPackageName/dependencyName")
    const scopedKey = `${parentNode.name}/${name}`;
    if (resolutions[scopedKey]) {
      return resolutions[scopedKey];
    }

    // Check for scoped + versioned resolution (e.g., "parentPkg@npm:version/depName")
    // These have the format: parentPackageName@versionOrProtocol/dependencyName
    // The dep name suffix could be scoped (e.g., "@scope/dep"), so we check
    // if the key ends with `/${name}` to correctly split parent from dep.
    const suffix = `/${name}`;
    for (const resKey in resolutions) {
      if (Object.prototype.hasOwnProperty.call(resolutions, resKey)) {
        if (!resKey.endsWith(suffix)) continue;
        const parentPart = resKey.substring(0, resKey.length - suffix.length);
        // Skip if parentPart is just a plain name (handled by simple scoped check above)
        if (!parentPart.includes('@') || parentPart === parentNode.name) {
          continue;
        }
        try {
          const descriptor = structUtils.parseDescriptor(parentPart);
          const parentPkgName = structUtils.stringifyIdent(descriptor);
          if (parentPkgName !== parentNode.name) continue;
          // If the resolution key includes a version/range for the parent,
          // verify the parent's resolved version satisfies it
          if (descriptor.range && descriptor.range !== 'unknown') {
            const rangeWithoutProtocol = descriptor.range.replace(
              /^[a-z]+:/,
              '',
            );
            if (
              parentNode.version !== rangeWithoutProtocol &&
              !(
                semver.valid(parentNode.version) &&
                semver.validRange(rangeWithoutProtocol) &&
                semver.satisfies(parentNode.version, rangeWithoutProtocol)
              )
            ) {
              continue;
            }
          }
          return resolutions[resKey];
        } catch (e) {
          debug(
            `Error parsing scoped-versioned resolution key(${resKey}): ${e}`,
          );
        }
      }
    }

    // Check for resolutions matching "packageName@versionOrRangeToOverride"
    for (const resKey in resolutions) {
      if (Object.prototype.hasOwnProperty.call(resolutions, resKey)) {
        try {
          const descriptor = structUtils.parseDescriptor(resKey);
          const resKeyPkgName = structUtils.stringifyIdent(descriptor);

          // Check if the resolution key targets the current package name
          if (resKeyPkgName === name) {
            if (descriptor.range && descriptor.range !== 'unknown') {
              // Strip protocol prefix from both sides (e.g., 'npm:^3.5.4' -> '^3.5.4')
              const versionWithoutProtocol = depInfo.version.replace(
                /^[a-z]+:/,
                '',
              );
              const rangeWithoutProtocol = descriptor.range.replace(
                /^[a-z]+:/,
                '',
              );
              // Check if the current dependency's version/range matches or satisfies
              // the version/range specified in the resolution key.
              // If the dependency version is a concrete version (e.g., '3.5.4'),
              // check if it satisfies the resolution range.
              // If the dependency version is a range (e.g., '^3.5.4'), check for equality.
              if (
                versionWithoutProtocol === rangeWithoutProtocol ||
                (semver.valid(versionWithoutProtocol) &&
                  semver.satisfies(
                    versionWithoutProtocol,
                    rangeWithoutProtocol,
                  ))
              ) {
                return resolutions[resKey];
              }
            }
          }
        } catch (e) {
          debug(`Error parsing resolution key(${resKey}): ${e}$`);
        }
      }
    }
    // Check for global resolution by package name (e.g., "packageName": "version")
    if (resolutions[name]) {
      return resolutions[name];
    }
    return ''; // No resolution applies
  })();

  if (resolvedVersionFromResolution) {
    // Decode URL-encoded characters in resolution values (e.g., npm%3A -> npm:)
    // to match the keys extracted from yarn.lock
    const decodedResolution = decodeURIComponent(resolvedVersionFromResolution);
    const childNodeKeyFromResolution = `${name}@${decodedResolution}`;
    if (!pkgs[childNodeKeyFromResolution]) {
      if (strictOutOfSync && !/^file:/.test(decodedResolution)) {
        throw new OutOfSyncError(
          childNodeKeyFromResolution,
          LockfileType.yarn2,
        );
      } else {
        return {
          id: childNodeKeyFromResolution,
          name: depInfo.alias ? depInfo.alias.aliasTargetDepName : name,
          version: decodedResolution,
          dependencies: {},
          isDev: depInfo.isDev,
          missingLockFileEntry: true,
          ...(depInfo.alias
            ? {
                alias: {
                  ...depInfo.alias,
                  version: decodedResolution,
                },
              }
            : {}),
        };
      }
    }

    const pkgData = pkgs[childNodeKeyFromResolution];

    const {
      version: versionFromResolution,
      dependencies,
      optionalDependencies,
    } = pkgData;

    let formattedDependencies = getGraphDependencies(dependencies || {}, {
      isDev: depInfo.isDev,
    });
    const formattedOptionalDependencies = includeOptionalDeps
      ? getGraphDependencies(optionalDependencies || {}, {
          isDev: depInfo.isDev,
          isOptional: true,
        })
      : {};

    const workspaceManifestFromResolution = workspacePackages?.[name];
    if (
      !includeDevDeps &&
      workspaceManifestFromResolution &&
      pkgData.resolution?.includes('@workspace:')
    ) {
      formattedDependencies = pruneWorkspaceDevDependencies(
        formattedDependencies,
        workspaceManifestFromResolution,
      );
    }

    return {
      id: `${name}@${versionFromResolution}`,
      name: depInfo.alias ? depInfo.alias.aliasTargetDepName : name,
      version: versionFromResolution,
      dependencies: {
        ...formattedOptionalDependencies,
        ...formattedDependencies,
      },
      isDev: depInfo.isDev,
      ...(depInfo.alias
        ? { alias: { ...depInfo.alias, version: versionFromResolution } }
        : {}),
    };
  }

  // No resolutions
  const childNodeKey = `${name}@${depInfo.version}`;
  if (!pkgs[childNodeKey]) {
    if (strictOutOfSync && !/^file:/.test(depInfo.version)) {
      throw new OutOfSyncError(childNodeKey, LockfileType.yarn2);
    } else {
      return {
        id: childNodeKey,
        name: depInfo.alias ? depInfo.alias.aliasTargetDepName : name,
        version: depInfo.version,
        dependencies: {},
        isDev: depInfo.isDev,
        missingLockFileEntry: true,
        ...(depInfo.alias
          ? { alias: { ...depInfo.alias, version: depInfo.version } }
          : {}),
      };
    }
  } else {
    const depData = pkgs[childNodeKey];
    let dependencies = getGraphDependencies(depData.dependencies || {}, {
      isDev: depInfo.isDev,
    });
    const optionalDependencies = includeOptionalDeps
      ? getGraphDependencies(depData.optionalDependencies || {}, {
          isDev: depInfo.isDev,
          isOptional: true,
        })
      : {};

    const workspaceManifest = workspacePackages?.[name];
    if (
      !includeDevDeps &&
      workspaceManifest &&
      depData.resolution?.includes('@workspace:')
    ) {
      dependencies = pruneWorkspaceDevDependencies(
        dependencies,
        workspaceManifest,
      );
    }

    return {
      id: `${name}@${depData.version}`,
      name: depInfo.alias ? depInfo.alias.aliasTargetDepName : name,
      version: depData.version,
      dependencies: { ...dependencies, ...optionalDependencies },
      isDev: depInfo.isDev,
      ...(depInfo.alias
        ? { alias: { ...depInfo.alias, version: depData.version } }
        : {}),
    };
  }
};
