import { PkgIdentifier } from '../types';
import { Dependencies } from '../util';

export type PnpmDepPath = string;
export type PnpmLockPkg = {
  name?: string;
  version?: string;
  id?: string;
  dev: boolean;
  optional?: boolean;
  dependencies: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  os?: string;
  cpu?: string;
  deprecated?: boolean;
  bundledDependencies?: Record<string, string>;
  requiresBuild?: boolean;
  prepare?: boolean;
  hasBin?: boolean;
};

export type NormalisedPnpmPkg = {
  name: string;
  version: string;
  id: string;
  isDev: boolean;
  dependencies: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

export type PnpmNode = {
  name: string;
  version: string;
  id: string;
  isDev: boolean;
  dependencies: Dependencies;
  optionalDependencies?: Dependencies;
  missingLockFileEntry?: boolean;
};

export type NormalisedPnpmPkgs = Record<PkgIdentifier, NormalisedPnpmPkg>;

export type PnpmDeps = Record<
  string,
  {
    name: string;
    version: string;
    specifier?: string;
    isDev: boolean;
  }
>;

export type ParsedDepPath = {
  name?: string;
  version?: string;
};
