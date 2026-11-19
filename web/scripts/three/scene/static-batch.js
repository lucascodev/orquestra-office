import { THREE } from "../kit.js";

const INSTANCE_MATERIALS = {
  MeshLambertMaterial: new THREE.MeshLambertMaterial({ color: "#ffffff" }),
  MeshBasicMaterial: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
};

const isBatchable = (mesh) => mesh.visible && !mesh.material.map && !mesh.material.transparent && Boolean(INSTANCE_MATERIALS[mesh.material.type]);

const batchKeyOf = (mesh) => `${mesh.geometry.uuid}|${mesh.material.type}|${mesh.castShadow}|${mesh.receiveShadow}`;

function instancedFrom(parts) {
  const [{ mesh: sample }] = parts;
  const instanced = new THREE.InstancedMesh(sample.geometry, INSTANCE_MATERIALS[sample.material.type], parts.length);
  parts.forEach(({ mesh, matrix }, index) => {
    instanced.setMatrixAt(index, matrix);
    instanced.setColorAt(index, mesh.material.color);
  });
  instanced.castShadow = sample.castShadow;
  instanced.receiveShadow = sample.receiveShadow;
  instanced.computeBoundingSphere();
  return instanced;
}

function placedLike(mesh, matrix) {
  matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
  return mesh;
}

// Every plain box and cylinder of a piece becomes one instance of a shared mesh, colored per instance:
// a piece costs a handful of draw calls however much furniture it holds.
export function batchStatic(piece) {
  piece.updateMatrixWorld(true);
  const toPiece = piece.matrixWorld.clone().invert();
  const batches = new Map();
  const loose = [];
  piece.traverse((node) => {
    if (!node.isMesh) return;
    const matrix = toPiece.clone().multiply(node.matrixWorld);
    if (!isBatchable(node)) {
      loose.push(placedLike(node, matrix));
      return;
    }
    const key = batchKeyOf(node);
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push({ mesh: node, matrix });
  });
  const batched = new THREE.Group();
  piece.matrix.decompose(batched.position, batched.quaternion, batched.scale);
  batched.userData = { ...piece.userData };
  batched.add(...[...batches.values()].map(instancedFrom), ...loose);
  return batched;
}
