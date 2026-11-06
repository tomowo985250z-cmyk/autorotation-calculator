/* Independent, DOM-free chart traversal. No extrapolation or clamping. */
(() => {
  'use strict';
  function interpolate(points, inputKey, outputKey, value) {
    if (!Number.isFinite(value) || !points.length) return null;
    for (const p of points) if (value === p[inputKey]) return p[outputKey];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (value > a[inputKey] && value < b[inputKey]) {
        return a[outputKey] + (value - a[inputKey]) / (b[inputKey] - a[inputKey]) * (b[outputKey] - a[outputKey]);
      }
    }
    return null;
  }
  function mapTicks(ticks, value, inverse = false) {
    return interpolate(ticks.map(([v, pixel]) => ({ v, pixel })), inverse ? 'pixel' : 'v', inverse ? 'v' : 'pixel', value);
  }
  function betweenCurves(curves, value, read) {
    const exact = curves.find(curve => curve.value === value);
    if (exact) return read(exact);
    for (let i = 1; i < curves.length; i++) {
      const a = curves[i - 1], b = curves[i];
      if (value > a.value && value < b.value) {
        const u = read(a), v = read(b);
        // A missing neighbouring curve is a gap, never bridged.
        if (u === null || v === null) return null;
        return u + (value - a.value) / (b.value - a.value) * (v - u);
      }
    }
    return null;
  }
  function number(value) {
    if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
    if (typeof value !== 'number' && typeof value !== 'string') return NaN;
    return Number(value);
  }
  function calculate(input, data = globalThis.PowerAssuranceData) {
    const base = { provisional: true, assessment: 'pending', chartTotC: null, actualTotC: null,
      marginC: null, torquePoint: null, temperaturePoint: null };
    const altitude = number(input?.pressureAltitude), oat = number(input?.oat), torque = number(input?.torque);
    const actual = number(input?.actualTot);
    if ([altitude, oat, torque].some(v => v === null)) return { ...base, status: 'incomplete' };
    if (![altitude, oat, torque].every(Number.isFinite) || (actual !== null && (!Number.isFinite(actual) || actual < 0))) {
      return { ...base, status: 'invalid' };
    }
    if (!data) return { ...base, status: 'unavailable' };
    const torqueX = mapTicks(data.torqueTicks, torque);
    if (torqueX === null) return { ...base, status: 'out-of-range', stage: 'torque' };
    const y = betweenCurves(data.altitudes, altitude, curve => interpolate(curve.points, 'x', 'y', torqueX));
    if (y === null) return { ...base, status: 'out-of-range', stage: 'altitude' };
    const totX = betweenCurves(data.temperatures, oat, curve => interpolate(curve.points, 'y', 'x', y));
    if (totX === null) return { ...base, status: 'out-of-range', stage: 'oat' };
    const chartTotC = mapTicks(data.totTicks, totX, true);
    if (chartTotC === null) return { ...base, status: 'out-of-range', stage: 'tot' };
    // N1 is checked separately as a measurement condition; never used in chart math.
    return { ...base, status: 'ok', chartTotC, actualTotC: actual,
      marginC: actual === null ? null : chartTotC - actual,
      torquePoint: { x: torqueX, y }, temperaturePoint: { x: totX, y } };
  }
  globalThis.PowerAssuranceCalculator = Object.freeze({ calculate, interpolate, mapTicks, betweenCurves });
  if (typeof module !== 'undefined') module.exports = globalThis.PowerAssuranceCalculator;
})();
