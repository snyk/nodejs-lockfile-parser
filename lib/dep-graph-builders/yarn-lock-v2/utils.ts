import { structUtils } from '@yarnpkg/core';
import * as _flatMap from 'lodash.flatmap';
import { OutOfSyncError } from '../../errors';
import { LockfileType } from '../../parsers';
import { NormalisedPkgs } from '../types';
import { getGraphDependencies, PkgNode } from '../util';
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
) => {
  // First, check if a resolution would be used
  const resolvedVersionFromResolution = (() => {
    // Check for scoped resolution (e.g., "parentPackageName/dependencyName")
    const scopedKey = `${parentNode.name}/${name}`;
    if (resolutions[scopedKey]) {
      return resolutions[scopedKey];
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
    const childNodeKeyFromResolution = `${name}@${resolvedVersionFromResolution}`;
    if (!pkgs[childNodeKeyFromResolution]) {
      if (strictOutOfSync && !/^file:/.test(resolvedVersionFromResolution)) {
        throw new OutOfSyncError(
          childNodeKeyFromResolution,
          LockfileType.yarn2,
        );
      } else {
        return {
          id: childNodeKeyFromResolution,
          name: depInfo.alias ? depInfo.alias.aliasTargetDepName : name,
          version: resolvedVersionFromResolution,
          dependencies: {},
          isDev: depInfo.isDev,
          missingLockFileEntry: true,
          ...(depInfo.alias
            ? {
                alias: {
                  ...depInfo.alias,
                  version: resolvedVersionFromResolution,
                },
              }
            : {}),
        };
      }
    }

    const {
      version: versionFromResolution,
      dependencies,
      optionalDependencies,
    } = pkgs[childNodeKeyFromResolution];

    const formattedDependencies = getGraphDependencies(dependencies || {}, {
      isDev: depInfo.isDev,
    });
    const formattedOptionalDependencies = includeOptionalDeps
      ? getGraphDependencies(optionalDependencies || {}, {
          isDev: depInfo.isDev,
          isOptional: true,
        })
      : {};

    return {
      id: childNodeKeyFromResolution,
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
    const dependencies = getGraphDependencies(depData.dependencies || {}, {
      isDev: depInfo.isDev,
    });
    const optionalDependencies = includeOptionalDeps
      ? getGraphDependencies(depData.optionalDependencies || {}, {
          isDev: depInfo.isDev,
          isOptional: true,
        })
      : {};
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
