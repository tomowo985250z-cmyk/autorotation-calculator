/* node tests/chart-view.test.js
 * All image/axis numbers below are synthetic fixtures, not chart calibration.
 * DOM mocks test coordinate wiring; they do not verify browser rendering.
 */
(() => {
  'use strict';
  require('../calculator.js');
  require('../chart-view-config.js');
  require('../chart-view.js');
  require('../rpm-image-data.js');
  require('../chart-data.js');
  const view = globalThis.AutorotationChartView;
  const productionConfig = globalThis.AutorotationChartViewConfig;
  const unsetConfig = { image: { src: null }, plot: { left: null, right: null, top: null, bottom: null } };
  const fixture = {
    image: { src: 'synthetic-test-only.png', width: 1000, height: 800 },
    plot: { left: 100, right: 900, top: 80, bottom: 680 },
    axes: { grossWeightLb: { left: 1800, right: 2800 }, densityAltitudeFt: { top: 10000, bottom: -2000 } }
  };
  let passed = 0;
  const check = (name, condition) => { if (!condition) throw Error(name); passed++; };
  const near = (a, b) => Math.abs(a - b) < 1e-10;
  const point = { grossWeightLb: 2300, densityAltitudeFt: 4000 };
  check('Actual image dimensions', productionConfig.image.width === 750 && productionConfig.image.height === 1334);
  check('Unset calibration blocks projection', view.project(point, unsetConfig).status === 'uncalibrated');
  const center = view.project(point, fixture);
  check('Plot midpoint with asymmetric margins', center.leftPercent === 50 && center.topPercent === 47.5);
  const topLeft = view.project({ grossWeightLb: 1800, densityAltitudeFt: 10000 }, fixture);
  check('Plot top-left, not image top-left', topLeft.leftPercent === 10 && topLeft.topPercent === 10);
  const bottomRight = view.project({ grossWeightLb: 2800, densityAltitudeFt: -2000 }, fixture);
  check('Plot bottom-right', bottomRight.leftPercent === 90 && bottomRight.topPercent === 85);
  for (const p of [{ grossWeightLb: 1799, densityAltitudeFt: 0 }, { grossWeightLb: 2801, densityAltitudeFt: 0 }, { grossWeightLb: 2300, densityAltitudeFt: 10001 }, { grossWeightLb: 2300, densityAltitudeFt: -2001 }]) {
    const result = view.project(p, fixture);
    check('Outside not clamped', result.status === 'out-of-range' && result.leftPercent === undefined && result.topPercent === undefined);
  }
  check('Invalid calibration rejected', view.project(point, { ...fixture, plot: { ...fixture.plot, right: 1001 } }).status === 'uncalibrated');
  check('Missing point', view.project(null, fixture).status === 'incomplete');
  check('Nonfinite point', view.project({ ...point, densityAltitudeFt: NaN }, fixture).status === 'incomplete');
  const fractional = view.project({ grossWeightLb: 2300.123456789, densityAltitudeFt: 4000.123456789 }, fixture);
  check('Unrounded fractional coordinates', near(fractional.leftPercent, 50.00987654312) && fractional.topPercent !== center.topPercent);
  for (const scale of [1, 0.5, 0.32]) {
    check(`Proportional image resize ${scale}`, near(center.leftPercent / 100 * (1000 * scale), 500 * scale) && near(center.topPercent / 100 * (800 * scale), 380 * scale));
  }
  function element() { return { hidden: false, style: {}, textContent: '', events: {}, addEventListener(name, fn) { this.events[name] = fn; }, setAttribute() {} }; }
  const image = Object.assign(element(), { complete: false, naturalWidth: 1000, naturalHeight: 800 });
  const dot = element(), status = element(), frame = element();
  const renderer = view.create({ image, dot, status, frame }, fixture);
  renderer.update(point);
  check('No dot before image load', dot.hidden);
  image.events.load();
  check('Dot appears after image load', !dot.hidden && dot.style.left === '50%' && dot.style.top === '47.5%');
  renderer.update({ grossWeightLb: 3000, densityAltitudeFt: 0 });
  check('Outside hides dot and reports range', dot.hidden && status.textContent === 'チャート表示範囲外' && dot.style.left === '');
  renderer.update(point);
  image.events.error();
  check('Image failure removes stale dot', dot.hidden && status.textContent.includes('読み込めません'));
  image.naturalWidth = 999;
  image.events.load();
  check('Wrong image dimensions cannot silently shift dot', dot.hidden && status.textContent.includes('一致しません'));
  image.naturalWidth = 1000;
  image.events.load();
  renderer.update(null);
  check('Cleared point removes dot', dot.hidden);
  const blank = { image: element(), dot: element(), status: element(), frame: element() };
  view.create(blank, unsetConfig).update(point);
  check('Production missing image remains explicit', blank.dot.hidden && blank.frame.hidden && blank.status.textContent.includes('未登録'));
  // Independently recorded observed grid centers, in original-image pixels.
  for (const [weight, altitude, x, y] of [[1700,5000,90.5,125], [1800,4000,154.5,260],
    [2000,3000,291.5,396.5], [2200,0,437.5,803], [2400,-1000,576.5,939.5],
    [2600,-3000,713.5,1210.5]]) {
    const p = view.project({ grossWeightLb: weight, densityAltitudeFt: altitude }, productionConfig);
    check(`Measured intersection ${weight}/${altitude}`, p.status === 'ok' && near(p.leftPercent * 7.5, x) && near(p.topPercent * 13.34, y));
  }
  const between = view.project({ grossWeightLb: 2250, densityAltitudeFt: 250 }, productionConfig);
  check('Measured interval midpoint', near(between.leftPercent * 7.5, 473.25) && near(between.topPercent * 13.34, 768.75));
  const malformed = { ...productionConfig, axes: { ...productionConfig.axes,
    grossWeightLb: { ...productionConfig.axes.grossWeightLb, ticks: [{ value:1700, pixel:90.5 }, { value:1800, pixel:50 }, { value:2600, pixel:713.5 }] } } };
  check('Reversed measured tick rejected', view.project(point, malformed).status === 'uncalibrated');
  const realElements = {
    image: Object.assign(element(), { complete:true, naturalWidth:750, naturalHeight:1334 }),
    dot: element(), status: element(), frame: element()
  };
  const realRenderer = view.create(realElements, productionConfig);
  const aboveMaximum = globalThis.AutorotationCalculator.rotorSpeed({ densityAltitudeFt:0, grossWeightLb:2507.75 }, globalThis.AutorotationChart);
  realRenderer.update(aboveMaximum.point);
  check('Actual image MAXIMUM exceeded still shows dot', aboveMaximum.boundary.maximum.status === 'above-maximum' && !realElements.dot.hidden && near(parseFloat(realElements.dot.style.left) * 7.5, 651.6925) && near(parseFloat(realElements.dot.style.top) * 13.34, 803));
  for (const p of [{grossWeightLb:1699,densityAltitudeFt:0}, {grossWeightLb:2601,densityAltitudeFt:0},
    {grossWeightLb:2200,densityAltitudeFt:5001}, {grossWeightLb:2200,densityAltitudeFt:-3001}]) {
    realRenderer.update(p);
    check('Actual image range not clipped', realElements.dot.hidden && realElements.status.textContent === 'チャート表示範囲外');
  }
  // Calculation-to-renderer integration; UI events are covered in real Edge (app.test.js).
  function input(oat, weight = 2170, altitude = 3000) {
    const result = globalThis.AutorotationCalculator.rotorSpeed({
      densityAltitudeFt:globalThis.AutorotationCalculator.densityAltitude(altitude,oat),
      grossWeightLb:weight
    },globalThis.AutorotationChart);
    realRenderer.update(result.point);
    return {left:realElements.dot.style.left,top:realElements.dot.style.top,result};
  }
  const cool=input(10),warm=input(20);
  check('Only OAT changes vertical position',warm.left===cool.left&&parseFloat(warm.top)<parseFloat(cool.top));
  const heavier=input(20,2270);
  check('Only weight changes horizontal position',heavier.top===warm.top&&parseFloat(heavier.left)>parseFloat(warm.left));
  const repeated=input(20,2270);
  check('Same input same dot',repeated.top===heavier.top&&repeated.left===heavier.left);
  const beyond=input(15,2507.75,0);
  check('MAXIMUM warning does not hide dot',!realElements.dot.hidden&&beyond.result.boundary.maximum.status==='above-maximum'&&beyond.result.referenceRpm>385);
  const below=input(15,1900,0);
  check('RPM data range does not constrain chart range',!realElements.dot.hidden&&below.result.status==='out-of-range');
  input(15,2801,0);
  check('Outside hides dot with range message',realElements.dot.hidden&&realElements.status.textContent==='チャート表示範囲外');
  input(15,null,0);
  check('Incomplete clears dot',realElements.dot.hidden);

  globalThis.AutorotationChartViewTestResults = { passed };
  if (typeof console !== 'undefined') console.log(globalThis.AutorotationChartViewTestResults);
})();
