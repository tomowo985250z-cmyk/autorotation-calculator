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
  // The same 46 regression checks performed for the provisional interpolation.
  const expectedLines = [[340,2050],[345,2103],[350,2143],[355,2188],
    [360,2234],[365,2279],[370,2329],[375,2378],[380,2426],[385,2474],[390,2538]];
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
  check('No extrapolation below', chart.lookup({ densityAltitudeFt: 0, grossWeightLb: 2049 }).status === 'out-of-range');
  check('No extrapolation above', chart.lookup({ densityAltitudeFt: 0, grossWeightLb: 2539 }).status === 'out-of-range');
  check('Incomplete input', calculator.rotorSpeed({ densityAltitudeFt: null, grossWeightLb: 2200 }, chart).status === 'incomplete');
  const regressionPassed = passed;

  const point = { densityAltitudeFt: 0, grossWeightLb: 15 };
  let result = chart.checkBoundaries(point);
  check('Absent boundaries stay unconfirmed', result.status === 'unconfirmed' && result.minimum.status === 'unregistered' && result.maximum.status === 'unregistered');
  check('No invented geometry', chart.boundaries.minimum.coordinates === null && chart.boundaries.maximum.coordinates === null);
  check('Independent boundary labels', chart.boundaries.minimum.label === '332 RPM MINIMUM' && chart.boundaries.maximum.label === '385 RPM MAXIMUM');
  check('335 is not populated', !chart.lines.some(line => line.rpm === 335));
  check('Original provisional state', chart.provisional && chart.label.includes('原典確認前'));
  // Artificial thresholds test evaluator wiring, not any proposed real boundary.
  const fixtures = {
    minimum: { coordinates: { threshold: 10 }, evaluate: (p, data) => ({ status: 'ok', violated: p.grossWeightLb < data.threshold }) },
    maximum: { coordinates: { threshold: 20 }, evaluate: (p, data) => ({ status: 'ok', violated: p.grossWeightLb > data.threshold }) }
  };
  check('Inside both registered boundaries', chart.checkBoundaries(point, fixtures).status === 'within-boundaries');
  result = chart.checkBoundaries({ ...point, grossWeightLb: 9 }, fixtures);
  check('Below minimum', result.status === 'outside-boundaries' && result.minimum.message === 'MINIMUM未満');
  result = chart.checkBoundaries({ ...point, grossWeightLb: 21 }, fixtures);
  check('Above maximum', result.status === 'outside-boundaries' && result.maximum.message === 'MAXIMUM超過');
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
  check('Boundary testing never installs fixtures', chart.boundaries.minimum.coordinates === null && chart.checkBoundaries(point).status === 'unconfirmed');
  const rpm = calculator.rotorSpeed({ densityAltitudeFt: 2000, grossWeightLb: 2394 }, chart);
  check('385 boundary never clamps RPM or ±5', rpm.referenceRpm === 387.5 && rpm.minRpm === 382.5 && rpm.maxRpm === 392.5);
  globalThis.AutorotationTestResults = { regressionPassed, boundaryPassed: passed - regressionPassed, totalPassed: passed };
  if (typeof console !== 'undefined') console.log(globalThis.AutorotationTestResults);
})();
