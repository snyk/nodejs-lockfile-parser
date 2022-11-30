import { load, FAILSAFE_SCHEMA } from 'js-yaml';
import * as yarnCore from '@yarnpkg/core';
import { yarnLockFileKeyNormalizer } from './utils';
import { NormalisedPkgs } from '../types';

const structUtils = yarnCore.structUtils;
const parseDescriptor = structUtils.parseDescriptor;
const parseRange = structUtils.parseRange;
const keyNormalizer = yarnLockFileKeyNormalizer(parseDescriptor, parseRange);

export const extractPkgsFromYarnLockV2 = (
  yarnLockContent: string,
): NormalisedPkgs => {
  const rawYarnLock: any = load(yarnLockContent, {
    json: true,
    schema: FAILSAFE_SCHEMA,
  });
  delete rawYarnLock.__metadata;
  const dependencies: NormalisedPkgs = {};

  Object.entries(rawYarnLock).forEach(
    ([fullDescriptor, versionData]: [string, any]) => {
      keyNormalizer(fullDescriptor).forEach((descriptor) => {
        dependencies[descriptor] = versionData;
      });
    },
  );
  return dependencies;
};
