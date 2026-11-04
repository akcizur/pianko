import test from "node:test";
import assert from "node:assert/strict";
import { readStoredJson, writeStoredJson } from "../src/core/persistence.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    values
  };
}

test("JSON state round-trips through a storage adapter", () => {
  const storage = createStorage();
  const state = { missionStage: 3, player: { x: 4.2, z: -8 }, collected: ["one"] };
  assert.equal(writeStoredJson("save", state, storage), true);
  assert.deepEqual(readStoredJson("save", {}, storage), state);
});

test("missing, malformed, primitive and array values use the supplied fallback", () => {
  const storage = createStorage({ malformed: "{not-json", primitive: "42", nil: "null", array: "[1,2,3]" });
  const fallback = { safe: true };
  for (const key of ["missing", "malformed", "primitive", "nil", "array"]) {
    assert.equal(readStoredJson(key, fallback, storage), fallback);
  }
});

test("blocked storage and storage accessors fail without throwing", () => {
  const fallback = {};
  assert.equal(readStoredJson("save", fallback, () => { throw new Error("blocked"); }), fallback);
  assert.equal(readStoredJson("save", fallback, null), fallback);
  assert.equal(writeStoredJson("save", {}, () => { throw new Error("blocked"); }), false);
  assert.equal(writeStoredJson("save", {}, null), false);
});

test("quota errors and unserializable values are reported as a failed save", () => {
  const denied = { getItem() { return null; }, setItem() { throw new Error("quota exceeded"); } };
  assert.equal(writeStoredJson("save", { progress: 1 }, denied), false);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.equal(writeStoredJson("save", cyclic, createStorage()), false);
});
