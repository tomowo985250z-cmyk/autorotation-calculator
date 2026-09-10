/* User-supplied provisional digitization, not verified against the original.
 * Altitude validity and 332 MINIMUM / 385 MAXIMUM boundaries are unresolved.
 * 335 RPM is reserved for a future ordinary reference line; no data is supplied.
 * 385 and 390 below are reference lines, not operating limits.
 */
(() => {
  'use strict';
  const lines = Object.freeze([
    [340, 2050], [345, 2103], [350, 2143], [355, 2188],
    [360, 2234], [365, 2279], [370, 2329], [375, 2378],
    [380, 2426], [385, 2474], [390, 2538]
  ].map(([rpm, weightAtZeroFtLb]) => Object.freeze({ rpm, weightAtZeroFtLb })));
  const weightShiftLbPer1000Ft = 56;
  // Independent of lines and lookup: RPM labels are identifiers, not scalar limits.
  // Register original chart coordinates and an evaluator together after verification.
  // coordinates: chart-specific geometry, with densityAltitudeFt / grossWeightLb units.
  // evaluate(point, coordinates): { status: 'ok', violated: boolean } or
  // { status: 'unknown' } when the point cannot be assessed (e.g. outside coverage).
  // The evaluator defines the forbidden side using the original chart. No geometry,
  // boundary slope, interpolation method, or side is inferred here. On-boundary
  // points should return violated: false; only strict crossings are violations.
  const boundaries = Object.freeze({
    minimum: Object.freeze({ label: '332 RPM MINIMUM', coordinates: null, evaluate: null }),
    maximum: Object.freeze({ label: '385 RPM MAXIMUM', coordinates: null, evaluate: null })
  });
  function checkBoundaries(point, definitions = boundaries) {
    const validPoint = point && Number.isFinite(point.densityAltitudeFt)
      && Number.isFinite(point.grossWeightLb) && point.grossWeightLb > 0;
    function check(kind) {
      const definition = definitions?.[kind];
      if (!validPoint) return { status: 'invalid-input' };
      if (definition?.coordinates == null || typeof definition.evaluate !== 'function') return { status: 'unregistered' };
      try {
        const result = definition.evaluate(Object.freeze({
          densityAltitudeFt: point.densityAltitudeFt, grossWeightLb: point.grossWeightLb
        }), definition.coordinates);
        if (result?.status === 'unknown') return { status: 'unknown' };
        if (result?.status !== 'ok' || typeof result.violated !== 'boolean') return { status: 'error' };
        if (!result.violated) return { status: 'within-boundary' };
        return kind === 'minimum'
          ? { status: 'below-minimum', message: 'MINIMUM未満' }
          : { status: 'above-maximum', message: 'MAXIMUM超過' };
      } catch { return { status: 'error' }; }
    }
    const minimum = check('minimum');
    const maximum = check('maximum');
    const violation = minimum.status === 'below-minimum' || maximum.status === 'above-maximum';
    const confirmed = minimum.status === 'within-boundary' && maximum.status === 'within-boundary';
    return { status: violation ? 'outside-boundaries' : confirmed ? 'within-boundaries' : 'unconfirmed', minimum, maximum };
  }
  globalThis.AutorotationChart = Object.freeze({
    provisional: true,
    label: 'チャート画像からの暫定デジタイズ値・原典確認前',
    lines,
    weightShiftLbPer1000Ft,
    boundaries,
    checkBoundaries,
    lookup({ densityAltitudeFt, grossWeightLb }) {
      if (!Number.isFinite(densityAltitudeFt) || !Number.isFinite(grossWeightLb) || grossWeightLb <= 0) return { status: 'error' };
      // W(h) = W(0) - 56 * h / 1000. Convert to a zero-altitude equivalent.
      const equivalentWeight = grossWeightLb + weightShiftLbPer1000Ft * densityAltitudeFt / 1000;
      if (!Number.isFinite(equivalentWeight) || equivalentWeight < lines[0].weightAtZeroFtLb || equivalentWeight > lines[lines.length - 1].weightAtZeroFtLb) return { status: 'out-of-range' };
      for (let i = 1; i < lines.length; i++) {
        const lower = lines[i - 1];
        const upper = lines[i];
        if (equivalentWeight <= upper.weightAtZeroFtLb) {
          const fraction = (equivalentWeight - lower.weightAtZeroFtLb) / (upper.weightAtZeroFtLb - lower.weightAtZeroFtLb);
          return { status: 'ok', referenceRpm: lower.rpm + fraction * (upper.rpm - lower.rpm) };
        }
      }
      return { status: 'error' };
    }
  });
})();
