import { THREE } from "../kit.js";

// The parts of the figures live on a layer the camera does not draw; the crowd draws them instead. Picking still reads that layer.
export const FIGURE_LAYER = 1;
const FIRST_CAPACITY = 256;
const CROWD_MATERIAL = new THREE.MeshLambertMaterial({ color: "#ffffff" });

const hasFineAncestor = (node, root) => {
  for (let current = node; current && current !== root.parent; current = current.parent) if (current.userData.isFineDetail) return true;
  return false;
};

export function isShown(node) {
  for (let current = node; current; current = current.parent) if (!current.visible) return false;
  return true;
}

function partsOf(root) {
  const parts = [];
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.layers.set(FIGURE_LAYER);
    parts.push({ mesh: node, isFine: hasFineAncestor(node, root), batchKey: `${node.geometry.uuid}|${node.castShadow}` });
  });
  return parts;
}

// Every person is posed part by part as before, but all the parts of everybody are drawn as one instanced mesh per shape:
// sixty people cost a couple of draw calls instead of two thousand.
export function createCrowd(parent) {
  const members = new Map();
  const batches = new Map();

  function batchFor(part, needed) {
    const current = batches.get(part.batchKey);
    if (current && current.capacity >= needed) return current;
    const capacity = Math.max(FIRST_CAPACITY, current ? current.capacity * 2 : 0, needed);
    const mesh = new THREE.InstancedMesh(part.mesh.geometry, CROWD_MATERIAL, capacity);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.count = 0;
    if (current) {
      parent.remove(current.mesh);
      current.mesh.dispose();
    }
    parent.add(mesh);
    const batch = { mesh, capacity, castsShadow: part.mesh.castShadow, used: 0 };
    batches.set(part.batchKey, batch);
    return batch;
  }

  function join(key, root) {
    members.set(key, { root, parts: partsOf(root) });
  }

  function leave(key) {
    members.delete(key);
  }

  function shownParts(hasFineParts) {
    const shown = [];
    for (const { root, parts } of members.values()) {
      if (!isShown(root)) continue;
      for (const part of parts) if ((hasFineParts || !part.isFine) && isShown(part.mesh)) shown.push(part);
    }
    return shown;
  }

  function draw({ hasFineParts, castsShadow }) {
    parent.updateMatrixWorld(true);
    const shown = shownParts(hasFineParts);
    const needed = new Map();
    for (const part of shown) needed.set(part.batchKey, (needed.get(part.batchKey) ?? 0) + 1);
    for (const batch of batches.values()) batch.used = 0;
    for (const part of shown) {
      const batch = batchFor(part, needed.get(part.batchKey));
      batch.mesh.setMatrixAt(batch.used, part.mesh.matrixWorld);
      batch.mesh.setColorAt(batch.used, part.mesh.material.color);
      batch.used += 1;
    }
    for (const batch of batches.values()) {
      batch.mesh.count = batch.used;
      batch.mesh.castShadow = castsShadow && batch.castsShadow;
      batch.mesh.instanceMatrix.needsUpdate = true;
      if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
    }
  }

  return { join, leave, draw };
}
