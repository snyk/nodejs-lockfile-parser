export interface NpmListTreeNode {
  name: string;
  version: string;
  deduped: boolean;
  deps: NpmListTreeNode[];
}
