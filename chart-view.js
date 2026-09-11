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
  function create({ image, dot, status, frame }, config) {
    let point = null, loaded = false, failed = false;
    const src = config?.image?.src;
    function render() {
      dot.hidden = true;
      dot.style.left = '';
      dot.style.top = '';
      if (!src) { status.textContent = 'チャート画像未登録・プロット領域未設定'; return; }
      if (failed) { status.textContent = 'チャート画像を読み込めません'; return; }
      if (!loaded) { status.textContent = 'チャート画像を読み込み中'; return; }
      if (!validCalibration(config)) { status.textContent = 'プロット領域・軸範囲未設定：ドットは表示しません'; return; }
      if (image.naturalWidth !== config.image.width || image.naturalHeight !== config.image.height) {
        status.textContent = '画像サイズが設定と一致しません：ドットは表示しません'; return;
      }
      const projected = project(point, config);
      if (projected.status !== 'ok') {
        status.textContent = projected.status === 'out-of-range' ? 'チャート表示範囲外' : '計算条件を入力してください'; return;
      }
      dot.style.left = `${projected.leftPercent}%`;
      dot.style.top = `${projected.topPercent}%`;
      dot.hidden = false;
      status.textContent = '赤いドット：現在の計算点（原典確認前）';
    }
    image.addEventListener('load', () => { loaded = image.naturalWidth > 0; failed = !loaded; render(); });
    image.addEventListener('error', () => { loaded = false; failed = true; render(); });
    frame.hidden = !src;
    if (src) {
      image.src = src;
      if (image.complete && image.naturalWidth > 0) loaded = true;
    }
    render();
    return Object.freeze({ update(nextPoint) {
      point = nextPoint ? { densityAltitudeFt: nextPoint.densityAltitudeFt, grossWeightLb: nextPoint.grossWeightLb } : null;
      render();
    } });
  }
  globalThis.AutorotationChartView = Object.freeze({ project, create });
})();
