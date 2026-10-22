// Terrestrial spacetime SI clocks: local mean solar time as a fraction of a day.
// Mounts on <div class="si-clock" data-demo="now|compare"> elements.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const DAY = 86400000;
  const LON_KEY = 'si-clock.lon';
  // Fast indicator: its shape, and whether it steps mark to mark or sweeps.
  const SHAPES = ['hand', 'pip', 'mark', 'none'];
  const MOTIONS = ['step', 'sweep'];

  const frac = (x) => x - Math.floor(x);
  const pad = (n, w) => String(n).padStart(w, '0');

  // Longitude ------------------------------------------------------------
  // Until the browser hands us a position, guess the time zone's meridian
  // (standard offset, ignoring DST) so the clock is at least in the ballpark.

  const geo = { lon: zoneMeridian(), source: 'zone', listeners: [] };

  function zoneMeridian() {
    const y = new Date().getFullYear();
    const std = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset());
    return -std / 4;
  }

  function setGeo(lon, source) {
    geo.lon = lon;
    geo.source = source;
    geo.listeners.forEach((fn) => fn());
  }

  function locate() {
    if (!navigator.geolocation) return;
    const prev = geo.source;
    setGeo(geo.lon, 'locating');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo(p.coords.longitude, 'gps');
        try { localStorage.setItem(LON_KEY, String(p.coords.longitude)); } catch (e) {}
      },
      () => setGeo(geo.lon, prev),
      { maximumAge: 3600000, timeout: 15000 }
    );
  }

  try {
    const saved = parseFloat(localStorage.getItem(LON_KEY));
    if (isFinite(saved)) { geo.lon = saved; geo.source = 'gps'; }
  } catch (e) {}

  // Only refresh silently if permission was already granted; never prompt on load.
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' })
      .then((s) => { if (s.state === 'granted') locate(); })
      .catch(() => {});
  }

  // SVG ------------------------------------------------------------------

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function html(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  // A face with `marks` tick marks, emphasizing every `major`th and `mid`th,
  // and numerals spaced evenly from the top.
  function face(svg, marks, major, mid, numerals) {
    el('circle', { r: 98, class: 'sc-rim' }, svg);
    const g = el('g', {}, svg);
    for (let i = 0; i < marks; i++) {
      const kind = i % major === 0 ? 'major' : i % mid === 0 ? 'mid' : 'minor';
      const len = { major: 9, mid: 6, minor: 3.5 }[kind];
      el('line', { x1: 0, y1: -90, x2: 0, y2: -90 + len, class: 'sc-mark sc-mark-' + kind, transform: `rotate(${(i * 360) / marks})` }, g);
    }
    numerals.forEach((n, i) => {
      const a = (i / numerals.length) * 2 * Math.PI;
      el('text', { x: 72 * Math.sin(a), y: -72 * Math.cos(a), class: 'sc-num' }, svg).textContent = n;
    });
  }

  function hand(parent, cls, len, tail) {
    const g = el('g', { class: cls }, parent);
    el('line', { x1: 0, y1: tail, x2: 0, y2: -len }, g);
    return g;
  }

  // The rim-side fast indicators; CSS shows the shape named by data-fast.
  function fastIndicators(svg) {
    const mark = el('g', { class: 'sc-fast sc-fast-mark' }, svg);
    el('line', { x1: 0, y1: -91, x2: 0, y2: -79 }, mark);
    const pip = el('g', { class: 'sc-fast sc-fast-pip' }, svg);
    el('path', { d: 'M0 -90.5 L-4 -98.5 L4 -98.5 Z' }, pip);
    return [mark, pip];
  }

  function fastHand(svg) {
    const g = el('g', { class: 'sc-fast sc-fast-hand' }, svg);
    el('line', { x1: 0, y1: 18, x2: 0, y2: -88 }, g);
    el('circle', { cy: 12, r: 2.6 }, g);
    return g;
  }

  // Digital readout below the face: the hands sweep every part of the dial,
  // so text inside it is always under one of them at some point in the day.
  function readout() {
    const d = html('div', 'sc-readout');
    const main = html('span', null, d);
    const sup = html('sup', null, d);
    let last = '';
    const show = (a, b) => {
      if (a + b === last) return;
      last = a + b;
      main.textContent = a;
      sup.textContent = b;
    };
    return { el: d, show };
  }

  const rot = (g, deg) => g.setAttribute('transform', `rotate(${deg})`);

  // Builds a clock face of `kind` ('si' or 'civil') and returns its svg and
  // digital readout, with an update(t) that sets both for epoch ms t.
  function clock(kind, fast, motion) {
    const si = kind === 'si';
    const svg = el('svg', {
      viewBox: '-100 -100 200 200',
      class: 'sc-clock sc-' + kind,
      role: 'img',
      'aria-label': si ? 'Solar SI clock' : '12 hour civil clock',
      'data-fast': fast,
    });
    if (si) face(svg, 100, 10, 5, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    else face(svg, 60, 5, 5, ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
    const digits = readout();
    const ind = fastIndicators(svg);
    const slow = hand(svg, 'sc-hand sc-hand-slow', 46, 8);
    const mid = hand(svg, 'sc-hand sc-hand-mid', 72, 10);
    const fh = fastHand(svg);
    el('circle', { r: 4.5, class: 'sc-cap' }, svg);
    el('circle', { r: 1.6, class: 'sc-pin' }, svg);

    function update(t) {
      let a, b, c, text, sup;
      if (si) {
        // Mean solar day fraction at this longitude: .000 at midnight, .500 at noon.
        const f = frac(t / DAY + geo.lon / 360);
        a = f * 360; // deciday hand: one turn per day
        b = frac(f * 10) * 360; // centiday hand: one turn per deciday
        c = frac(f * 1000); // fast: one turn per milliday, a mark per 10 µd
        const n = pad(Math.floor(f * 1e5), 5);
        text = '.' + n.slice(0, 3);
        sup = n.slice(3);
      } else {
        const d = new Date(t);
        const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds() + d.getMilliseconds() / 1000;
        a = ((h % 12) + m / 60 + s / 3600) * 30;
        b = (m + s / 60) * 6;
        c = s / 60;
        text = pad(h, 2) + ':' + pad(m, 2);
        sup = pad(Math.floor(s), 2);
      }
      const marks = si ? 100 : 60;
      const fa = motion === 'sweep' ? c * 360 : (Math.floor(c * marks) * 360) / marks;
      rot(slow, a);
      rot(mid, b);
      rot(fh, fa);
      ind.forEach((g) => rot(g, fa));
      digits.show(text, sup);
    }

    return {
      svg,
      readout: digits.el,
      update,
      setFast: (m) => svg.setAttribute('data-fast', m),
      setMotion: (m) => { motion = m; },
    };
  }

  // Formatting -----------------------------------------------------------

  function hms(ms, signed) {
    const sign = ms < 0 ? '−' : '+';
    let s = Math.round(Math.abs(ms) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    s %= 60;
    const body = (h ? h + 'h ' : '') + (h || m ? pad(m, h ? 2 : 1) + 'm ' : '') + pad(s, h || m ? 2 : 1) + 's';
    return signed ? sign + body : body;
  }

  function lonText() {
    const deg = Math.abs(geo.lon).toFixed(2) + '° ' + (geo.lon < 0 ? 'W' : 'E');
    return geo.source === 'zone' ? '≈' + deg + ' (time zone)' : deg;
  }

  // Days as markup in the post's notation: .547 with 26 superscripted.
  // Readings floor like the face; durations round to the nearest 10 µd.
  function daysHTML(f, round) {
    const n = (round ? Math.round : Math.floor)(f * 1e5);
    const s = pad(n % 1e5, 5);
    return (n >= 1e5 ? Math.floor(n / 1e5) : '') + '.' + s.slice(0, 3) + '<sup>' + s.slice(3) + '</sup>';
  }

  // Solar time minus civil time at instant t, in ms.
  function solarSkew(t) {
    return geo.lon * 240000 + new Date(t).getTimezoneOffset() * 60000;
  }

  // Demos ----------------------------------------------------------------

  const live = [];

  function track(root, fn) {
    const item = { fn, visible: true };
    live.push(item);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { item.visible = es[0].isIntersecting; }).observe(root);
    }
  }

  function geoLine(parent) {
    const line = html('figcaption', 'sc-meta', parent);
    const where = html('span', null, line);
    html('span', 'slash', line, ' // ');
    const skew = html('span', null, line);
    html('span', 'slash', line, ' // ');
    const btn = html('button', 'sc-link', line);
    btn.type = 'button';
    btn.addEventListener('click', locate);
    function render() {
      where.textContent = 'λ ' + lonText();
      btn.textContent = geo.source === 'locating' ? 'locating…' : geo.source === 'gps' ? 'relocate' : 'use my location';
      btn.disabled = geo.source === 'locating' || !navigator.geolocation;
    }
    geo.listeners.push(render);
    render();
    let last = '';
    return (t) => {
      // Both in days, so the face's reading plus the skew is the civil reading.
      const d = solarSkew(t) / DAY;
      const civil = frac(t / DAY - new Date(t).getTimezoneOffset() / 1440);
      const s = daysHTML(Math.abs(d)) + (d < 0 ? ' behind' : ' ahead of') + ' civil (' + daysHTML(civil) + ')';
      if (s !== last) skew.innerHTML = last = s;
    };
  }

  function demoNow(root) {
    const fig = html('figure', 'sc sc-now', root);
    const c = clock('si', root.dataset.fast || 'hand', root.dataset.motion || 'step');
    fig.appendChild(c.svg);
    fig.appendChild(c.readout);
    const meta = geoLine(fig);
    track(root, () => {
      const t = Date.now();
      c.update(t);
      meta(t);
    });
  }

  const SI_STEPS = [['50 µd', 50e-6 * DAY], ['1 md', 1e-3 * DAY], ['1 cd', 1e-2 * DAY], ['1 dd', 1e-1 * DAY]];
  const CIVIL_STEPS = [['5 s', 5000], ['1 m', 60000], ['15 m', 900000], ['1 h', 3600000]];

  function segmented(parent, label, options, initial, onPick) {
    const group = html('div', 'sc-modes', parent);
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', label);
    const buttons = options.map((m) => {
      const b = html('button', null, group, m);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => pick(m));
      return b;
    });
    function pick(m) {
      onPick(m);
      buttons.forEach((b, i) => b.setAttribute('aria-checked', options[i] === m));
    }
    pick(initial);
  }

  function demoCompare(root) {
    const fig = html('figure', 'sc sc-compare', root);
    const pair = html('div', 'sc-pair', fig);
    const state = { target: 0, shown: 0 };
    const fast = root.dataset.fast || 'hand';
    const motion = root.dataset.motion || 'step';

    function nudge(ms) { state.target += ms; }

    // Press-and-hold repeats; keyboard activation (detail 0) steps once.
    function stepper(parent, label, ms) {
      const wrap = html('span', 'sc-step', parent);
      const mk = (sign, text) => {
        const b = html('button', null, wrap, text);
        b.type = 'button';
        b.setAttribute('aria-label', (sign < 0 ? 'minus ' : 'plus ') + label);
        let timer;
        const stop = () => clearTimeout(timer);
        const repeat = (delay) => { nudge(sign * ms); timer = setTimeout(() => repeat(80), delay); };
        b.addEventListener('pointerdown', (e) => { if (e.button === 0) repeat(420); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, stop));
        b.addEventListener('click', (e) => { if (e.detail === 0) nudge(sign * ms); });
        return b;
      };
      mk(-1, '−');
      html('span', 'sc-step-label', wrap, label);
      mk(1, '+');
    }

    function column(kind, title, steps) {
      const col = html('div', 'sc-col', pair);
      const c = clock(kind, fast, motion);
      col.appendChild(c.svg);
      col.appendChild(c.readout);
      html('div', 'label sc-title', col, title);
      const row = html('div', 'sc-steps', col);
      steps.forEach(([label, ms]) => stepper(row, label, ms));
      return c;
    }

    const si = column('si', 'Solar · SI', SI_STEPS);
    const civil = column('civil', 'Civil · 12h', CIVIL_STEPS);

    const bar = html('div', 'sc-bar', fig);
    segmented(bar, 'Fast indicator shape', SHAPES, fast, (m) => { si.setFast(m); civil.setFast(m); });
    segmented(bar, 'Fast indicator motion', MOTIONS, motion, (m) => { si.setMotion(m); civil.setMotion(m); });

    const delta = html('span', 'sc-delta', bar);
    const reset = html('button', 'sc-link', bar, 'now');
    reset.type = 'button';
    reset.addEventListener('click', () => { state.target = 0; });

    const meta = geoLine(fig);

    let prev = performance.now();
    let lastDelta = '';
    track(root, (now) => {
      // Ease the shown offset toward the target so nudges glide instead of jump.
      const k = 1 - Math.exp(-(now - prev) / 70);
      prev = now;
      state.shown += (state.target - state.shown) * k;
      if (Math.abs(state.target - state.shown) < 1) state.shown = state.target;
      const t = Date.now() + state.shown;
      si.update(t);
      civil.update(t);
      meta(t);
      const d = state.target;
      const text = d === 0 ? 'live' : (d < 0 ? '−' : '+') + daysHTML(Math.abs(d) / DAY, true) + ' d  =  ' + hms(d, true);
      if (text !== lastDelta) {
        delta.innerHTML = lastDelta = text;
        reset.disabled = d === 0;
      }
    });
  }

  function frame(now) {
    live.forEach((item) => { if (item.visible) item.fn(now); });
    requestAnimationFrame(frame);
  }

  document.querySelectorAll('.si-clock').forEach((root) => {
    if (root.dataset.demo === 'compare') demoCompare(root);
    else demoNow(root);
  });
  requestAnimationFrame(frame);
})();
