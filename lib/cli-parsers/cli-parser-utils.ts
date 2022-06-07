import * as semver from 'semver';
import * as npa from 'npm-package-arg';

export const extractNameAndIdentifier = (
  candidate: string,
): { name: string; identifier: string } => {
  const parsed = npa(candidate);
  return { name: parsed.name, identifier: parsed.rawSpec };
};

// This function will choose an item in a particular list that satisfies the semver provided
// i.e. possibleMatches = [debug@1.2.0, debug@2.2.6] and versionToMatch = debug@~2.2.0
// will result in debug@2.2.6 - This is required as yarn list does not have the resolved semver
// in dependencies.
export const extractCorrectIdentifierBySemver = (
  possibleMatches: string[],
  versionToMatch: string,
): string => {
  const {
    name: nameToMatch,
    identifier: identifierToMatch,
  } = extractNameAndIdentifier(versionToMatch);

  const hasQualifiers = isNaN(parseInt(identifierToMatch[0]));
  if (!hasQualifiers) {
    return versionToMatch;
  }
  // Check for matching name, if only one found shortcircuit
  const match = possibleMatches
    .filter((name) => name.startsWith(nameToMatch))
    .filter((name) =>
      semver.satisfies(
        extractNameAndIdentifier(name).identifier,
        identifierToMatch,
      ),
    )
    .map((name) => ({
      name,
      identifier: extractNameAndIdentifier(name).identifier,
    }))
    .reduce((acc, item) =>
      semver.gt(item.identifier, acc.identifier) ? item : acc,
    );

  return match.name;
};
