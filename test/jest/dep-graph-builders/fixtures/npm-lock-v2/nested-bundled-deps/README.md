# Nested Bundled Dependencies Test Fixture

⚠️ **This is a manually created synthetic test fixture.** The packages and versions are not real npm packages. This fixture was created specifically to test bundled dependency resolution.

🚫 **DO NOT run `npm install` in this directory.** The package.json includes a preinstall script that will error if you attempt to install. The dependencies listed do not exist in the npm registry.

This minimal fixture tests the resolution of bundled dependencies when the bundle owner is not hoisted to the root level.

## Structure

```
test-app (root)
└── @myorg/wrapper-tool (not hoisted)
    └── builder-tool (has bundledDependencies)
        ├── semver (bundled)
        │   └── lru-cache (bundled, nested)
        │       └── yallist (bundled, deeply nested)
        └── chalk (bundled)
            ├── ansi-styles (bundled, nested)
            │   └── color-convert (bundled, deeply nested)
            │       └── color-name (bundled, deeply nested)
            └── supports-color (bundled, nested)
                └── has-flag (bundled, deeply nested)
```

## What It Tests

### 1. Non-Hoisted Bundle Owner

Unlike packages hoisted to `node_modules/`, `builder-tool` is nested under `@myorg/wrapper-tool`. This tests that the algorithm correctly includes the non-bundled parent in the ancestry check.

**Lockfile path**:

```
node_modules/@myorg/wrapper-tool/node_modules/builder-tool/node_modules/semver/node_modules/lru-cache
```

The `@myorg/wrapper-tool` part MUST be included in the ancestry check.

### 2. Nested Bundled Dependencies

Tests that bundled dependencies can have their own dependencies that are also bundled:

- `builder-tool` declares bundled dependencies
- `semver` (bundled) depends on `lru-cache` (also bundled)
- `lru-cache` depends on `yallist` (also bundled)

### 3. Multiple Bundled Dependency Trees

The fixture includes two bundled dependency subtrees (`semver` and `chalk`) to verify the algorithm handles multiple branches correctly.

### 4. Deep Nesting

With 4-5 levels of nesting, this tests that the algorithm can handle deeply nested bundled structures without performance issues.

## Key Algorithm Challenge

When resolving `lru-cache` from within `semver`, the algorithm must:

1. **Include full ancestry**: `[@myorg/wrapper-tool, builder-tool, semver, lru-cache]`
2. **Validate bundle owner**: Verify `builder-tool` is in the candidate path
3. **Handle lockfile path**: Match against `node_modules/@myorg/wrapper-tool/node_modules/builder-tool/node_modules/semver/node_modules/lru-cache`
4. **Prefer correct candidate**: Choose the bundled one over any hoisted versions

This tests the exact scenario that was failing before the fix.

## Comparison to Other Fixtures

- **goof**: Bundle owner hoisted to root (`node_modules/nyc/...`)
- **nested-bundled-deps**: Bundle owner NOT hoisted (`node_modules/@myorg/wrapper-tool/node_modules/builder-tool/...`)

Both patterns must work correctly to handle real-world package structures.
