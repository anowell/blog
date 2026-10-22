// Generates face/src/main/res/raw/watchface.xml: a Watch Face Format (v4)
// face showing local mean solar time as SI fractions of a day.
//
// WFF has no loops or variables, so tick marks are emitted one by one and
// shared expressions are inlined as strings.
//
//   bun run face
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../face/src/main/res/raw/watchface.xml', import.meta.url));
const PROVIDER = 'ai.howie.solarclock.provider/ai.howie.solarclock.provider.LongitudeDataSource';

const SIZE = 450;
const C = SIZE / 2;
const INK = '#FFF5F1E8';
const SOFT = '#FF8F8A80';
const FAINT = '#FF5F5A52';
const SIGNAL = '#FFE8592A';

// Expressions ------------------------------------------------------------

// Longitude published out of the hidden provider slot (see longitudeSlot),
// with its precision tier: 0 precise, 1 coarse, 2 stale, 3 no fix. With no
// fix, fall back to the time zone's standard meridian.
const TIER = '[REFERENCE.tier]';
const LON = `(${TIER} < 2.5 ? [REFERENCE.lon] : [TIMEZONE_OFFSET_MINUTES] / 4.0)`;

// Day fraction of local mean solar time, built from small numbers: expression
// precision is undocumented and epoch milliseconds would not survive a float.
// Sub-second precision re-evaluates every frame, so only the fast parts use it.
const solar = (ms) => {
  const secs = ms ? '([SECONDS_IN_DAY] + fract([SECOND_MILLISECOND]))' : '[SECONDS_IN_DAY]';
  return `fract(${secs} / 86400.0 - [TIMEZONE_OFFSET_MINUTES_DST] / 1440.0 + ${LON} / 360.0 + 2.0)`;
};

// nth decimal digit of the day fraction, as an integer
const digit = (n, ms) => `round(floor(${solar(ms)} * ${10 ** n}) % 10)`;

// Digits of a reading the longitude fix can't support are dimmed: 5 significant
// digits when precise (the 5th spans 10 µd ≈ 0.9 s ≈ 270 m at mid latitudes),
// 4 when coarse, 3 when stale, 2 on the time zone fallback.
const significant = (n) => `${TIER} <= ${5 - n} ? 255 : 70`;

// XML helpers ------------------------------------------------------------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attrs = (o) => Object.entries(o).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
const tag = (name, a, ...children) =>
  children.length ? `<${name}${attrs(a)}>${children.join('')}</${name}>` : `<${name}${attrs(a)}/>`;
const r = (n) => Math.round(n * 100) / 100;
const polar = (radius, deg) => {
  const a = (deg * Math.PI) / 180;
  return [C + radius * Math.sin(a), C - radius * Math.cos(a)];
};

const ambientHidden = tag('Variant', { mode: 'AMBIENT', target: 'alpha', value: '0' });

function text(box, template, params, { align = 'CENTER', ...font }, ...extra) {
  return tag('PartText', box, ...extra,
    tag('Text', { align },
      tag('Font', { family: 'SYNC_TO_DEVICE', ...font },
        params.length ? tag('Template', {}, esc(template), ...params.map((p) => tag('Parameter', { expression: p }))) : esc(template))));
}

// Dial -------------------------------------------------------------------

function marks() {
  const styles = { major: [INK, 3.2, 20], mid: [SOFT, 2, 13], minor: [FAINT, 1.4, 8] };
  const lines = [];
  for (let i = 0; i < 100; i++) {
    const kind = i % 10 === 0 ? 'major' : i % 5 === 0 ? 'mid' : 'minor';
    const [color, thickness, len] = styles[kind];
    const [x1, y1] = polar(218, i * 3.6);
    const [x2, y2] = polar(218 - len, i * 3.6);
    lines.push(tag('Line', { startX: r(x1), startY: r(y1), endX: r(x2), endY: r(y2) }, tag('Stroke', { color, thickness, cap: 'BUTT' })));
  }
  return tag('PartDraw', { x: 0, y: 0, width: SIZE, height: SIZE }, ...lines);
}

// Roman deciday numerals; X stands at the top for the full day, the way XII
// does on a 12-hour dial.
const ROMAN = ['X', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

function numerals() {
  return ROMAN.map((n, i) => {
    const [x, y] = polar(172, i * 36);
    return text({ x: Math.round(x - 34), y: Math.round(y - 18), width: 68, height: 36 }, n, [], { size: 26, color: INK, weight: 'MEDIUM' });
  }).join('');
}

// A hand drawn pointing up from the center, rotated by `angle` (degrees).
function hand(name, { length, tail, thickness, color }, angle, ...extra) {
  return tag('PartDraw', { x: 0, y: 0, width: SIZE, height: SIZE, pivotX: 0.5, pivotY: 0.5, name },
    tag('Transform', { target: 'angle', value: angle }),
    ...extra,
    tag('Line', { startX: C, startY: C + tail, endX: C, endY: C - length }, tag('Stroke', { color, thickness, cap: 'ROUND' })));
}

function hands() {
  return [
    // deciday: one turn per day
    hand('deciday', { length: 104, tail: 16, thickness: 12, color: INK }, `${solar(false)} * 360.0`),
    // centiday: one turn per deciday (2h 24m)
    hand('centiday', { length: 168, tail: 20, thickness: 6, color: INK }, `fract(${solar(false)} * 10.0) * 360.0`),
    // milliday: one turn per 86.4 s, stepping one mark (10 µd) at a time
    hand('milliday', { length: 206, tail: 34, thickness: 2, color: SIGNAL }, `floor(fract(${solar(true)} * 1000.0) * 100.0) * 3.6`, ambientHidden),
    tag('PartDraw', { x: 0, y: 0, width: SIZE, height: SIZE },
      tag('Ellipse', { x: C - 9, y: C - 9, width: 18, height: 18 }, tag('Fill', { color: INK })),
      tag('Ellipse', { x: C - 3, y: C - 3, width: 6, height: 6 }, tag('Fill', { color: SIGNAL }))),
  ].join('');
}

// Digital readouts -------------------------------------------------------

// Written like the blog: .547 with the next two digits as a smaller
// superscript. Each glyph gets a fixed-width cell so digits can dim one by one.
function siDigital() {
  const y = 96;
  const x0 = C - 43;
  const cell = (x, w, top, h, n, size, color, ...extra) =>
    text({ x: Math.round(x), y: top, width: w, height: h }, n ? '%s' : '.', n ? [digit(n, n > 3)] : [],
      { size, color, weight: 'MEDIUM' },
      ...(n > 2 ? [tag('Transform', { target: 'alpha', value: significant(n) })] : []),
      ...extra);
  return tag('BooleanConfiguration', { id: 'showSi' },
    tag('BooleanOption', { id: 'TRUE' }, tag('Group', { name: 'siDigital', x: 0, y: 0, width: SIZE, height: SIZE },
      cell(x0, 10, y, 40, 0, 30, INK),
      ...[1, 2, 3].map((n) => cell(x0 + 10 + (n - 1) * 18, 18, y, 40, n, 30, INK)),
      ...[4, 5].map((n) => cell(x0 + 66 + (n - 4) * 11, 11, y - 3, 23, n, 17, SIGNAL, ambientHidden)))));
}

function civilDigital() {
  return tag('BooleanConfiguration', { id: 'showCivil' },
    tag('BooleanOption', { id: 'TRUE' },
      tag('DigitalClock', { x: C - 60, y: 304, width: 120, height: 30 },
        tag('TimeText', { x: 0, y: 0, width: 120, height: 30, format: 'h:mm', hourFormat: 'SYNC_TO_DEVICE', align: 'CENTER' },
          tag('Font', { family: 'SYNC_TO_DEVICE', size: 22, color: SOFT })))));
}

// Off by default: the zone civil time is relative to, in the locale's
// abbreviation (PDT).
function zone() {
  return tag('BooleanConfiguration', { id: 'showZone' },
    tag('BooleanOption', { id: 'TRUE' },
      text({ x: C - 60, y: 332, width: 120, height: 20 }, '%s', ['[TIMEZONE_ABB]'], { size: 15, color: FAINT, weight: 'MEDIUM' })));
}

// Day of month at 90°, between II and III, boxed to set it apart from the dial.
function date() {
  const [x, y] = polar(176, 90);
  const box = { x: Math.round(x - 20), y: Math.round(y - 18), width: 40, height: 36 };
  return tag('PartDraw', box,
    tag('RoundRectangle', { x: 1, y: 1, width: box.width - 2, height: box.height - 2, cornerRadiusX: 3, cornerRadiusY: 3 },
      tag('Stroke', { color: SOFT, thickness: 1.5 }))) +
    text(box, '%s', ['[DAY]'], { size: 20, color: SIGNAL, weight: 'MEDIUM' });
}

// Longitude --------------------------------------------------------------

// A non-customizable, invisible slot bound to the companion provider. Its
// RANGED_VALUE is longitude; RANGED_VALUE_MIN is -180 minus the precision tier
// (0 precise, 1 coarse, 2 stale). Hidden groups rotate/offset by those values
// and publish them as [REFERENCE.lon] and [REFERENCE.tier] for the rest of the
// face; with the slot empty, tier defaults to 3 (no fix).
function longitudeSlot() {
  const tier = 'round(-180 - [COMPLICATION.RANGED_VALUE_MIN])';
  return tag('ComplicationSlot', {
    x: 0, y: 0, width: 1, height: 1, slotId: 0, name: 'longitude', displayName: 'longitude_label',
    supportedTypes: 'RANGED_VALUE EMPTY', isCustomizable: 'FALSE',
  },
  tag('DefaultProviderPolicy', {
    primaryProvider: PROVIDER, primaryProviderType: 'RANGED_VALUE',
    defaultSystemProvider: 'EMPTY', defaultSystemProviderType: 'EMPTY',
  }),
  tag('BoundingBox', { x: 0, y: 0, width: 1, height: 1 }),
  tag('Complication', { type: 'RANGED_VALUE' },
    tag('Group', { name: 'lonCarrier', x: 0, y: 0, width: 1, height: 1, alpha: 0 },
      tag('Transform', { target: 'angle', value: '[COMPLICATION.RANGED_VALUE_VALUE]' }),
      tag('Reference', { name: 'lon', source: 'angle', defaultValue: 0 })),
    tag('Group', { name: 'tierCarrier', x: 0, y: 0, width: 1, height: 1, alpha: 0 },
      tag('Transform', { target: 'x', value: tier }),
      tag('Reference', { name: 'tier', source: 'x', defaultValue: 3 }))),
  tag('Complication', { type: 'EMPTY' }));
}

// User complications -----------------------------------------------------

const SLOTS = [
  { id: 1, deg: 300, label: 'top_left_label', provider: 'STEP_COUNT', type: 'SHORT_TEXT' },
  { id: 2, deg: 60, label: 'top_right_label', provider: 'HEART_RATE', type: 'SHORT_TEXT' },
  { id: 3, deg: 240, label: 'bottom_left_label', provider: 'WATCH_BATTERY', type: 'RANGED_VALUE' },
  { id: 4, deg: 120, label: 'bottom_right_label', provider: 'EMPTY', type: 'EMPTY' },
];
const SLOT = 72;

function iconAndText(textColor) {
  const icon = tag('PartImage', { x: SLOT / 2 - 11, y: 10, width: 22, height: 22, tintColor: SOFT },
    tag('Image', { resource: '[COMPLICATION.MONOCHROMATIC_IMAGE]' }));
  const label = (y) => text({ x: 4, y, width: SLOT - 8, height: 24 }, '%s', ['[COMPLICATION.TEXT]'], { size: 18, color: textColor });
  return tag('Condition', {},
    tag('Expressions', {}, tag('Expression', { name: 'hasIcon' }, esc('[COMPLICATION.MONOCHROMATIC_IMAGE] != null'))),
    tag('Compare', { expression: 'hasIcon' }, icon, label(34)),
    tag('Default', {}, label(24)));
}

// A faint ring with a signal-colored arc for the value.
function ring(value, min, max) {
  const fraction = `clamp((${value} - ${min}) / (${max} - ${min}), 0, 1)`;
  return tag('PartDraw', { x: 0, y: 0, width: SLOT, height: SLOT },
    tag('Arc', { centerX: SLOT / 2, centerY: SLOT / 2, width: SLOT - 6, height: SLOT - 6, startAngle: 0, endAngle: 360 },
      tag('Stroke', { color: FAINT, thickness: 2 })),
    tag('Arc', { centerX: SLOT / 2, centerY: SLOT / 2, width: SLOT - 6, height: SLOT - 6, startAngle: 0, endAngle: 0 },
      tag('Stroke', { color: SIGNAL, thickness: 2, cap: 'ROUND' }),
      tag('Transform', { target: 'endAngle', value: `${fraction} * 360` })));
}

function userSlot({ id, deg, label, provider, type }) {
  const [cx, cy] = polar(105, deg);
  return tag('ComplicationSlot', {
    x: Math.round(cx - SLOT / 2), y: Math.round(cy - SLOT / 2), width: SLOT, height: SLOT, slotId: id, displayName: label,
    supportedTypes: 'SHORT_TEXT RANGED_VALUE GOAL_PROGRESS MONOCHROMATIC_IMAGE SMALL_IMAGE EMPTY',
  },
  tag('DefaultProviderPolicy', { defaultSystemProvider: provider, defaultSystemProviderType: type }),
  tag('BoundingOval', { x: 0, y: 0, width: SLOT, height: SLOT }),
  tag('Complication', { type: 'SHORT_TEXT' }, iconAndText(INK)),
  tag('Complication', { type: 'RANGED_VALUE' },
    ring('[COMPLICATION.RANGED_VALUE_VALUE]', '[COMPLICATION.RANGED_VALUE_MIN]', '[COMPLICATION.RANGED_VALUE_MAX]'), iconAndText(INK)),
  tag('Complication', { type: 'GOAL_PROGRESS' },
    ring('[COMPLICATION.GOAL_PROGRESS_VALUE]', '0', '[COMPLICATION.GOAL_PROGRESS_TARGET_VALUE]'), iconAndText(INK)),
  tag('Complication', { type: 'MONOCHROMATIC_IMAGE' },
    tag('PartImage', { x: SLOT / 2 - 14, y: SLOT / 2 - 14, width: 28, height: 28, tintColor: INK },
      tag('Image', { resource: '[COMPLICATION.MONOCHROMATIC_IMAGE]' }))),
  tag('Complication', { type: 'SMALL_IMAGE' },
    tag('PartImage', { x: 8, y: 8, width: SLOT - 16, height: SLOT - 16 },
      tag('Image', { resource: '[COMPLICATION.SMALL_IMAGE]' }))),
  tag('Complication', { type: 'EMPTY' }));
}

// Face -------------------------------------------------------------------

const config = (id, def) =>
  tag('BooleanConfiguration', { id, displayName: `${id}_label`, screenReaderText: `${id}_label`, defaultValue: def });

const face = tag('WatchFace', { width: SIZE, height: SIZE, clipShape: 'CIRCLE' },
  tag('Metadata', { key: 'CLOCK_TYPE', value: 'ANALOG' }),
  tag('Metadata', { key: 'PREVIEW_TIME', value: '13:08:32' }),
  tag('UserConfigurations', {},
    config('showSi', 'TRUE'),
    config('showCivil', 'TRUE'),
    config('showZone', 'FALSE')),
  tag('Scene', { backgroundColor: '#FF000000' },
    marks(),
    numerals(),
    date(),
    siDigital(),
    civilDigital(),
    zone(),
    longitudeSlot(),
    ...SLOTS.map(userSlot),
    hands()));

const header = '<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated by gen/face.mjs; edit that instead. -->\n';
writeFileSync(OUT, header + face.replace(/></g, '>\n<') + '\n');
console.log(`wrote ${OUT}`);
