import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGameSettings, normalizeSaveData } from "../src/core/save-schema.js";

test("normalizes a complete valid save without changing established values", () => {
  const save = normalizeSaveData({
    missionStage: 4,
    foeDefeated: true,
    courierDefeated: false,
    ending: "public",
    inVehicle: true,
    neighborQuestStep: 2,
    playSeconds: 876.25,
    stats: { hp: 60, maxHp: 90, energy: 20, maxEnergy: 40, xp: 35, level: 3, credits: 260, medkits: 4, weaponLevel: 1, armorLevel: 2, guard: true },
    player: { x: -12, z: -32, elevation: 5.98, yaw: 1.2, pitch: -0.2 },
    vehicle: { x: 2.5, z: 10.5, yaw: 0.4, altitude: 3, battery: 72 },
    collectedSupplies: ["one", "two", "one"],
    buildings: [{ id: "DŮM MÍR", entranceOpen: true, roofOpen: false, doors: [true, false] }],
    panelak: { entranceOpen: true, doors: [false, true] }
  });

  assert.equal(save.missionStage, 4);
  assert.equal(save.inVehicle, true);
  assert.equal(save.stats.maxHp, 90);
  assert.equal(save.stats.weaponLevel, 1);
  assert.equal(save.player.elevation, 5.98);
  assert.equal(save.vehicle.battery, 72);
  assert.deepEqual(save.collectedSupplies, ["one", "two"]);
  assert.equal(save.buildings[0].entranceOpen, true);
  assert.deepEqual(save.panelak.doors, [false, true]);
});

test("invalid values are bounded and malformed nested objects use safe defaults", () => {
  const save = normalizeSaveData({
    missionStage: "NaN",
    neighborQuestStep: 99,
    playSeconds: Infinity,
    ending: "root",
    inVehicle: true,
    stats: { hp: 999999, maxHp: -10, energy: -20, maxEnergy: "bad", xp: 700, level: 0, credits: -1, medkits: 10000, weaponLevel: 99, armorLevel: -5, guard: "false" },
    player: { x: "NaN", z: -1000, yaw: "bad", pitch: 99 },
    vehicle: { x: 1000, z: 0, battery: -20 },
    collectedSupplies: ["ok", 4, "", "ok"]
  });

  assert.equal(save.missionStage, 0);
  assert.equal(save.neighborQuestStep, 0);
  assert.equal(save.playSeconds, 0);
  assert.equal(save.ending, null);
  assert.equal(save.inVehicle, false);
  assert.equal(save.stats.hp, 74);
  assert.equal(save.stats.maxHp, 74);
  assert.equal(save.stats.xp, 99);
  assert.equal(save.stats.level, 1);
  assert.equal(save.stats.medkits, 999);
  assert.equal(save.stats.guard, false);
  assert.equal(save.player, null);
  assert.equal(save.vehicle, null);
  assert.deepEqual(save.collectedSupplies, ["ok"]);
});

test("both actual campaign ending choices survive normalization", () => {
  assert.equal(normalizeSaveData({ ending: "public" }).ending, "public");
  assert.equal(normalizeSaveData({ ending: "eva" }).ending, "eva");
  assert.equal(normalizeSaveData({ ending: "private" }).ending, null);
});

test("older saves without optional fields remain compatible", () => {
  const save = normalizeSaveData({ missionStage: 2, panelak: { entranceOpen: true, doors: [true] } });
  assert.equal(save.missionStage, 2);
  assert.equal(save.stats.hp, 74);
  assert.equal(save.stats.credits, 120);
  assert.equal(save.vehicle, null);
  assert.equal(save.player, null);
  assert.equal(save.panelak.entranceOpen, true);
  assert.equal(save.buildings, null);
});

test("untrusted unknown properties are not copied into live state", () => {
  const save = normalizeSaveData({ __proto__: { admin: true }, constructor: { prototype: { broken: true } }, unexpected: "value", stats: { hp: 50, unexpected: "value" } });
  assert.equal(Object.hasOwn(save, "unexpected"), false);
  assert.equal(Object.hasOwn(save.stats, "unexpected"), false);
  assert.equal(Object.hasOwn(save, "constructor"), false);
});

test("settings use explicit safe ranges and boolean defaults", () => {
  assert.deepEqual(normalizeGameSettings({ sensitivity: 9, crt: false, sound: true }), { sensitivity: 9, crt: false, sound: true });
  assert.deepEqual(normalizeGameSettings({ sensitivity: 1000, crt: "false", sound: 0 }), { sensitivity: 10, crt: true, sound: true });
  assert.deepEqual(normalizeGameSettings({ sensitivity: "bad" }), { sensitivity: 5, crt: true, sound: true });
});
