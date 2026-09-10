(() => {
  'use strict';
  const calculator = globalThis.AutorotationCalculator;
  const form = document.getElementById('conditions');
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
    display('referenceRpm', result.status === 'ok' ? format(result.referenceRpm) : '—');
    display('rpmRange', result.status === 'ok' ? `${format(result.minRpm)} ～ ${format(result.maxRpm)}` : '未算出');
    const messages = {
      unavailable: ['チャート未登録', '実チャートのデータが未登録のため、回転数は算出しません。'],
      incomplete: ['入力待ち', 'すべての項目に有効な値を入力してください。'],
      'out-of-range': ['データ範囲外', '入力条件が登録された340〜390 RPM線の範囲外です。線の外側への外挿は行いません。'],
      error: ['算出エラー', 'チャートデータまたは算出処理を確認してください。'],
      ok: ['暫定算出', '暫定モデルによる基準値と±5 RPMです。未確定の運用境界による制限は適用していません。']
    };
    display('chart-badge', messages[result.status][0]);
    display('chart-status', messages[result.status][1]);
    document.querySelector('.data-note').hidden = false;
  }
  form.addEventListener('input', update);
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', () => setTimeout(update, 0));
  update();
})();
