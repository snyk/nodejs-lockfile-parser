import * as debugModule from 'debug';

const debug = debugModule('snyk-nodejs-lockfile-parser:component-metadata');

// Maps a Subresource Integrity (SRI) algorithm token to its dep-graph label key.
// Labels use the `hash:<algorithm>` convention with hyphenated algorithm names
// (`hash:sha-512`, `hash:sha-256`, ...) and lowercase-hex values. Hex matches the CycloneDX
// hash `content` format, so downstream SBOM generation can populate CycloneDX component
// hashes / SPDX package checksums directly. SRI base64 values are decoded to lowercase hex
// below.
const SRI_ALG_TO_LABEL: Record<string, string> = {
  md5: 'hash:md5',
  sha1: 'hash:sha-1',
  sha256: 'hash:sha-256',
  sha384: 'hash:sha-384',
  sha512: 'hash:sha-512',
};

// Expected raw digest length (bytes) per algorithm. `Buffer.from(x, 'base64')` is lenient and
// will not throw on a corrupt/truncated value, so we reject anything whose decoded length does
// not match — otherwise we would emit a hex string that violates the CycloneDX `content` regex.
const SRI_ALG_BYTES: Record<string, number> = {
  md5: 16,
  sha1: 20,
  sha256: 32,
  sha384: 48,
  sha512: 64,
};

/**
 * Convert a lockfile `integrity` (SRI) string into `hash:<algorithm>` labels with
 * lowercase-hex values. Returns an empty object (and debug-logs) when the value is absent
 * or unparseable — never throws.
 */
export function hashLabelsFromIntegrity(
  integrity: string | undefined,
  nodeId: string,
): Record<string, string> {
  if (!integrity) {
    debug(`No integrity for ${nodeId}; skipping hash labels`);
    return {};
  }

  const labels: Record<string, string> = {};
  // SRI may contain multiple whitespace-separated hashes, each "<alg>-<base64>[?opts]".
  for (const token of integrity.trim().split(/\s+/)) {
    const dashIdx = token.indexOf('-');
    if (dashIdx === -1) {
      debug(`Unrecognised integrity "${token}" for ${nodeId}; skipping`);
      continue;
    }
    const alg = token.slice(0, dashIdx).toLowerCase();
    const base64 = token.slice(dashIdx + 1).split('?')[0]; // strip optional ?opts
    const key = SRI_ALG_TO_LABEL[alg];
    if (!key || !base64) {
      debug(`Unrecognised integrity "${token}" for ${nodeId}; skipping`);
      continue;
    }
    const digest = Buffer.from(base64, 'base64');
    if (digest.length !== SRI_ALG_BYTES[alg]) {
      debug(
        `Integrity "${token}" for ${nodeId} decoded to ${digest.length} bytes, ` +
          `expected ${SRI_ALG_BYTES[alg]} for ${alg}; skipping`,
      );
      continue;
    }
    labels[key] = digest.toString('hex');
  }

  return labels;
}

/**
 * Produce a `distribution:url` label from a lockfile `resolved` value when it is an
 * http(s) tarball URL. `resolved` can also be a `file:`/workspace path for local deps;
 * those are debug-logged and skipped.
 */
export function distributionUrlLabel(
  resolved: string | undefined,
  nodeId: string,
): Record<string, string> {
  if (!resolved) {
    debug(`No resolved URL for ${nodeId}; skipping distribution:url label`);
    return {};
  }
  if (!/^https?:\/\//.test(resolved)) {
    debug(
      `resolved "${resolved}" for ${nodeId} is not an http(s) URL; skipping distribution:url label`,
    );
    return {};
  }
  return { 'distribution:url': resolved };
}

/**
 * Build the full set of component-metadata labels (package hashes + distribution URL) for a
 * node, sourced from its lockfile `integrity` / `resolved` values.
 */
export function getComponentMetadataLabels(node: {
  id: string;
  integrity?: string;
  resolved?: string;
}): Record<string, string> {
  return {
    ...hashLabelsFromIntegrity(node.integrity, node.id),
    ...distributionUrlLabel(node.resolved, node.id),
  };
}
