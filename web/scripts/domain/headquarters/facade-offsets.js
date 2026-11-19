function depthZ({ z, fromFront, beyondFront }, depth) {
  if (fromFront !== undefined) return depth - fromFront;
  if (beyondFront !== undefined) return depth + beyondFront;
  return z;
}

export function atDepth(item, depth) {
  const { fromFront, beyondFront, untilFront, ...rest } = item;
  const z = depthZ(item, depth);
  return untilFront ? { ...rest, z, d: depth - z } : { ...rest, z };
}
