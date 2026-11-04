/**
 * Failure-tolerant JSON persistence boundary.
 * Storage is resolved lazily for Node tests and browsers with blocked storage.
 */
function resolveStorage(storage) {
  try {
    const target = typeof storage === "function" ? storage() : storage;
    if (!target || typeof target.getItem !== "function" || typeof target.setItem !== "function") return null;
    return target;
  } catch {
    return null;
  }
}

export function readStoredJson(key, fallback = {}, storage = () => globalThis.localStorage) {
  try {
    const target = resolveStorage(storage);
    if (!target) return fallback;
    const raw = target.getItem(String(key));
    if (raw === null || raw === undefined || raw === "") return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key, value, storage = () => globalThis.localStorage) {
  try {
    const target = resolveStorage(storage);
    if (!target) return false;
    const serialized = JSON.stringify(value);
    if (typeof serialized !== "string") return false;
    target.setItem(String(key), serialized);
    return true;
  } catch {
    return false;
  }
}
