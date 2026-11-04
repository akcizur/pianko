import test from "node:test";
import assert from "node:assert/strict";
import { createDistrictBuildingPlan } from "../src/world/district-layout.js";

test("active district plan contains twelve uniquely named walkable buildings", () => {
  const buildings = createDistrictBuildingPlan();
  assert.equal(buildings.length, 12);
  assert.equal(new Set(buildings.map(building => building.id)).size, 12);
  assert.equal(buildings.filter(building => building.side === -1).length, 6);
  assert.equal(buildings.filter(building => building.side === 1).length, 6);
});

test("named landmarks keep their established positions and dimensions", () => {
  const buildings = createDistrictBuildingPlan();
  const home = buildings.find(building => building.specialPanelak);
  const shop = buildings.find(building => building.departmentStore);
  const oldTown = buildings.find(building => building.oldTown);
  assert.deepEqual(
    { id: home.id, x: home.x, z: home.z, width: home.width, depth: home.depth, height: home.height },
    { id: "DŮM MÍR", x: -14.2, z: -6, width: 11.2, depth: 13, height: 23 }
  );
  assert.deepEqual(
    { id: shop.id, x: shop.x, z: shop.z, width: shop.width, depth: shop.depth, height: shop.height, kind: shop.kind },
    { id: "OBCHODNÍ DŮM MÍR", x: 14.2, z: -40, width: 13, depth: 15, height: 12, kind: "shop" }
  );
  assert.equal(oldTown.id, "ČINŽOVNÍ DŮM");
  assert.equal(oldTown.height, 11);
  assert.equal(oldTown.kind, "tenement");
});

test("every descriptor has finite, navigable bounds and a valid orientation", () => {
  for (const building of createDistrictBuildingPlan()) {
    assert.ok(Number.isFinite(building.x));
    assert.ok(Number.isFinite(building.z));
    assert.ok(building.width > 0 && building.depth > 0 && building.height > 0);
    assert.ok(building.inward === -1 || building.inward === 1);
    assert.ok(building.x - building.width / 2 > -23.2);
    assert.ok(building.x + building.width / 2 < 23.2);
    assert.ok(building.z - building.depth / 2 > -92);
    assert.ok(building.z + building.depth / 2 < 29);
  }
});

test("district plan is deterministic and descriptors cannot be mutated", () => {
  const first = createDistrictBuildingPlan();
  assert.deepEqual(first, createDistrictBuildingPlan());
  assert.equal(Object.isFrozen(first[0]), true);
  assert.throws(() => { first[0].x = 0; }, TypeError);
});
