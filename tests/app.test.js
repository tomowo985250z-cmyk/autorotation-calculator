/* Run: node tests/app.test.js
 * DOM wiring tests: verifies displayed text, not browser layout.
 */
(() => {
  'use strict';
  require('../calculator.js');
  require('../chart-view-config.js');
  require('../chart-view.js');
  require('../rpm-image-data.js');
  require('../chart-data.js');
  const originalDocument = globalThis.document;
  const originalChart = globalThis.AutorotationChart;
  const names = ['pressureAltitude', 'oat', 'aircraftWeight', 'crewWeight', 'fuelWeight'];
  const outputs = {};
  const handlers = {};
  const note = { hidden: true };
  const form = { elements: {}, addEventListener: (event, handler) => { handlers[event] = handler; } };
  for (const name of names) form.elements[name] = { value: '', validity: { badInput: false }, setAttribute() {} };
  globalThis.document = {
    getElementById(id) { return id === 'conditions' ? form : (outputs[id] ??= { textContent: '', style: {}, addEventListener() {}, complete: true, naturalWidth: 750, naturalHeight: 1334 }); },
    querySelector() { return note; }
  };
  let passed = 0;
  function check(name, condition) {
    if (!condition) throw new Error(name);
    passed++;
  }
  function input(height, weight) {
    const values = [height, 15 - 1.98 * height / 1000, weight - 200, 100, 100];
    names.forEach((name, i) => { form.elements[name].value = String(values[i]); });
    handlers.input();
  }
  try {
    require('../app.js');
    check('Initial empty state', outputs.referenceRpm.textContent === '—' && outputs['boundary-status'].textContent === '入力待ち');
    for (const height of [0]) {
      input(height, 2508.059701492537);
      check(`387.5 displayed with warning at ${height}`, outputs.referenceRpm.textContent === '387.5'
        && outputs.rpmRange.textContent === '382.5 ～ 392.5'
        && outputs['boundary-status'].textContent === '385 RPM MAXIMUM超過'
        && outputs['chart-badge'].textContent === '暫定算出' && !note.hidden);
    }
    input(0, 2200);
    check('Warning clears independently', outputs.referenceRpm.textContent === '356.4' && outputs.rpmRange.textContent === '351.4 ～ 361.4' && outputs['boundary-status'].textContent === '参考境界内（暫定）');
    input(0, 1900);
    check('No invented data below series', outputs.referenceRpm.textContent === '—' && outputs['boundary-status'].textContent === '332 RPM MINIMUM未満');
    // Synthetic future data: confirms the UI has no hard-coded 332 clamp.
    globalThis.AutorotationChart = { checkBoundaries: originalChart.checkBoundaries, lookup: () => ({ status: 'ok', referenceRpm: 330 }) };
    input(0, 1900);
    check('Below-332 computed values stay visible', outputs.referenceRpm.textContent === '330' && outputs.rpmRange.textContent === '325 ～ 335' && outputs['boundary-status'].textContent === '332 RPM MINIMUM未満');
    globalThis.AutorotationChart = originalChart;
    input(0, 2536.417910447761);
    check('390 endpoint visible above maximum', outputs.referenceRpm.textContent === '390' && outputs.rpmRange.textContent === '385 ～ 395' && outputs['boundary-status'].textContent === '385 RPM MAXIMUM超過');
    form.elements.crewWeight.value = '';
    handlers.input();
    check('Incomplete input clears stale RPM and warning', outputs.referenceRpm.textContent === '—' && outputs.rpmRange.textContent === '未算出' && outputs['boundary-status'].textContent === '入力待ち' && !note.hidden);
    globalThis.AutorotationUiTestResults = { passed };
    if (typeof console !== 'undefined') console.log(globalThis.AutorotationUiTestResults);
  } finally {
    globalThis.document = originalDocument;
    globalThis.AutorotationChart = originalChart;
  }
})();
