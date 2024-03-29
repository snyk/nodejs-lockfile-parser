import { PkgIdentifier } from '../types';

/**
 *
 */
export type PnpmNormalisedPkgs = Record<
  PkgIdentifier,
  {
    version: string; // This is resolved version
    dependencies: Record<string, string>;
    optionalDependencies: Record<string, string>;
    dev: boolean;
  }
>;

/**
 *
 */
export type PnpmNormalisedProject = Record<string, PnpmNormalisedPkgs>;
