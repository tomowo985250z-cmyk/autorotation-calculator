/* Measured dark grid-line centers in autorotation-chart.png (750 x 1334).
 * Coordinates are original-image pixels from the upper-left, not label margins.
 * Raster lines are 1–3 px wide; centers have approximately ±1.5 px reading precision.
 * Tick calibration preserves the slightly uneven grid spacing in this image.
 */
const rpmTicks = pairs => Object.freeze(pairs.map(([value, pixel]) => Object.freeze({ value, pixel })));
globalThis.AutorotationRpmCalibration = Object.freeze({
  image: Object.freeze({ width: 750, height: 1334 }),
  plot: Object.freeze({ left: 90.5, right: 713.5, top: 125, bottom: 1210.5 }),
  axes: Object.freeze({
    grossWeightLb: Object.freeze({ left: 1700, right: 2600,
      ticks: rpmTicks([[1700,90.5],[1800,154.5],[1900,221],[2000,291.5],
        [2100,363],[2200,437.5],[2300,509],[2400,576.5],[2500,646.5],[2600,713.5]]) }),
    densityAltitudeFt: Object.freeze({ top: 5000, bottom: -3000,
      ticks: rpmTicks([[5000,125],[4500,193.5],[4000,260],[3500,327],
        [3000,396.5],[2500,465],[2000,535.5],[1500,602.5],[1000,668],
        [500,734.5],[0,803],[-500,869.5],[-1000,939.5],[-1500,1007.5],
        [-2000,1075],[-2500,1142],[-3000,1210.5]]) })
  })
});

(() => {
  'use strict';
  function validTicks(ticks, startValue, endValue, startPixel, endPixel) {
    if (ticks === undefined) return true;
    if (!Array.isArray(ticks) || ticks.length < 2) return false;
    if (ticks[0]?.value !== startValue || ticks[0]?.pixel !== startPixel
      || ticks[ticks.length - 1]?.value !== endValue || ticks[ticks.length - 1]?.pixel !== endPixel) return false;
    return ticks.every((tick, i) => Number.isFinite(tick?.value) && Number.isFinite(tick?.pixel)
      && (i === 0 || ((tick.value - ticks[i - 1].value) * (endValue - startValue) > 0 && tick.pixel > ticks[i - 1].pixel)));
  }
  function calibratedPixel(value, ticks, fallback) {
    if (!ticks) return fallback;
    for (let i = 1; i < ticks.length; i++) {
      const a = ticks[i - 1], b = ticks[i];
      if (value >= Math.min(a.value, b.value) && value <= Math.max(a.value, b.value)) {
        return a.pixel + (value - a.value) / (b.value - a.value) * (b.pixel - a.pixel);
      }
    }
    return fallback;
  }
  function validCalibration(config) {
    const image = config?.image, plot = config?.plot, x = config?.axes?.grossWeightLb, y = config?.axes?.densityAltitudeFt;
    if (!image || !plot || !x || !y) return false;
    if (![image.width, image.height, plot.left, plot.right, plot.top, plot.bottom, x.left, x.right, y.top, y.bottom].every(Number.isFinite)) return false;
    return image.width > 0 && image.height > 0
      && 0 <= plot.left && plot.left < plot.right && plot.right <= image.width
      && 0 <= plot.top && plot.top < plot.bottom && plot.bottom <= image.height
      && x.left < x.right && y.bottom < y.top
      && validTicks(x.ticks, x.left, x.right, plot.left, plot.right)
      && validTicks(y.ticks, y.top, y.bottom, plot.top, plot.bottom);
  }
  // Convert unrounded physical coordinates through plot edges to image percentages.
  // Optional measured tick centers correct image spacing between grid lines.
  // No clipping, no dependency on RPM or advisory boundaries.
  function project(point, config) {
    if (!validCalibration(config)) return { status: 'uncalibrated' };
    if (!point || !Number.isFinite(point.grossWeightLb) || !Number.isFinite(point.densityAltitudeFt)) return { status: 'incomplete' };
    const { image, plot, axes } = config;
    const x = (point.grossWeightLb - axes.grossWeightLb.left) / (axes.grossWeightLb.right - axes.grossWeightLb.left);
    const y = (axes.densityAltitudeFt.top - point.densityAltitudeFt) / (axes.densityAltitudeFt.top - axes.densityAltitudeFt.bottom);
    if (x < 0 || x > 1 || y < 0 || y > 1) return { status: 'out-of-range' };
    return { status: 'ok',
      leftPercent: calibratedPixel(point.grossWeightLb, axes.grossWeightLb.ticks, plot.left + x * (plot.right - plot.left)) / image.width * 100,
      topPercent: calibratedPixel(point.densityAltitudeFt, axes.densityAltitudeFt.ticks, plot.top + y * (plot.bottom - plot.top)) / image.height * 100 };
  }
  globalThis.AutorotationRpmCoordinates = Object.freeze({ project });
})();
