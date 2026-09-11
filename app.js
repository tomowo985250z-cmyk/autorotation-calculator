(() => {
  'use strict';
  const calculator = globalThis.AutorotationCalculator;
  const form = document.getElementById('conditions');
  const chartView = globalThis.AutorotationChartView?.create({
    image: document.getElementById('performance-chart'),
    dot: document.getElementById('chart-dot'),
    status: document.getElementById('chart-view-status'),
    frame: document.getElementById('chart-frame')
  }, globalThis.AutorotationChartViewConfig);
  const fields = ['pressureAltitude', 'oat', 'aircraftWeight', 'crewWeight', 'fuelWeight'];
  const format = value => new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(value);
  const display = (id, value) => { document.getElementById(id).textContent = value; };
  function update() {
    const values = {};
    for (const name of fields) {
      const input = form.elements[name];
      const parsed = calculator.parseInput(input.value, name);
      if (input.validity.badInput) parsed.error = '有効な数値を入力してください。';
      values[name] = parsed.error ? null : parsed.value;
      input.setAttribute('aria-invalid', String(Boolean(parsed.error)));
      display(`${name}-error`, parsed.error);
    }
    display('crewKg', values.crewWeight === null ? '— kg' : `${format(calculator.lbToKg(values.crewWeight))} kg`);
    const density = values.pressureAltitude !== null && values.oat !== null ? calculator.densityAltitude(values.pressureAltitude, values.oat) : null;
    const weight = ['aircraftWeight', 'crewWeight', 'fuelWeight'].every(name => values[name] !== null) ? calculator.totalWeight(values.aircraftWeight, values.crewWeight, values.fuelWeight) : null;
    display('densityAltitude', density === null ? '—' : format(density));
    display('totalWeight', weight === null ? '—' : format(weight));
    if (weight === null && ['aircraftWeight', 'crewWeight', 'fuelWeight'].every(name => values[name] !== null)) display('fuelWeight-error', '総重量が計算可能な範囲を超えています。');
    const result = calculator.rotorSpeed({ densityAltitudeFt: density, grossWeightLb: weight }, globalThis.AutorotationChart);
    chartView?.update(result.point);
    display('referenceRpm', result.status === 'ok' ? format(result.referenceRpm) : '—');
    display('rpmRange', result.status === 'ok' ? `${format(result.minRpm)} ～ ${format(result.maxRpm)}` : '未算出');
    const messages = {
      unavailable: ['チャート未登録', '実チャートのデータが未登録のため、回転数は算出しません。'],
      incomplete: ['入力待ち', 'すべての項目に有効な値を入力してください。'],
      'out-of-range': ['補間データ範囲外', '画像上で確認できたRPM線の間だけを補間します。確認点の外側には外挿せず、計算点と参考境界の判定を保持します。'],
      error: ['算出エラー', 'チャートデータまたは算出処理を確認してください。'],
      ok: ['暫定算出', '赤点と同じ画像座標で左右のRPM線を補間した基準値と±5 RPMです。参考境界を超えても数値を制限・補正しません。']
    };
    display('chart-badge', messages[result.status][0]);
    display('chart-status', messages[result.status][1]);
    const warnings = [result.boundary.minimum, result.boundary.maximum]
      .filter(item => item?.status === 'below-minimum' || item?.status === 'above-maximum')
      .map(item => item.message);
    display('boundary-status', !result.point ? '入力待ち'
      : warnings.length ? warnings.join(' ／ ')
      : result.boundary.status === 'within-boundaries' ? '参考境界内（暫定）' : '境界判定未確定');
    document.querySelector('.data-note').hidden = false;
  }
  form.addEventListener('input', update);
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', () => setTimeout(update, 0));
  update();
})();
