import * as graphviz from 'graphviz';
import * as path from 'path';
import * as depGraphLib from '@snyk/dep-graph';
import * as fs from 'fs';

const fixtures = path.join(__dirname, '..', 'lib', 'fixtures');

function createGraph(fixture: string): void {
  const graphPath = path.join(fixtures, fixture, 'expected-dep-graph.json');
  if(!fs.existsSync(graphPath)) {
    throw new Error('Could not find ' + graphPath);
  }
  const depGraph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
  
  const g = graphviz.digraph("G");

  for(const node of depGraph.graph.nodes) {
    g.addNode(node.nodeId);
  }
  const edges: string[] = [];
  for(const node of depGraph.graph.nodes) {
    for(const dep of node.deps) {
      edges.push(`${node.nodeId}>${dep.nodeId}`);
      const line = {"color" : "black"};
      if(edges.find((edge) => edge === `${dep.nodeId}>${node.nodeId}`)) {
        line.color = "yellow";
      }
      g.addEdge(node.nodeId, dep.nodeId, line);
    }
  }

  // Set GraphViz path (if not in your path)
  // You need graphviz installed:
  // brew install graphviz
  g.setGraphVizPath("/usr/local/bin");

  g.output("png", `${__dirname}/${fixture}.png`);
}

if (require.main === module) {
  const flag = '--fixture=';
  const arg = process.argv.find((arg) => arg.startsWith(flag))
  if(!arg) {
    throw new Error('Missing arg, use --fixture=abc');
  }
  const fixture = arg.substr(arg.indexOf(flag) + flag.length, arg.length);
  if(!fixture) {
    throw new Error('Missing value for --fixture, use --fixture=abc');
  }
  createGraph(fixture);
}