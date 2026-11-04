/**
 * Deterministic cadence gate for expensive, time-based render work.
 *
 * Returns true at most once per call when the accumulated delta crosses the
 * configured interval. Large frame deltas do not cause a burst of catch-up
 * work; the fractional remainder is preserved for the next frame.
 */
export function createIntervalGate(intervalSeconds, { maxDelta = 0.1 } = {}) {
  const interval = Number(intervalSeconds);
  const safeMaxDelta = Number(maxDelta);
  if (!Number.isFinite(interval) || interval <= 0) {
    throw new RangeError("Interval must be a positive finite number.");
  }
  if (!Number.isFinite(safeMaxDelta) || safeMaxDelta <= 0) {
    throw new RangeError("Maximum delta must be a positive finite number.");
  }

  let elapsed = 0;
  return {
    advance(deltaSeconds) {
      const delta = Number(deltaSeconds);
      if (!Number.isFinite(delta) || delta <= 0) return false;
      elapsed += Math.min(delta, safeMaxDelta);
      if (elapsed + Number.EPSILON < interval) return false;
      elapsed %= interval;
      return true;
    },
    reset() {
      elapsed = 0;
    },
    get remainder() {
      return elapsed;
    }
  };
}
