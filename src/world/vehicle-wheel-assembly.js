/**
 * Build a low-poly, physics-driven wheel around a measured model-space centre.
 * The imported source car has static skinned wheel surfaces, so these
 * assemblies provide independent rolling and steering pivots.
 */
export function createVehicleWheelAssembly({
  THREE,
  parent,
  center,
  front = false,
  material,
  onMesh = () => {},
  radius = 0.285,
  width = 0.205
}) {
  if (!THREE?.Group || !THREE?.Mesh || !parent?.add || !center ||
      ![center.x, center.y, center.z, radius, width].every(Number.isFinite) ||
      radius <= 0 || width <= 0 || typeof material !== "function") {
    throw new TypeError("A valid Three.js context, parent, centre, dimensions and material factory are required.");
  }

  const pivot = new THREE.Group();
  pivot.name = front ? "Favorit — přední otočné kolo" : "Favorit — zadní otočné kolo";
  pivot.position.set(center.x, center.y, center.z);
  pivot.rotation.order = "YXZ";
  parent.add(pivot);

  const rubber = material(0x222523, 0.96);
  const steel = material(0x9b9d98, 0.54, 0x171918, 0.025);
  const darkSteel = material(0x424745, 0.68);

  const addPart = (geometry, mat, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
    onMesh(mesh);
    return mesh;
  };

  const tyre = addPart(new THREE.CylinderGeometry(radius, radius, width, 16), rubber);
  tyre.rotation.z = Math.PI / 2;

  for (const side of [-1, 1]) {
    const faceX = side * width * 0.34;
    const disc = addPart(new THREE.CylinderGeometry(radius * 0.64, radius * 0.64, 0.032, 12), darkSteel, faceX);
    disc.rotation.z = Math.PI / 2;

    const ring = addPart(new THREE.TorusGeometry(radius * 0.58, 0.009, 5, 16), steel, faceX + side * 0.018);
    ring.rotation.y = Math.PI / 2;

    const hub = addPart(new THREE.CylinderGeometry(0.052, 0.052, 0.038, 10), steel, faceX + side * 0.022);
    hub.rotation.z = Math.PI / 2;

    for (let spoke = 0; spoke < 5; spoke += 1) {
      const bar = addPart(new THREE.BoxGeometry(0.025, radius * 0.82, 0.028), steel, faceX + side * 0.019);
      bar.rotation.x = spoke * Math.PI * 2 / 5;
    }
  }

  return { pivot, front: Boolean(front), radius, width };
}
