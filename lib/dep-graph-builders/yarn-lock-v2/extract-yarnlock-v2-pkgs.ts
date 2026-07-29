import { parseDescriptor, parseRange } from '../../parsers/yarn-structs';
import { yarnLockFileKeyNormalizer } from './utils';
import { NormalisedPkgs } from '../types';
import { loadYamlMappingOrThrow } from '../../utils';

const keyNormalizer = yarnLockFileKeyNormalizer(parseDescriptor, parseRange);

export const extractPkgsFromYarnLockV2 = (
  yarnLockContent: string,
): NormalisedPkgs => {
  const rawYarnLock = loadYamlMappingOrThrow<any>(yarnLockContent, 'yarn.lock');
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
