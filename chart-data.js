/* User-supplied provisional digitization, not verified against the original.
 * Boundary slopes are provisional user-supplied data; altitude validity is unverified.
 * 335 is an ordinary reference line. 385 MAXIMUM is only a boundary.
 * 380–390 interpolation is independent of the advisory MAXIMUM boundary.
 */
(() => {
  'use strict';
  const lines = Object.freeze([
    [335, 2007], [340, 2043], [345, 2095], [350, 2139],
    [355, 2187], [360, 2235], [365, 2282], [370, 2332],
    [375, 2380], [380, 2429], [390, 2534]
  ].map(([rpm, weightAtZeroFtLb]) => Object.freeze({ rpm, weightAtZeroFtLb })));
  const weightShiftLbPer1000Ft = 56;
  function boundaryEvaluator(kind) {
    return (point, coordinates, altitudeData) => {
      const boundaryWeightLb = coordinates.grossWeightLb
        - altitudeData.weightDecreaseLbPerFt * (point.densityAltitudeFt - coordinates.densityAltitudeFt);
      if (!Number.isFinite(boundaryWeightLb)) return { status: 'unknown' };
      return { status: 'ok', violated: kind === 'minimum'
        ? point.grossWeightLb < boundaryWeightLb : point.grossWeightLb > boundaryWeightLb };
    };
  }
  // Independent of lines and lookup: RPM labels are identifiers, not scalar limits.
  // Register original chart coordinates and an evaluator together after verification.
  // coordinates: chart-specific geometry, with densityAltitudeFt / grossWeightLb units.
  // evaluate(point, coordinates, altitudeData): { status: 'ok', violated: boolean } or
  // { status: 'unknown' } when the point cannot be assessed (e.g. outside coverage).
  // The evaluator defines the forbidden side using the original chart. No geometry,
  // boundary slope, interpolation method, or side is inferred here. On-boundary
  // points should return violated: false; only strict crossings are violations.
  const boundaries = Object.freeze({
    minimum: Object.freeze({
      label: '332 RPM MINIMUM', provisional: true,
      coordinates: Object.freeze({ densityAltitudeFt: 0, grossWeightLb: 1947 }),
      altitudeData: Object.freeze({ weightDecreaseLbPerFt: 0.060 }), evaluate: boundaryEvaluator('minimum')
    }),
    maximum: Object.freeze({
      label: '385 RPM MAXIMUM', provisional: true,
      coordinates: Object.freeze({ densityAltitudeFt: 0, grossWeightLb: 2483 }),
      altitudeData: Object.freeze({ weightDecreaseLbPerFt: 0.060 }), evaluate: boundaryEvaluator('maximum')
    })
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
        }), definition.coordinates, definition.altitudeData);
        if (result?.status === 'unknown') return { status: 'unknown' };
        if (result?.status !== 'ok' || typeof result.violated !== 'boolean') return { status: 'error' };
        if (!result.violated) return { status: 'within-boundary' };
        return kind === 'minimum'
          ? { status: 'below-minimum', message: '332 RPM MINIMUM未満' }
          : { status: 'above-maximum', message: '385 RPM MAXIMUM超過' };
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
      // Advisory boundaries must never move the input point or suppress interpolation.
      // W(h) = W(0) - 56 * h / 1000. Convert to a zero-altitude equivalent.
      const equivalentWeight = grossWeightLb + weightShiftLbPer1000Ft * densityAltitudeFt / 1000;
      if (!Number.isFinite(equivalentWeight)) return { status: 'error' };
      if (equivalentWeight < lines[0].weightAtZeroFtLb || equivalentWeight > lines[lines.length - 1].weightAtZeroFtLb) return { status: 'out-of-range' };
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
