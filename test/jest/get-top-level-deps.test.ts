import { getTopLevelDeps, ManifestFile } from '../../lib/parsers';

describe('getTopLevelDeps', () => {
  describe('yarn2', () => {
    it('applies resolutions correctly - simple resolution', () => {
      const yarn2SimpleResolutionsManifest: ManifestFile = require('../fixtures/yarn2/simple-resolutions/package.json');

      const topLevelDeps = getTopLevelDeps({
        targetFile: yarn2SimpleResolutionsManifest,
        includeDev: false,
        applyYarn2Resolutions: true,
      });

      const expectedTopLevelDeps = require('../fixtures/yarn2/simple-resolutions/expected-top-level-deps.json');

      expect(topLevelDeps).toStrictEqual(expectedTopLevelDeps);
    });

    it('applies resolutions correctly - applicable scoped resolution', () => {
      const yarn2SimpleResolutionsManifest: ManifestFile = require('../fixtures/yarn2/scoped-resolutions/applicable-resolutions/package.json');

      const topLevelDeps = getTopLevelDeps({
        targetFile: yarn2SimpleResolutionsManifest,
        includeDev: false,
        applyYarn2Resolutions: true,
      });

      const expectedTopLevelDeps = require('../fixtures/yarn2/scoped-resolutions/applicable-resolutions/expected-top-level-deps.json');

      expect(topLevelDeps).toStrictEqual(expectedTopLevelDeps);
    });

    it('applies resolutions correctly - inapplicable scoped resolution', () => {
      const yarn2SimpleResolutionsManifest: ManifestFile = require('../fixtures/yarn2/scoped-resolutions/inapplicable-resolutions/package.json');

      const topLevelDeps = getTopLevelDeps({
        targetFile: yarn2SimpleResolutionsManifest,
        includeDev: false,
        applyYarn2Resolutions: true,
      });

      const expectedTopLevelDeps = require('../fixtures/yarn2/scoped-resolutions/inapplicable-resolutions/expected-top-level-deps.json');

      expect(topLevelDeps).toStrictEqual(expectedTopLevelDeps);
    });

    it('applies resolutions correctly - applicable scoped resolution with a scoped pkg', () => {
      const yarn2SimpleResolutionsManifest: ManifestFile = require('../fixtures/yarn2/scoped-resolutions/applicable-resolutions-with-scoped-pkg/package.json');

      const topLevelDeps = getTopLevelDeps({
        targetFile: yarn2SimpleResolutionsManifest,
        includeDev: false,
        applyYarn2Resolutions: true,
      });

      const expectedTopLevelDeps = require('../fixtures/yarn2/scoped-resolutions/applicable-resolutions-with-scoped-pkg/expected-top-level-deps.json');

      expect(topLevelDeps).toStrictEqual(expectedTopLevelDeps);
    });

    it('applies resolutions correctly - inapplicable scoped resolution', () => {
      const yarn2SimpleResolutionsManifest: ManifestFile = require('../fixtures/yarn2/scoped-resolutions/inapplicable-resolutions-with-scoped-pkg/package.json');

      const topLevelDeps = getTopLevelDeps({
        targetFile: yarn2SimpleResolutionsManifest,
        includeDev: false,
        applyYarn2Resolutions: true,
      });

      const expectedTopLevelDeps = require('../fixtures/yarn2/scoped-resolutions/inapplicable-resolutions-with-scoped-pkg/expected-top-level-deps.json');

      expect(topLevelDeps).toStrictEqual(expectedTopLevelDeps);
    });
  });
});
