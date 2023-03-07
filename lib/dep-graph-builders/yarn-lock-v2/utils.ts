import { structUtils } from '@yarnpkg/core';
import * as _flatMap from 'lodash.flatmap';
import { OutOfSyncError } from '../../errors';
import { LockfileType } from '../../parsers';
import { NormalisedPkgs } from '../types';
import { getGraphDependencies, PkgNode } from '../util';

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
  depInfo: { version: string; isDev: boolean },
  pkgs: NormalisedPkgs,
  strictOutOfSync: boolean,
  includeOptionalDeps: boolean,
  resolutions: Record<string, string>,
  parentNode: PkgNode,
) => {
  // First check if a resolution would be used
  const resolvedVersionFromResolution = (() => {
    // First check for scoped then simple
    const scopedKey = `${parentNode.name}/${name}`;
    if (resolutions[scopedKey]) {
      return resolutions[scopedKey];
    } else if (resolutions[name]) {
      return resolutions[name];
    }
    return '';
  })();

  if (resolvedVersionFromResolution) {
    const childNodeKeyFromResolution = `${name}@${resolvedVersionFromResolution}`;
    const {
      version: versionFromResolution,
      dependencies,
      optionalDependencies,
    } = pkgs[childNodeKeyFromResolution];

    const formattedDependencies = getGraphDependencies(
      dependencies || {},
      depInfo.isDev,
    );
    const formattedOptionalDependencies = includeOptionalDeps
      ? getGraphDependencies(optionalDependencies || {}, depInfo.isDev)
      : {};

    return {
      id: childNodeKeyFromResolution,
      name: name,
      version: versionFromResolution,
      dependencies: {
        ...formattedOptionalDependencies,
        ...formattedDependencies,
      },
      isDev: depInfo.isDev,
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
        name: name,
        version: depInfo.version,
        dependencies: {},
        isDev: depInfo.isDev,
        missingLockFileEntry: true,
      };
    }
  } else {
    const depData = pkgs[childNodeKey];
    const dependencies = getGraphDependencies(
      depData.dependencies || {},
      depInfo.isDev,
    );
    const optionalDependencies = includeOptionalDeps
      ? getGraphDependencies(depData.optionalDependencies || {}, depInfo.isDev)
      : {};
    return {
      id: `${name}@${depData.version}`,
      name: name,
      version: depData.version,
      dependencies: { ...dependencies, ...optionalDependencies },
      isDev: depInfo.isDev,
    };
  }
};
