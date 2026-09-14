(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const frame = get('chart-frame');
  const title = get('chart-page-title');
  const count = get('chart-page-count');
  const controls = { red: get('red-hex'), blue: get('blue-hex') };
  const pages = [
    { title: 'ピッチリンク用', angles: { red: 0, blue: 0 } },
    { title: 'トリムタブ用', angles: { red: 0, blue: 0 } }
  ];
  let currentPage = 0;

  function render() {
    const page = pages[currentPage];
    title.textContent = page.title;
    count.textContent = `${currentPage + 1} / ${pages.length}`;
    for (const color of Object.keys(controls)) {
      controls[color].firstElementChild.style.transform = `rotate(${page.angles[color]}deg)`;
    }
  }

  function changePage(step) {
    currentPage = (currentPage + step + pages.length) % pages.length;
    render();
  }

  get('chart-page-prev').addEventListener('click', () => changePage(-1));
  get('chart-page-next').addEventListener('click', () => changePage(1));

  let swipeStart = null;
  frame.addEventListener('touchstart', event => {
    if (event.touches.length !== 1 || event.target.closest('.hex-control')) return;
    swipeStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  frame.addEventListener('touchend', event => {
    if (!swipeStart || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - swipeStart.x;
    const dy = event.changedTouches[0].clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.3) changePage(dx < 0 ? 1 : -1);
  }, { passive: true });
  frame.addEventListener('touchcancel', () => { swipeStart = null; }, { passive: true });

  for (const [color, control] of Object.entries(controls)) {
    let drag = null;
    control.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      pages[currentPage].angles[color] += event.key === 'ArrowRight' ? 15 : -15;
      render();
    });
    const angleAt = event => {
      const rect = control.getBoundingClientRect();
      return Math.atan2(event.clientY - rect.top - rect.height / 2,
        event.clientX - rect.left - rect.width / 2) * 180 / Math.PI;
    };
    control.addEventListener('pointerdown', event => {
      drag = { pointerId: event.pointerId, page: currentPage, angle: angleAt(event) };
      control.setPointerCapture(event.pointerId);
    });
    control.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const angle = angleAt(event);
      const delta = (angle - drag.angle + 540) % 360 - 180;
      pages[drag.page].angles[color] += delta;
      drag.angle = angle;
      if (drag.page === currentPage) render();
    });
    const stop = event => {
      if (drag?.pointerId === event.pointerId) drag = null;
    };
    control.addEventListener('pointerup', stop);
    control.addEventListener('pointercancel', stop);
    control.addEventListener('lostpointercapture', stop);
  }
  render();
})();
