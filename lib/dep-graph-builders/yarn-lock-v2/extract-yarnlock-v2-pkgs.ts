import { load, FAILSAFE_SCHEMA } from 'js-yaml';
import * as yarnCore from '@yarnpkg/core';
import { yarnLockFileKeyNormalizer } from './utils';

export const extractPkgsFromYarnLockV2 = (yarnLockContent: string) => {
  const rawYarnLock: any = load(yarnLockContent, {
    json: true,
    schema: FAILSAFE_SCHEMA,
  });
  delete rawYarnLock.__metadata;
  const dependencies: any = {};

  const structUtils = yarnCore.structUtils;
  const parseDescriptor = structUtils.parseDescriptor;
  const parseRange = structUtils.parseRange;

  const keyNormalizer = yarnLockFileKeyNormalizer(parseDescriptor, parseRange);

  Object.entries(rawYarnLock).forEach(
    ([fullDescriptor, versionData]: [string, any]) => {
      keyNormalizer(fullDescriptor).forEach((descriptor) => {
        dependencies[descriptor] = versionData;
      });
    },
  );
  console.log(dependencies);
};
