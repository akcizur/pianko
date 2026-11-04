import test from "node:test";
import assert from "node:assert/strict";
import { createIntervalGate } from "../src/core/interval-gate.js";

test("interval gate refreshes on cadence and preserves fractional remainder", () => {
  const gate = createIntervalGate(1 / 20);
  assert.equal(gate.advance(1 / 60), false);
  assert.equal(gate.advance(1 / 60), false);
  assert.equal(gate.advance(1 / 60), true);
  assert.ok(Math.abs(gate.remainder) < 1e-9);

  assert.equal(gate.advance(1 / 30), false);
  assert.equal(gate.advance(1 / 30), true);
  assert.ok(gate.remainder >= 0 && gate.remainder < 1 / 20);
});

test("interval gate ignores invalid and non-positive deltas", () => {
  const gate = createIntervalGate(0.05);
  for (const delta of [0, -1, NaN, Infinity, -Infinity]) assert.equal(gate.advance(delta), false);
  assert.equal(gate.remainder, 0);
});

test("interval gate bounds long frames and never emits catch-up bursts", () => {
  const gate = createIntervalGate(0.05, { maxDelta: 0.1 });
  assert.equal(gate.advance(5), true);
  assert.equal(gate.advance(5), true);
  assert.ok(gate.remainder >= 0 && gate.remainder < 0.05);
  gate.reset();
  assert.equal(gate.remainder, 0);
});

test("invalid intervals are rejected at construction", () => {
  for (const value of [0, -1, NaN, Infinity, "fast"]) {
    assert.throws(() => createIntervalGate(value), RangeError);
  }
  assert.throws(() => createIntervalGate(0.05, { maxDelta: 0 }), RangeError);
});
