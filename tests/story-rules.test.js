import test from "node:test";
import assert from "node:assert/strict";
import { isCourierEncounterActive } from "../src/core/story-rules.js";

test("courier encounter is hidden and non-blocking until its story step", () => {
  assert.equal(isCourierEncounterActive(0, false), false);
  assert.equal(isCourierEncounterActive(1, false), false);
  assert.equal(isCourierEncounterActive(2, false), false);
});

test("courier encounter activates only at stage three and ends on rescue", () => {
  assert.equal(isCourierEncounterActive(3, false), true);
  assert.equal(isCourierEncounterActive(3, true), false);
  assert.equal(isCourierEncounterActive(4, false), false);
  assert.equal(isCourierEncounterActive(5, false), false);
});
