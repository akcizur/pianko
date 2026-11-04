/**
 * Backward-compatible validation for untrusted local save/settings JSON.
 * The output is a fresh, allow-listed object; arbitrary saved properties are
 * never spread into live game state.
 */

const DEFAULT_STATS = Object.freeze({
  hp: 74,
  maxHp: 74,
  energy: 32,
  maxEnergy: 32,
  xp: 0,
  level: 1,
  credits: 120,
  medkits: 2,
  weaponLevel: 0,
  armorLevel: 0,
  guard: false
});

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

function boundedNumber(value, fallback, min, max, integer = false) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const clamped = Math.min(max, Math.max(min, number));
  return integer ? Math.round(clamped) : clamped;
}

function safeInteger(value, fallback, min, max) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback;
}

function normalizeStats(raw) {
  const source = isRecord(raw) ? raw : {};
  const maxHp = boundedNumber(source.maxHp, DEFAULT_STATS.maxHp, 74, 1000, true);
  const maxEnergy = boundedNumber(source.maxEnergy, DEFAULT_STATS.maxEnergy, 32, 500, true);
  return {
    hp: boundedNumber(source.hp, DEFAULT_STATS.hp, 0, maxHp, true),
    maxHp,
    energy: boundedNumber(source.energy, DEFAULT_STATS.energy, 0, maxEnergy, true),
    maxEnergy,
    xp: boundedNumber(source.xp, DEFAULT_STATS.xp, 0, 99, true),
    level: boundedNumber(source.level, DEFAULT_STATS.level, 1, 100, true),
    credits: boundedNumber(source.credits, DEFAULT_STATS.credits, 0, 1000000, true),
    medkits: boundedNumber(source.medkits, DEFAULT_STATS.medkits, 0, 999, true),
    weaponLevel: boundedNumber(source.weaponLevel, DEFAULT_STATS.weaponLevel, 0, 2, true),
    armorLevel: boundedNumber(source.armorLevel, DEFAULT_STATS.armorLevel, 0, 2, true),
    guard: source.guard === true
  };
}

function normalizePlayer(raw) {
  if (!isRecord(raw)) return null;
  const x = boundedNumber(raw.x, NaN, -22.9, 22.9);
  const z = boundedNumber(raw.z, NaN, -88, 25);
  if (!Number.isFinite(x) || !Number.isFinite(z) || z <= -88 || z >= 25) return null;
  const elevation = boundedNumber(raw.elevation, 0, 0, 50);
  return {
    x,
    z,
    elevation,
    yaw: boundedNumber(raw.yaw, 0, -Math.PI * 100, Math.PI * 100),
    pitch: boundedNumber(raw.pitch, -0.04, -1.4, 1.4)
  };
}

function normalizeVehicle(raw) {
  if (!isRecord(raw)) return null;
  const x = boundedNumber(raw.x, NaN, -23, 23);
  const z = boundedNumber(raw.z, NaN, -101, 34);
  if (!Number.isFinite(x) || !Number.isFinite(z) || z <= -101 || z >= 34) return null;
  return {
    x,
    z,
    yaw: boundedNumber(raw.yaw, 0, -Math.PI * 100, Math.PI * 100),
    altitude: boundedNumber(raw.altitude, 0, 0, 42),
    battery: boundedNumber(raw.battery, 100, 0, 100)
  };
}

function normalizeDoorStates(raw) {
  if (!Array.isArray(raw)) return null;
  return raw.slice(0, 64).filter(item => isRecord(item) && typeof item.id === "string" && item.id.length > 0)
    .map(item => ({
      id: item.id.slice(0, 100),
      entranceOpen: item.entranceOpen === true,
      roofOpen: item.roofOpen === true,
      elevator: isRecord(item.elevator) ? item.elevator : null,
      doors: Array.isArray(item.doors) ? item.doors.slice(0, 64).map(value => value === true) : []
    }));
}

function normalizePanelakState(raw) {
  if (!isRecord(raw)) return null;
  return {
    entranceOpen: raw.entranceOpen === true,
    doors: Array.isArray(raw.doors) ? raw.doors.slice(0, 64).map(value => value === true) : []
  };
}

function normalizeCollectedSupplies(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(value => typeof value === "string" && value.length > 0 && value.length <= 80))].slice(0, 100);
}

export function normalizeSaveData(raw) {
  const source = isRecord(raw) ? raw : {};
  const vehicle = normalizeVehicle(source.vehicle);
  const ending = source.ending === "public" || source.ending === "private" ? source.ending : null;
  return {
    missionStage: safeInteger(source.missionStage, 0, 0, 5),
    foeDefeated: source.foeDefeated === true,
    courierDefeated: source.courierDefeated === true,
    ending,
    inVehicle: source.inVehicle === true && vehicle !== null,
    neighborQuestStep: safeInteger(source.neighborQuestStep, 0, 0, 3),
    playSeconds: boundedNumber(source.playSeconds, 0, 0, 100000000),
    stats: normalizeStats(source.stats),
    player: normalizePlayer(source.player),
    vehicle,
    collectedSupplies: normalizeCollectedSupplies(source.collectedSupplies),
    buildings: normalizeDoorStates(source.buildings),
    panelak: normalizePanelakState(source.panelak)
  };
}

export function normalizeGameSettings(raw) {
  const source = isRecord(raw) ? raw : {};
  return {
    sensitivity: boundedNumber(source.sensitivity, 5, 1, 10, true),
    crt: typeof source.crt === "boolean" ? source.crt : true,
    sound: typeof source.sound === "boolean" ? source.sound : true
  };
}
