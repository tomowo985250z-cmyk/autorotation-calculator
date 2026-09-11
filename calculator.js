/* Pure calculations. No chart values are assumed. */
(function (root) {
  'use strict';
  const limits = Object.freeze({
    pressureAltitude: [-2000, 20000], oat: [-60, 60],
    aircraftWeight: [0, Number.MAX_SAFE_INTEGER],
    crewWeight: [0, Number.MAX_SAFE_INTEGER], fuelWeight: [0, Number.MAX_SAFE_INTEGER]
  });
  function parseInput(raw, name) {
    if (String(raw).trim() === '') return { value: null, error: '' };
    const value = Number(raw);
    const bounds = limits[name];
    if (!bounds || !Number.isFinite(value)) return { value: null, error: '有効な数値を入力してください。' };
    if (value < bounds[0] || value > bounds[1] || (name === 'aircraftWeight' && value === 0)) {
      const error = name === 'pressureAltitude' ? '−2,000〜20,000 ftで入力してください。'
        : name === 'oat' ? '−60〜60 °Cで入力してください。'
        : name === 'aircraftWeight' ? '機体重量は0より大きい有効な値を入力してください。' : '0以上の有効な重量を入力してください。';
      return { value: null, error };
    }
    return { value, error: '' };
  }
  function densityAltitude(pressureAltitude, oat) {
    const isaTemperature = 15 - 1.98 * pressureAltitude / 1000;
    return pressureAltitude + 120 * (oat - isaTemperature);
  }
  function totalWeight(aircraft, crew, fuel) {
    const total = aircraft + crew + fuel;
    return Number.isFinite(total) && total <= Number.MAX_SAFE_INTEGER ? total : null;
  }
  function rotorSpeed(point, provider) {
    // Canonical chart coordinates: original physical values, never rounded, shifted
    // to sea level, or clipped to a boundary. Future renderers map this point to pixels.
    const chartPoint = point && Number.isFinite(point.densityAltitudeFt)
      && Number.isFinite(point.grossWeightLb) && point.grossWeightLb > 0
      ? Object.freeze({ densityAltitudeFt: point.densityAltitudeFt, grossWeightLb: point.grossWeightLb }) : null;
    let boundary = { status: 'unconfirmed' };
    if (chartPoint && typeof provider?.checkBoundaries === 'function') {
      try { boundary = provider.checkBoundaries(chartPoint) || { status: 'unconfirmed' }; }
      catch { boundary = { status: 'unconfirmed' }; }
    }
    const finish = result => ({ ...result, point: chartPoint, boundary });
    if (!provider || typeof provider.lookup !== 'function') return finish({ status: 'unavailable' });
    if (!chartPoint) return finish({ status: 'incomplete' });
    try {
      // Data coverage limits interpolation; advisory boundaries do not.
      const result = provider.lookup(chartPoint);
      if (result?.status === 'out-of-range') return finish({ status: 'out-of-range', imagePoint: result.imagePoint });
      if (result?.status !== 'ok' || !Number.isFinite(result.referenceRpm) || result.referenceRpm <= 0) return finish({ status: 'error' });
      return finish({ status: 'ok', referenceRpm: result.referenceRpm, minRpm: result.referenceRpm - 5, maxRpm: result.referenceRpm + 5,
        imagePoint: result.imagePoint, interpolation: result.interpolation });
    } catch { return finish({ status: 'error' }); }
  }
  root.AutorotationCalculator = Object.freeze({ parseInput, densityAltitude, totalWeight, rotorSpeed, lbToKg: lb => lb * 0.45359237 });
})(globalThis);
