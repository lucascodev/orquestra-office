const SAME_POINT = 0.001;

const always = () => true;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const isSamePoint = (a, b) => distance(a, b) < SAME_POINT;

function nodeIndexOf(nodes, point) {
  const found = nodes.findIndex((node) => isSamePoint(node, point));
  if (found !== -1) return found;
  nodes.push({ x: point.x, z: point.z });
  return nodes.length - 1;
}

function projectionOn(point, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared));
  return { x: a.x + t * dx, z: a.z + t * dz, t };
}

// A path that ends in the middle of another one meets it there: the other is split at that point.
function nodesAlong(nodes, from, to) {
  const inside = nodes
    .map((node, index) => ({ index, ...projectionOn(node, nodes[from], nodes[to]), node }))
    .filter(({ index, t, node, x, z }) => index !== from && index !== to && t > 0 && t < 1 && isSamePoint(node, { x, z }))
    .sort((a, b) => a.t - b.t)
    .map(({ index }) => index);
  return [from, ...inside, to];
}

export function walkGraphOf(paths) {
  const nodes = [];
  const segments = paths.flatMap((path) => {
    const indexes = path.map((point) => nodeIndexOf(nodes, point));
    return indexes.slice(1).map((to, i) => [indexes[i], to]);
  });
  const edges = [];
  const seen = new Set();
  for (const [from, to] of segments) {
    const chain = nodesAlong(nodes, from, to);
    for (let i = 1; i < chain.length; i += 1) {
      const edge = [Math.min(chain[i - 1], chain[i]), Math.max(chain[i - 1], chain[i])];
      const id = edge.join("|");
      if (edge[0] === edge[1] || seen.has(id)) continue;
      seen.add(id);
      edges.push(edge);
    }
  }
  const neighbors = nodes.map(() => []);
  for (const [a, b] of edges) {
    const length = distance(nodes[a], nodes[b]);
    neighbors[a].push({ node: b, length });
    neighbors[b].push({ node: a, length });
  }
  return { nodes, edges, neighbors };
}

export function nearestOnGraph(graph, point, isClear = always) {
  let best = null;
  for (const [a, b] of graph.edges) {
    const { x, z } = projectionOn(point, graph.nodes[a], graph.nodes[b]);
    const gap = distance(point, { x, z });
    if ((best && gap >= best.gap) || !isClear(point, { x, z })) continue;
    best = { x, z, edge: [a, b], gap };
  }
  return best && { x: best.x, z: best.z, edge: best.edge };
}

function shortestFrom(graph, sources) {
  const reach = graph.nodes.map(() => Infinity);
  const previous = graph.nodes.map(() => null);
  const done = new Set();
  for (const [node, length] of sources) reach[node] = Math.min(reach[node], length);
  for (;;) {
    let current = -1;
    reach.forEach((length, node) => {
      if (!done.has(node) && length < Infinity && (current === -1 || length < reach[current])) current = node;
    });
    if (current === -1) return { reach, previous };
    done.add(current);
    for (const { node, length } of graph.neighbors[current]) {
      if (reach[current] + length < reach[node]) {
        reach[node] = reach[current] + length;
        previous[node] = current;
      }
    }
  }
}

function chainTo(previous, node) {
  const chain = [];
  for (let at = node; at !== null; at = previous[at]) chain.unshift(at);
  return chain;
}

function withoutRepeats(points) {
  return points.reduce((kept, point) => (kept.length > 0 && isSamePoint(kept.at(-1), point) ? kept : [...kept, { x: point.x, z: point.z }]), []);
}

const isSameEdge = (a, b) => a[0] === b[0] && a[1] === b[1];

export function shortestWalk(graph, from, to, isClear = always) {
  const start = nearestOnGraph(graph, from, isClear);
  const end = nearestOnGraph(graph, to, isClear);
  if (!start || !end) return [];
  if (isSameEdge(start.edge, end.edge)) return withoutRepeats([start, end]);
  const { reach, previous } = shortestFrom(graph, start.edge.map((node) => [node, distance(start, graph.nodes[node])]));
  const [via] = end.edge
    .map((node) => ({ node, length: reach[node] + distance(graph.nodes[node], end) }))
    .sort((a, b) => a.length - b.length);
  if (via.length === Infinity) return [];
  return withoutRepeats([start, ...chainTo(previous, via.node).map((node) => graph.nodes[node]), end]);
}
