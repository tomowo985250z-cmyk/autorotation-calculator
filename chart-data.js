/* Image-space RPM interpolation. Uses the retained numerical calibration.
 * 332 is a measured lower reference as well as an advisory minimum.
 * 385 MAXIMUM is warning-only; RPM interpolation goes directly from 380 to 390.
 */
(() => {
  'use strict';
  const data = globalThis.AutorotationRpmImageData;
  const references = Object.freeze([data.minimum, ...data.ordinary]);
  function lineXAtY(line, y) {
    if (!Number.isFinite(y) || !line?.points?.length) return null;
    const points = line.points;
    if (Math.abs(y - points[0].y) < 1e-9) return points[0].x;
    if (Math.abs(y - points[points.length - 1].y) < 1e-9) return points[points.length - 1].x;
    if (y < points[0].y || y > points[points.length - 1].y) return null;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (y <= b.y) return a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x);
    }
    return null;
  }
  function imagePointFor(point) {
    const config = globalThis.AutorotationRpmCalibration;
    if (config?.image?.width !== data.width || config?.image?.height !== data.height) return null;
    const projected = globalThis.AutorotationRpmCoordinates?.project(point, config);
    if (projected?.status !== 'ok') return null;
    return Object.freeze({ x: projected.leftPercent / 100 * data.width, y: projected.topPercent / 100 * data.height });
  }
  function checkBoundaries(point) {
    const imagePoint = imagePointFor(point);
    function check(line, kind) {
      if (!imagePoint) return { status: 'unknown' };
      const x = lineXAtY(line, imagePoint.y);
      if (x === null) return { status: 'unknown' };
      // Only numerical roundoff tolerance, far below the image reading precision.
      const delta = imagePoint.x - x;
      const violated = kind === 'minimum' ? delta < -1e-9 : delta > 1e-9;
      if (!violated) return { status: 'within-boundary', x };
      return kind === 'minimum'
        ? { status: 'below-minimum', message: '332 RPM MINIMUM未満', x }
        : { status: 'above-maximum', message: '385 RPM MAXIMUM超過', x };
    }
    const minimum = check(data.minimum, 'minimum'), maximum = check(data.maximum, 'maximum');
    const outside = minimum.status === 'below-minimum' || maximum.status === 'above-maximum';
    const inside = minimum.status === 'within-boundary' && maximum.status === 'within-boundary';
    return { status: outside ? 'outside-boundaries' : inside ? 'within-boundaries' : 'unconfirmed', minimum, maximum, imagePoint };
  }
  function lookup(point) {
    const imagePoint = imagePointFor(point);
    if (!imagePoint) return { status: 'out-of-range' };
    const { x, y } = imagePoint;
    // Never bridge a missing reference line or extrapolate beyond measured y spans.
    for (let i = 1; i < references.length; i++) {
      const left = references[i - 1], right = references[i];
      const leftX = lineXAtY(left, y), rightX = lineXAtY(right, y);
      if (leftX === null || rightX === null || rightX <= leftX) continue;
      if (x < leftX - 1e-9 || x > rightX + 1e-9) continue;
      const fraction = (x - leftX) / (rightX - leftX);
      return { status: 'ok', referenceRpm: left.rpm + fraction * (right.rpm - left.rpm), imagePoint,
        interpolation: Object.freeze({ leftRpm: left.rpm, rightRpm: right.rpm, leftX, rightX, fraction }) };
    }
    return { status: 'out-of-range', imagePoint };
  }
  globalThis.AutorotationChart = Object.freeze({
    provisional: true, label: 'チャート画像からの暫定デジタイズ値・原典確認前',
    lines: data.ordinary, boundaries: Object.freeze({ minimum: data.minimum, maximum: data.maximum }),
    references, lineXAtY, imagePointFor, checkBoundaries, lookup
  });
})();
