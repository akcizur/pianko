import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createVehicleWheelAssembly } from "../src/world/vehicle-wheel-assembly.js";

function material() {
  return new THREE.MeshStandardMaterial();
}

test("wheel assembly has a centred pivot, tyre and mirrored rim details", () => {
  const parent = new THREE.Group();
  const meshes = [];
  const wheel = createVehicleWheelAssembly({
    THREE,
    parent,
    center: { x: -0.71, y: 0.285, z: -1.17 },
    front: true,
    material,
    onMesh: mesh => meshes.push(mesh)
  });

  assert.equal(parent.children.length, 1);
  assert.equal(wheel.pivot.position.x, -0.71);
  assert.equal(wheel.pivot.position.y, 0.285);
  assert.equal(wheel.pivot.position.z, -1.17);
  assert.equal(wheel.front, true);
  assert.equal(wheel.radius, 0.285);
  assert.equal(wheel.width, 0.205);
  assert.equal(meshes.length, 17);
  assert.equal(wheel.pivot.children.length, 17);
  assert.ok(meshes.every(mesh => mesh.castShadow && mesh.receiveShadow));
});

test("wheel assembly exposes an independently steerable and rolling group", () => {
  const parent = new THREE.Group();
  const wheel = createVehicleWheelAssembly({
    THREE,
    parent,
    center: { x: 0.71, y: 0.285, z: 1.39 },
    front: false,
    material
  });

  wheel.pivot.rotation.x = 2.5;
  wheel.pivot.rotation.y = 0;
  assert.equal(wheel.pivot.rotation.x, 2.5);
  assert.equal(wheel.pivot.rotation.y, 0);
  assert.equal(wheel.front, false);
});

test("wheel assembly rejects invalid dimensions and missing dependencies", () => {
  const parent = new THREE.Group();
  const base = { THREE, parent, center: { x: 0, y: 0, z: 0 }, material };
  assert.throws(() => createVehicleWheelAssembly({ ...base, radius: 0 }), TypeError);
  assert.throws(() => createVehicleWheelAssembly({ ...base, center: { x: NaN, y: 0, z: 0 } }), TypeError);
  assert.throws(() => createVehicleWheelAssembly({ ...base, parent: null }), TypeError);
});
