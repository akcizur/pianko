/**
 * Authoritative, deterministic layout for the twelve walkable buildings
 * in the active MÍR 12 district. Data only: no Three.js or browser side effects.
 */
const SIDES = Object.freeze([-1, 1]);
const BUILDING_Z = Object.freeze([11, -6, -23, -40, -57, -74]);
const FACADE_PALETTE = Object.freeze([0x737b7d, 0x80827d, 0x697277, 0x89877f]);

function createBuildingDescriptor(side, z) {
  const oldTown = side === -1 && z === 11;
  const departmentStore = side === 1 && z === -40;
  const specialPanelak = side === -1 && z === -6;
  const variant = Math.abs(Math.floor(z / 17) + side + 8) % FACADE_PALETTE.length;
  const buildingId = specialPanelak
    ? "DŮM MÍR"
    : departmentStore
      ? "OBCHODNÍ DŮM MÍR"
      : oldTown
        ? "ČINŽOVNÍ DŮM"
        : "PANELÁK " + (side < 0 ? "ZÁPAD" : "VÝCHOD") + " · " + Math.abs(z);

  return Object.freeze({
    id: buildingId,
    side,
    x: side * 14.2,
    z,
    inward: -side,
    width: departmentStore ? 13 : 9.2 + (Math.abs(z + side * 11) % 3),
    depth: departmentStore ? 15 : 13,
    height: departmentStore ? 12 : oldTown ? 11 : 16 + (Math.abs(z * 7 + side * 19) % 9),
    kind: departmentStore ? "shop" : oldTown ? "tenement" : "panelak",
    wallColor: oldTown ? 0x817365 : departmentStore ? 0x788080 : FACADE_PALETTE[variant],
    oldTown,
    departmentStore,
    specialPanelak,
    facadeVariant: variant,
    hasStreetTree: z % 34 !== 0
  });
}

/** Return immutable descriptors in the same order as the original map loop. */
export function createDistrictBuildingPlan() {
  return SIDES.flatMap(side => BUILDING_Z.map(z => createBuildingDescriptor(side, z)));
}
