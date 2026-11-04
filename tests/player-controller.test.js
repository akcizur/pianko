import test from "node:test";
import assert from "node:assert/strict";
import { createPlayerController } from "../src/core/player-controller.js";

function createCamera() {
  return {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { x: 0, y: 0, z: 0, order: "XYZ" }
  };
}

test("W moves the player forward along negative Z", () => {
  const state = { started: true, paused: false };
  const controller = createPlayerController({ camera: createCamera(), state });
  controller.keysDown.KeyW = true;
  controller.update(1 / 30);
  assert.ok(controller.player.z < 0);
});

test("solid AABB colliders block movement", () => {
  const state = { started: true, paused: false };
  const controller = createPlayerController({
    camera: createCamera(),
    state,
    colliders: [{ name: "wall", minX: -2, maxX: 2, minZ: -1, maxZ: 1 }]
  });
  controller.setSpawn({ x: 0, z: 1.35, yaw: 0 });
  controller.keysDown.KeyW = true;
  for (let i = 0; i < 30; i += 1) controller.update(1 / 30);
  assert.ok(controller.player.z >= 1.28);
});

test("diagonal digital movement is normalized", () => {
  const state = { started: true, paused: false };
  const controller = createPlayerController({ camera: createCamera(), state });
  controller.keysDown.KeyW = true;
  controller.keysDown.KeyD = true;
  controller.update(1 / 30);
  const distance = Math.hypot(controller.player.x, controller.player.z);
  assert.ok(distance <= 3.6 / 30 + 1e-9);
  assert.ok(distance > 0);
});

test("jump returns to the ground", () => {
  const state = { started: true, paused: false };
  const controller = createPlayerController({ camera: createCamera(), state });
  assert.equal(controller.jump(), true);
  for (let i = 0; i < 120; i += 1) controller.update(1 / 60);
  assert.equal(controller.isGrounded, true);
  assert.equal(controller.player.jumpHeight, 0);
});

test("paused state prevents movement", () => {
  const state = { started: true, paused: true };
  const controller = createPlayerController({ camera: createCamera(), state });
  controller.keysDown.KeyW = true;
  controller.update(1 / 30);
  assert.equal(controller.player.z, 0);
});
test("crosshair hover selects the aimed object instead of the nearest neighbour",()=>{
 const activated=[];
 const nearby={id:"nearby",x:.2,z:0,range:1,action(){activated.push("nearby");}};
 const aimed={id:"aimed",x:.45,z:0,range:1,action(){activated.push("aimed");}};
 const controller=createPlayerController({camera:createCamera(),state:{started:true,paused:false},interactables:[nearby,aimed]});
 assert.equal(controller.setHoveredInteractable(aimed),aimed);
 assert.equal(controller.doInteract(),true);
 assert.deepEqual(activated,["aimed"]);
 aimed.enabled=false;
 assert.equal(controller.setHoveredInteractable(aimed),null);
 assert.equal(controller.doInteract(),true);
 assert.deepEqual(activated,["aimed","nearby"]);
});

test("hovered interaction cannot bypass vertical floor or distance limits",()=>{
 const item={id:"upper-floor",x:0,z:0,range:1,levelY:3,verticalRange:.5,action(){}};
 const controller=createPlayerController({camera:createCamera(),state:{started:true,paused:false},interactables:[item]});
 assert.equal(controller.setHoveredInteractable(item),null);
 assert.equal(controller.isInteractableInRange(item),false);
 controller.player.elevation=3;
 assert.equal(controller.setHoveredInteractable(item),item);
 controller.player.x=5;
 assert.equal(controller.isInteractableInRange(item),false);
});
