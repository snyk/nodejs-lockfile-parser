import { load, FAILSAFE_SCHEMA } from 'js-yaml';
import { PnpmLock } from '../types';

export const parsePnpmLock = (pnmpLockContent: string): PnpmLock => {
  return load(pnmpLockContent, {
    json: true,
    schema: FAILSAFE_SCHEMA,
  });
};
