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
  const storageKey = 'autorotation-calculator.inputs.v1';
  function create(calculator, storage = null) {
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
    // Restore inputs only. Reject the entire record if any field is invalid.
    try {
      const saved = JSON.parse(storage?.getItem(storageKey) ?? 'null');
      if (saved !== null) {
        const keys = Object.keys(fields);
        const basic = typeof saved.baseText === 'string' ? Number(saved.baseText) : NaN;
        if (saved.version !== 1 || !Number.isFinite(basic) || basic < 0 || basic > Number.MAX_SAFE_INTEGER
          || !saved.values || !saved.confirmed
          || !keys.every(key => fields[key].options.includes(saved.values[key]))
          || !['aircraftWeight', ...keys].every(key => typeof saved.confirmed[key] === 'boolean')
          || calculator.totalWeight(basic, saved.values.crewWeight, saved.values.fuelWeight + saved.values.otherWeight) === null) throw Error('Invalid saved inputs');
        baseText = saved.baseText;
        values = Object.fromEntries(keys.map(key => [key, saved.values[key]]));
        confirmed = Object.fromEntries(['aircraftWeight', ...keys].map(key => [key, saved.confirmed[key]]));
      }
    } catch { reset(); }
    let lastSaved;
    function save() {
      try {
        const json = JSON.stringify({ version:1, baseText, values, confirmed });
        if (json !== lastSaved) { storage?.setItem(storageKey, json); lastSaved = json; }
      } catch { /* Storage denied or full: keep the calculator usable in memory. */ }
    }
    save();
    const actions = { reset,
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
    };
    return Object.freeze({ snapshot, ...Object.fromEntries(Object.entries(actions).map(([key, action]) =>
      [key, (...args) => { const result = action(...args); save(); return result; }])) });
  }
  globalThis.AutorotationInputs = Object.freeze({ fields, create, storageKey });
})();
