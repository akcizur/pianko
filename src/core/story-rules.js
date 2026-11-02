export function isCourierEncounterActive(missionStage, courierDefeated) {
  return missionStage === 3 && !courierDefeated;
}

export function normalizeNeighborQuestStep(value) {
  const step = Number(value);
  return Number.isInteger(step) && step >= 0 && step <= 3 ? step : 0;
}

export function advanceNeighborQuestStep(step, action, actor) {
  if (step === 0 && action === "talk" && actor === "anna") return 1;
  if (step === 1 && action === "pickup" && actor === "pattern") return 2;
  if (step === 2 && action === "talk" && actor === "ivana") return 3;
  return step;
}
