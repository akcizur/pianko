/**
 * Stable, id-based persistence for entrance and apartment doors.
 * A save survives ordering changes in the generated building list.
 */
export function serializeBuildingDoorStates(entries = []) {
  return entries.map(entry => ({
    id: entry.id,
    entranceOpen: Boolean(entry.open),
    doors: entry.apartmentDoors.map(door => Boolean(door.open))
  }));
}

export function restoreBuildingDoorStates(entries = [], savedStates) {
  if (!Array.isArray(savedStates)) return false;
  const byId = new Map(savedStates.filter(item => item && typeof item.id === "string").map(item => [item.id, item]));
  for (const entry of entries) {
    const saved = byId.get(entry.id);
    if (!saved) continue;
    entry.open = Boolean(saved.entranceOpen);
    entry.doorPivot.rotation.y = entry.open ? entry.openAngle : 0;
    entry.doorCollider.enabled = !entry.open;
    for (let index = 0; index < entry.apartmentDoors.length; index++) {
      const door = entry.apartmentDoors[index];
      door.open = Boolean(saved.doors?.[index]);
      door.doorPivot.rotation.y = door.open ? door.openAngle : 0;
      door.doorCollider.enabled = !door.open;
    }
  }
  return true;
}
