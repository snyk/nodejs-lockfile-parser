import { parseDescriptor, parseRange } from '../../parsers/yarn-structs';
import { yarnLockFileKeyNormalizer } from './utils';
import { NormalisedPkgs } from '../types';
import { loadYamlOrNull } from '../../utils';
import { InvalidUserInputError } from '../../errors';

const keyNormalizer = yarnLockFileKeyNormalizer(parseDescriptor, parseRange);

export const extractPkgsFromYarnLockV2 = (
  yarnLockContent: string,
): NormalisedPkgs => {
  const rawYarnLock = loadYamlOrNull<any>(yarnLockContent);
  // A lockfile that parses to anything other than a mapping (empty,
  // comment-only, or a bare document separator) is rejected loudly rather
  // than silently yielding an empty package map.
  if (!rawYarnLock || typeof rawYarnLock !== 'object') {
    throw new InvalidUserInputError(
      'yarn.lock parsing failed: the file is empty or does not contain a YAML mapping',
    );
  }
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
