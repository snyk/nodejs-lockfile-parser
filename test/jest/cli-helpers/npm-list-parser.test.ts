import { parseNpmListOutput } from '../../lib/cli-helpers/npm-list-parser';
import { NpmListTreeNode } from '../../lib/cli-helpers/npm-list-tree';

describe('parseNpmListOutput', () => {
  it('parses example output', () => {
    const output = `goof@0.0.3 /Users/krzy/dev/nodejs-lockfile-parser/test/jest/dep-graph-builders/fixtures/npm-lock-v2/goof
├── adm-zip@0.4.7
├─┬ body-parser@1.9.0
│ ├── bytes@1.0.0
│ ├── depd@1.0.1
│ ├── iconv-lite@0.4.4
│ ├── media-typer@0.3.0 deduped
│ └─┬ on-finished@2.1.0
│   └── ee-first@1.0.5
└── tap@5.8.0
`;
    const tree = parseNpmListOutput(output);

    expect(tree).toEqual(
      createTreeNode('goof', '0.0.3', [
        createTreeNode('adm-zip', '0.4.7'),
        createTreeNode('body-parser', '1.9.0', [
          createTreeNode('bytes', '1.0.0'),
          createTreeNode('depd', '1.0.1'),
          createTreeNode('iconv-lite', '0.4.4'),
          createTreeNode('media-typer', '0.3.0', [], true),
          createTreeNode('on-finished', '2.1.0', [
            createTreeNode('ee-first', '1.0.5'),
          ]),
        ]),
        createTreeNode('tap', '5.8.0'),
      ]),
    );
  });
});

function createTreeNode(
  name: string,
  version: string,
  deps: NpmListTreeNode[] = [],
  deduped: boolean = false,
): NpmListTreeNode {
  return {
    name,
    version,
    deps,
    deduped: deduped,
  };
}
