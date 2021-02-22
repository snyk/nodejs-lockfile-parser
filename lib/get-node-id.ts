type NodeId = string;
export type NodeIdMap = Record<NodeId, number>;

export function getNodeId(
  nodeIdMap: NodeIdMap,
  name: string,
  version: string = '',
) {
  const nodeId = `${name}@${version}`;
  if (!nodeIdMap[nodeId]) {
    nodeIdMap[nodeId] = 1;
    return nodeId;
  }
  return `${nodeId}|${nodeIdMap[nodeId]++}`;
}
