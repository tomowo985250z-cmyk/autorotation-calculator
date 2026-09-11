/* Measured dark grid-line centers in autorotation-chart.png (750 x 1334).
 * Coordinates are original-image pixels from the upper-left, not label margins.
 * Raster lines are 1–3 px wide; centers have approximately ±1.5 px reading precision.
 * Tick calibration preserves the slightly uneven grid spacing in this image.
 */
const chartViewTicks = pairs => Object.freeze(pairs.map(([value, pixel]) => Object.freeze({ value, pixel })));
globalThis.AutorotationChartViewConfig = Object.freeze({
  image: Object.freeze({ src: './autorotation-chart.png', width: 750, height: 1334 }),
  plot: Object.freeze({ left: 90.5, right: 713.5, top: 125, bottom: 1210.5 }),
  axes: Object.freeze({
    grossWeightLb: Object.freeze({ left: 1700, right: 2600,
      ticks: chartViewTicks([[1700,90.5],[1800,154.5],[1900,221],[2000,291.5],
        [2100,363],[2200,437.5],[2300,509],[2400,576.5],[2500,646.5],[2600,713.5]]) }),
    densityAltitudeFt: Object.freeze({ top: 5000, bottom: -3000,
      ticks: chartViewTicks([[5000,125],[4500,193.5],[4000,260],[3500,327],
        [3000,396.5],[2500,465],[2000,535.5],[1500,602.5],[1000,668],
        [500,734.5],[0,803],[-500,869.5],[-1000,939.5],[-1500,1007.5],
        [-2000,1075],[-2500,1142],[-3000,1210.5]]) })
  })
});
