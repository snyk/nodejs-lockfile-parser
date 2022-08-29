import * as yarnLockfileParser from '@yarnpkg/lockfile';
import type { YarnLockPackages } from './types';

export const extractPkgsFromYarnLockV1 = (
  yarnLockContent: string,
): YarnLockPackages => {
  return yarnLockfileParser.parse(yarnLockContent).object;
};
