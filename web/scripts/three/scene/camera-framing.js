import { THREE } from "../kit.js";

const VIEW_ELEVATION = (58 * Math.PI) / 180;
const VIEW_DIRECTION = new THREE.Vector3(0, Math.sin(VIEW_ELEVATION), Math.cos(VIEW_ELEVATION));

export function frameRoom({ camera, sun, size }) {
  const center = new THREE.Vector3(size.W / 2, size.H / 2, size.D / 2);
  camera.position.copy(center).addScaledVector(VIEW_DIRECTION, 60);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const inverse = camera.matrixWorldInverse;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const x of [-0.2, size.W + 0.2]) for (const y of [-0.1, size.H + 0.6]) for (const z of [-0.2, size.D + 0.2]) {
    const p = new THREE.Vector3(x, y, z).applyMatrix4(inverse);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const pad = 0.3;
  camera.left = minX - pad; camera.right = maxX + pad; camera.bottom = minY - pad; camera.top = maxY + pad;
  camera.updateProjectionMatrix();

  sun.position.set(size.W / 2 + 2, 18, size.D / 2 + 5);
  sun.target.position.set(size.W / 2, 0, size.D / 2);
  const reach = (size.W + size.D) * 0.75;
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 60 });
  sun.shadow.camera.updateProjectionMatrix();
  return (camera.right - camera.left) / (camera.top - camera.bottom);
}
