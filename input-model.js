/* UI state only. Physical calculations remain in calculator.js. */
(() => {
  'use strict';
  const range = (min, max, step) => Object.freeze(Array.from({ length: (max - min) / step + 1 }, (_, i) => min + i * step));
  const weights = range(0, 3000, 10);
  const fields = Object.freeze({
    crewWeight: Object.freeze({ label: '乗員', unit: 'lb', initial: 300, options: range(250, 350, 10) }),
    otherWeight: Object.freeze({ label: 'その他', unit: 'lb', initial: 0, options: weights }),
    oat: Object.freeze({ label: 'OAT', unit: '℃', initial: 20, options: range(-20, 40, 1) }),
    fuelWeight: Object.freeze({ label: '残燃料', unit: 'lb', initial: 150, options: range(0, 500, 10) }),
    pressureAltitude: Object.freeze({ label: '気圧高度', unit: 'ft', initial: 2000, options: Object.freeze([2000, 1500, 1000]) })
  });
  function create(calculator) {
    let baseText, values, confirmed, editing;
    function reset() {
      baseText = '';
      values = Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.initial]));
      confirmed = Object.fromEntries(['aircraftWeight', ...Object.keys(fields)].map(key => [key, false]));
      editing = null;
    }
    function snapshot() {
      const parsed = baseText.trim() === '' ? 0 : Number(baseText);
      let error = !Number.isFinite(parsed) || parsed < 0 || parsed > Number.MAX_SAFE_INTEGER
        ? '基本重量は0以上の有効な数値を入力してください。' : '';
      let totalWeight = calculator.totalWeight(error ? 0 : parsed, values.crewWeight, values.fuelWeight + values.otherWeight);
      if (totalWeight === null) {
        error = '総重量が計算可能な範囲を超えています。';
        totalWeight = values.crewWeight + values.fuelWeight + values.otherWeight;
      }
      return { baseText, error, totalWeight, values: { ...values, aircraftWeight: error ? 0 : parsed },
        confirmed: { ...confirmed }, editing: editing?.key ?? null,
        densityAltitude: calculator.densityAltitude(values.pressureAltitude, values.oat) };
    }
    reset();
    return Object.freeze({ snapshot, reset,
      setBase(text) { baseText = String(text); confirmed.aircraftWeight = false; },
      confirmBase() {
        if (snapshot().error) return false;
        if (baseText.trim() === '') baseText = '0';
        confirmed.aircraftWeight = true;
        return true;
      },
      open(key) {
        if (!fields[key] || editing) return false;
        editing = { key, value: values[key], confirmed: confirmed[key] };
        return true;
      },
      select(value) {
        if (!editing || !fields[editing.key].options.includes(value)) return false;
        if (values[editing.key] !== value) confirmed[editing.key] = false;
        values[editing.key] = value;
        return true;
      },
      confirm() { if (editing) { confirmed[editing.key] = true; editing = null; } },
      cancel() {
        if (editing) { values[editing.key] = editing.value; confirmed[editing.key] = editing.confirmed; editing = null; }
      }
    });
  }
  globalThis.AutorotationInputs = Object.freeze({ fields, create });
})();
