/* User-supplied provisional digitization, not verified against the original.
 * Altitude validity and 332 MINIMUM / 335 / 385 MAXIMUM boundaries are unresolved.
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
  globalThis.AutorotationChart = Object.freeze({
    provisional: true,
    label: 'チャート画像からの暫定デジタイズ値・原典確認前',
    lines,
    weightShiftLbPer1000Ft,
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
