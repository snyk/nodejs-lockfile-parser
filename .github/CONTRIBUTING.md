# Contributing

## Contributor Agreement
A pull-request will only be considered for merging into the upstream codebase after you have signed our [contributor agreement](https://github.com/snyk/nodejs-lockfile-parser/master/Contributor-Agreement.md), assigning us the rights to the contributed code and granting you a license to use it in return. If you submit a pull request, you will be prompted to review and sign the agreement with one click (we use [CLA assistant](https://cla-assistant.io/)).

## Commit messages

Commit messages must follow the [Angular-style](https://github.com/angular/angular.js/blob/master/CONTRIBUTING.md#commit-message-format) commit format (but excluding the scope).

i.e:

```text
fix: minified scripts being removed

Also includes tests
```

This will allow for the automatic changelog to generate correctly.

### Commit types

Must be one of the following:

* **feat**: A new feature
* **fix**: A bug fix
* **docs**: Documentation only changes
* **test**: Adding missing tests
* **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation
* **refactor**: A code change that neither fixes a bug nor adds a feature
* **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
* **perf**: A code change that improves performance

To release a major you need to add `BREAKING CHANGE: ` to the start of the body and the detail of the breaking change.

## Code standards

Ensure that your code adheres to the included `.eslintrc.json` config by running `npm run lint`.

## Sending pull requests

- new command line options are generally discouraged unless there's a *really* good reason
- add tests for newly added code (and try to mirror directory and file structure if possible)
- spell check
- PRs will not be code reviewed unless all tests are passing

*Important:* when fixing a bug, please commit a **failing test** first so that Travis CI (or I can) can show the code failing. Once that commit is in place, then commit the bug fix, so that we can test *before* and *after*.

Remember that you're developing for multiple platforms and versions of node, so if the tests pass on your Mac or Linux or Windows machine, it *may* not pass elsewhere.

## Testing

### NPM lockfile v2 tests

NPM lockfile v2 tests are implemented in [test/jest/dep-graph-builders/npm-lock-v2.test.ts](test/jest/dep-graph-builders/npm-lock-v2.test.ts)
with fixtures in [test/jest/dep-graph-builders/fixtures/npm-lock-v2](test/jest/dep-graph-builders/fixtures/npm-lock-v2).
A fixture should have `package.json`, `package-lock.json` and either `expected-npm-ls.txt` or `expected.json` (or both).
The `expected-npm-ls.txt` file is just output from running `npm ls` command.
It is used to compare the output of this library parsing and the dependency tree that `npm ls` prints.
To create the `expected-npm-ls.txt` file, you first need to install the packages with `npm install` and then dump the `npm ls` output:

```
npm ls --all --omit-dev > expected-npm-ls.txt
```
