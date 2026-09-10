/* Run with Node.js: node tests/chart-data.test.js
 * Boundary fixtures below are synthetic test data, never aircraft performance data.
 */
(() => {
  'use strict';
  if (typeof require === 'function') {
    require('../calculator.js');
    require('../chart-data.js');
  }
  const calculator = globalThis.AutorotationCalculator;
  const chart = globalThis.AutorotationChart;
  let passed = 0;
  function check(name, condition) {
    if (!condition) throw new Error(name);
    passed++;
  }
  // Original 46 regression cases updated for the re-digitized series and independent boundary warnings.
  const expectedLines = [[335,2007],[340,2043],[345,2095],[350,2139],
    [355,2187],[360,2235],[365,2282],[370,2332],[375,2380],[380,2429],[390,2534]];
  for (const [rpm, weight] of expectedLines) {
    for (const height of [0, 1000, 3000]) {
      const result = calculator.rotorSpeed({ densityAltitudeFt: height, grossWeightLb: weight - 56 * height / 1000 }, chart);
      check(`Reference ${rpm} RPM at ${height} ft`, result.status === 'ok' && Math.abs(result.referenceRpm - rpm) < 1e-9);
    }
  }
  for (let i = 1; i < expectedLines.length; i++) {
    const [lowerRpm, lowerWeight] = expectedLines[i - 1];
    const [upperRpm, upperWeight] = expectedLines[i];
    const result = chart.lookup({ densityAltitudeFt: 1000, grossWeightLb: (lowerWeight + upperWeight) / 2 - 56 });
    check(`Midpoint ${lowerRpm} / ${upperRpm}`, Math.abs(result.referenceRpm - (lowerRpm + upperRpm) / 2) < 1e-9);
  }
  check('No extrapolation below', chart.lookup({ densityAltitudeFt: 0, grossWeightLb: 2006 }).status === 'out-of-range');
  check('No extrapolation above', chart.lookup({ densityAltitudeFt: 0, grossWeightLb: 2539 }).status === 'out-of-range');
  check('Incomplete input', calculator.rotorSpeed({ densityAltitudeFt: null, grossWeightLb: 2200 }, chart).status === 'incomplete');
  const regressionPassed = passed;

  const point = { densityAltitudeFt: 0, grossWeightLb: 15 };
  let result = chart.checkBoundaries(point);
  check('Registered boundary takes priority', result.status === 'outside-boundaries' && result.minimum.status === 'below-minimum');
  check('Only supplied anchors stored', chart.boundaries.minimum.coordinates.grossWeightLb === 1947 && chart.boundaries.maximum.coordinates.grossWeightLb === 2483 && chart.boundaries.minimum.coordinates.densityAltitudeFt === 0 && chart.boundaries.maximum.coordinates.densityAltitudeFt === 0);
  check('Independent boundary labels', chart.boundaries.minimum.label === '332 RPM MINIMUM' && chart.boundaries.maximum.label === '385 RPM MAXIMUM');
  check('335 is populated', chart.lines.some(line => line.rpm === 335 && line.weightAtZeroFtLb === 2007));
  check('Original provisional state', chart.provisional && chart.label.includes('原典確認前'));
  // Artificial thresholds test evaluator wiring, not any proposed real boundary.
  const fixtures = {
    minimum: { coordinates: { threshold: 10 }, evaluate: (p, data) => ({ status: 'ok', violated: p.grossWeightLb < data.threshold }) },
    maximum: { coordinates: { threshold: 20 }, evaluate: (p, data) => ({ status: 'ok', violated: p.grossWeightLb > data.threshold }) }
  };
  check('Inside both registered boundaries', chart.checkBoundaries(point, fixtures).status === 'within-boundaries');
  result = chart.checkBoundaries({ ...point, grossWeightLb: 9 }, fixtures);
  check('Below minimum', result.status === 'outside-boundaries' && result.minimum.message === '332 RPM MINIMUM未満');
  result = chart.checkBoundaries({ ...point, grossWeightLb: 21 }, fixtures);
  check('Above maximum', result.status === 'outside-boundaries' && result.maximum.message === '385 RPM MAXIMUM超過');
  check('Minimum equality allowed', chart.checkBoundaries({ ...point, grossWeightLb: 10 }, fixtures).status === 'within-boundaries');
  check('Maximum equality allowed', chart.checkBoundaries({ ...point, grossWeightLb: 20 }, fixtures).status === 'within-boundaries');
  check('Partial registration is not confirmed', chart.checkBoundaries(point, { minimum: fixtures.minimum }).status === 'unconfirmed');
  const unavailable = { ...fixtures, minimum: { coordinates: {}, evaluate: () => ({ status: 'unknown' }) } };
  check('Outside evaluator coverage is unknown', chart.checkBoundaries(point, unavailable).status === 'unconfirmed');
  const broken = { ...fixtures, minimum: { coordinates: {}, evaluate: () => { throw new Error('fixture'); } } };
  check('Exceptions do not imply within limits', chart.checkBoundaries(point, broken).minimum.status === 'error');
  const malformed = { ...fixtures, minimum: { coordinates: {}, evaluate: () => ({ status: 'ok', violated: 'false' }) } };
  check('Invalid result rejected', chart.checkBoundaries(point, malformed).minimum.status === 'error');
  check('Invalid input rejected', chart.checkBoundaries({ ...point, densityAltitudeFt: NaN }, fixtures).minimum.status === 'invalid-input');
  check('Null input rejected', chart.checkBoundaries(null, fixtures).status === 'unconfirmed');
  check('Boundary testing never installs fixtures', chart.boundaries.minimum.coordinates.grossWeightLb === 1947 && chart.checkBoundaries(point).status === 'outside-boundaries');
  const rpm = calculator.rotorSpeed({ densityAltitudeFt: 2000, grossWeightLb: 2394 }, chart);
  check('Warning retains RPM and ±5', rpm.status === 'ok' && rpm.referenceRpm > 385 && rpm.minRpm === rpm.referenceRpm - 5 && rpm.maxRpm === rpm.referenceRpm + 5 && rpm.boundary.maximum.status === 'above-maximum');
  check('Exact ordinary data', JSON.stringify(chart.lines.map(line => [line.rpm, line.weightAtZeroFtLb])) === JSON.stringify(expectedLines));
  check('No ordinary 385 line', !chart.lines.some(line => line.rpm === 385));
  check('Separate boundary slopes', chart.boundaries.minimum.altitudeData.weightDecreaseLbPerFt === 0.060 && chart.boundaries.maximum.altitudeData.weightDecreaseLbPerFt === 0.060 && chart.weightShiftLbPer1000Ft === 56);
  for (const height of [-1000, 0, 1000, 3000]) {
    for (const weightAtZero of [2429.1, 2481.5, 2483, 2484, 2534, 2600]) {
      const result = calculator.rotorSpeed({ densityAltitudeFt: height, grossWeightLb: weightAtZero - 56 * height / 1000 }, chart);
      check(`Independent upper interpolation ${height}/${weightAtZero}`, result.status === (weightAtZero > 2534 ? 'out-of-range' : 'ok') && result.boundary.status === (weightAtZero + 0.004 * height > 2483 ? 'outside-boundaries' : 'within-boundaries'));
    }
    check(`Boundary uses independent slope at ${height}`, chart.checkBoundaries({ densityAltitudeFt: height, grossWeightLb: 2483 - 56 * height / 1000 }).status === (height > 0 ? 'outside-boundaries' : 'within-boundaries'));
  }
  const ordinary = calculator.rotorSpeed({ densityAltitudeFt: 1000, grossWeightLb: 1969 }, chart);
  check('335–340 midpoint and ±5', ordinary.referenceRpm === 337.5 && ordinary.minRpm === 332.5 && ordinary.maxRpm === 342.5);
  // Independent literal expectations for 0 / +1000 / -1000 ft, at and ±1 lb.
  for (const [height, minimum, maximum] of [[0, 1947, 2483], [1000, 1887, 2423], [-1000, 2007, 2543]]) {
    for (const [kind, boundary] of [['minimum', minimum], ['maximum', maximum]]) {
      for (const delta of [-1, 0, 1]) {
        const point = { densityAltitudeFt: height, grossWeightLb: boundary + delta };
        const violation = kind === 'minimum' && delta < 0 ? 'below-minimum'
          : kind === 'maximum' && delta > 0 ? 'above-maximum' : null;
        const checked = chart.checkBoundaries(point);
        check(`Boundary ${kind} ${height} ft ${delta} lb`, violation
          ? checked.status === 'outside-boundaries' && checked[kind].status === violation
          : checked.status === 'within-boundaries');
        const calculated = calculator.rotorSpeed(point, chart);
        check(`Independent RPM and unchanged point ${kind} ${height} ft ${delta} lb`,
          calculated.status === (kind === 'minimum' ? 'out-of-range' : 'ok')
          && calculated.point.densityAltitudeFt === height && calculated.point.grossWeightLb === boundary + delta);
      }
    }
  }
  for (const height of [0, 1000, -1000]) {
    const point = { densityAltitudeFt: height, grossWeightLb: 2507.75 - 0.056 * height };
    const result = calculator.rotorSpeed(point, chart);
    check(`387.5 above MAXIMUM at ${height}`, result.status === 'ok' && result.referenceRpm === 387.5 && result.minRpm === 382.5 && result.maxRpm === 392.5 && result.boundary.maximum.status === 'above-maximum');
  }
  const precise = { densityAltitudeFt: 1234.56789, grossWeightLb: 2438.7654321 };
  const saved = calculator.rotorSpeed(precise, chart);
  check('Immutable unrounded point', Object.isFrozen(saved.point) && saved.point !== precise && saved.point.densityAltitudeFt === precise.densityAltitudeFt && saved.point.grossWeightLb === precise.grossWeightLb);
  precise.grossWeightLb = 1;
  check('Caller edits do not move dot', saved.point.grossWeightLb === 2438.7654321);
  const restored = JSON.parse(JSON.stringify(saved));
  check('Serializable chart coordinates', restored.point.densityAltitudeFt === saved.point.densityAltitudeFt && restored.point.grossWeightLb === saved.point.grossWeightLb);
  check('No stale point for incomplete input', calculator.rotorSpeed({ densityAltitudeFt: null, grossWeightLb: 2300 }, chart).point === null);
  const noData = calculator.rotorSpeed({ densityAltitudeFt: -1000.125, grossWeightLb: 1000.375 }, chart);
  check('Out-of-data point and warning retained', noData.status === 'out-of-range' && noData.point.densityAltitudeFt === -1000.125 && noData.point.grossWeightLb === 1000.375 && noData.boundary.minimum.status === 'below-minimum');
  // Synthetic provider tests future below-332 support, without inventing real data.
  const low = calculator.rotorSpeed({ densityAltitudeFt: 0, grossWeightLb: 1900 }, {
    checkBoundaries: chart.checkBoundaries, lookup: () => ({ status: 'ok', referenceRpm: 330 })
  });
  check('Future below-332 data is not clipped', low.referenceRpm === 330 && low.minRpm === 325 && low.maxRpm === 335 && low.boundary.minimum.status === 'below-minimum');
  const missing = calculator.rotorSpeed({ densityAltitudeFt: 0, grossWeightLb: 2507.75 }, { lookup: chart.lookup });
  check('Missing boundaries do not block RPM', missing.referenceRpm === 387.5 && missing.boundary.status === 'unconfirmed');
  const failed = calculator.rotorSpeed({ densityAltitudeFt: 0, grossWeightLb: 2507.75 }, {
    lookup: chart.lookup, checkBoundaries: () => { throw new Error('synthetic failure'); }
  });
  check('Boundary error does not block RPM', failed.referenceRpm === 387.5 && failed.boundary.status === 'unconfirmed');
  globalThis.AutorotationTestResults = { regressionPassed, boundaryPassed: passed - regressionPassed, totalPassed: passed };
  if (typeof console !== 'undefined') console.log(globalThis.AutorotationTestResults);
})();
