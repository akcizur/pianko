import test from "node:test";
import assert from "node:assert/strict";
import { advanceNeighborQuestStep, normalizeNeighborQuestStep } from "../src/core/story-rules.js";

test("neighbor quest advances through Anna, the pattern book and Ivana", () => {
  assert.equal(advanceNeighborQuestStep(0, "talk", "anna"), 1);
  assert.equal(advanceNeighborQuestStep(1, "pickup", "pattern"), 2);
  assert.equal(advanceNeighborQuestStep(2, "talk", "ivana"), 3);
});

test("neighbor quest cannot skip steps or be replayed for repeated rewards", () => {
  assert.equal(advanceNeighborQuestStep(0, "pickup", "pattern"), 0);
  assert.equal(advanceNeighborQuestStep(1, "talk", "ivana"), 1);
  assert.equal(advanceNeighborQuestStep(2, "talk", "anna"), 2);
  assert.equal(advanceNeighborQuestStep(3, "talk", "ivana"), 3);
});

test("neighbor quest save state is normalized", () => {
  assert.equal(normalizeNeighborQuestStep(2), 2);
  assert.equal(normalizeNeighborQuestStep("3"), 3);
  assert.equal(normalizeNeighborQuestStep(4), 0);
  assert.equal(normalizeNeighborQuestStep(-1), 0);
});
