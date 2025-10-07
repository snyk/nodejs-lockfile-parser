/**
 * TypeScript types for help.json file structure
 * This represents the output format of `npm list --all --json --package-lock-only`
 */

export interface NpmDependency {
  /** The version of the package */
  version: string;
  /** The resolved URL where the package was downloaded from */
  resolved: string;
  /** Whether this dependency was overridden */
  overridden: boolean;
  /** Nested dependencies (optional) */
  dependencies?: Record<string, NpmDependency>;
}

export interface NpmListOutput {
  /** The name of the root package */
  name: string;
  /** The version of the root package */
  version?: string;
  /** Top-level dependencies */
  dependencies: Record<string, NpmDependency>;
}

/**
 * Type guard to check if an object is a valid NpmDependency
 */
export function isNpmDependency(obj: any): obj is NpmDependency {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.version === 'string' &&
    typeof obj.resolved === 'string' &&
    typeof obj.overridden === 'boolean' &&
    (obj.dependencies === undefined ||
      (typeof obj.dependencies === 'object' && obj.dependencies !== null))
  );
}

/**
 * Type guard to check if an object is a valid NpmListOutput
 */
export function isNpmListOutput(obj: any): obj is NpmListOutput {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.name === 'string' &&
    typeof obj.dependencies === 'object' &&
    obj.dependencies !== null
  );
}
