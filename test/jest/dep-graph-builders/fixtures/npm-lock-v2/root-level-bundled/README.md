# Root-Level Bundled Dependencies Test Fixture

This fixture tests the edge case where the project being scanned (root) declares `bundleDependencies` in its own package.json.

## Structure

```
root-level-bundled-test (the project being scanned)
├── package.json declares: bundleDependencies: ["bundled-at-root"]
└── dependencies:
    └── bundled-at-root (inBundle: true, direct dependency of project)
        └── nested-dep (inBundle: true, nested within bundled)
```

## What This Tests

### Edge Case: Project Root Bundles Its Own Dependencies

While uncommon for application projects, a project can declare that certain dependencies should be bundled within it when published. This typically happens when:

- The project is a library that will be published to npm
- The library wants to ship with dependencies pre-packaged
- Ensuring specific versions are locked for distribution

**Key difference from other fixtures:**

- The bundle owner is the project itself (at ancestry index 0)
- Not a nested dependency package that bundles things
- First bundled item appears at `node_modules/bundled-at-root`

### How the Algorithm Handles This

When resolving `nested-dep` from within `bundled-at-root`:

**Ancestry structure:**

```
ancestry = [ROOT_NODE (project itself), bundled-at-root]
            index 0                     index 1 (inBundle: true)
```

**Algorithm behavior:**

1. **Slice from index 1**: `ancestry.slice(1)` gives us `[bundled-at-root]`

   - This is correct - we skip the special ROOT_NODE marker
   - Include all real packages in the dependency chain

2. **Bundle owner detection**:

   - First bundled item is at index 1
   - Look back to index 0 (the ROOT_NODE/project)
   - Check if project declares `bundledDependencies` → Yes
   - Bundle owner = the project itself

3. **Path resolution**:
   - Candidate path: `node_modules/bundled-at-root/node_modules/nested-dep`
   - Validate bundle owner is in context → Root is implicitly the owner
   - Resolution succeeds

**Result**: Even when the project itself is the bundle owner, the consistent slicing from index 1 works correctly because bundle ownership is detected separately.

## Comparison to Other Fixtures

- **bundled-top-level-dep**: Root declares bundleDependencies (same as this)
- **root-level-bundled**: Focuses on the edge case with nested bundled deps
- **nested-bundled-deps**: Bundle owner is NOT at root (non-hoisted)
- **goof**: Bundle owner IS at root but a regular package (nyc)
