// Renders face/src/main/res/raw/watchface.xml to SVG (and PNG when Playwright
// is available) by interpreting the subset of Watch Face Format the face uses,
// evaluating its real expressions against mock data.
//
//   bun run preview   # regenerates the face, writes preview/*.svg and *.png
//
// Faithful: geometry, transforms, conditions, configuration branches,
// references and expression results (unknown data sources throw).
// Approximate: fonts (SYNC_TO_DEVICE is Google Sans on Pixel), text baselines,
// and complication icons (drawn as placeholders).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('..', import.meta.url);
const XML = fileURLToPath(new URL('face/src/main/res/raw/watchface.xml', ROOT));
const OUT = fileURLToPath(new URL('preview/', ROOT));

// Scenarios ---------------------------------------------------------------

const BASE = {
  time: '2026-10-22T14:47:02.400-07:00',
  zone: 'America/Los_Angeles',
  offsetStd: -480,
  offsetDst: -420,
  zoneAbb: 'PDT',
  ambient: false,
  config: { showSi: 'TRUE', showCivil: 'TRUE', showZone: 'FALSE' },
  slots: {
    0: { type: 'RANGED_VALUE', RANGED_VALUE_VALUE: -122.35, RANGED_VALUE_MIN: -180, RANGED_VALUE_MAX: 180, TEXT: 'gps' },
    1: { type: 'SHORT_TEXT', TEXT: '6421', MONOCHROMATIC_IMAGE: 'steps' },
    2: { type: 'SHORT_TEXT', TEXT: '64', MONOCHROMATIC_IMAGE: 'heart' },
    3: { type: 'RANGED_VALUE', RANGED_VALUE_VALUE: 78, RANGED_VALUE_MIN: 0, RANGED_VALUE_MAX: 100, TEXT: '78%', MONOCHROMATIC_IMAGE: 'battery' },
    4: { type: 'EMPTY' },
  },
};

const SCENARIOS = {
  face: {},
  ambient: { ambient: true },
  zone: { config: { ...BASE.config, showZone: 'TRUE' } },
  coarse: { slots: { ...BASE.slots, 0: { ...BASE.slots[0], RANGED_VALUE_MIN: -181 } } },
  stale: { slots: { ...BASE.slots, 0: { ...BASE.slots[0], RANGED_VALUE_MIN: -182 } } },
  'no-provider': { slots: { ...BASE.slots, 0: { type: 'EMPTY' } } },
  minimal: { config: { showSi: 'FALSE', showCivil: 'FALSE', showZone: 'FALSE' } },
};

// XML ---------------------------------------------------------------------

const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function parse(xml) {
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const re = /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<\/([\w.]+)\s*>|<([\w.]+)((?:\s+[\w.:]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
  for (const m of xml.matchAll(re)) {
    const top = stack[stack.length - 1];
    if (m[1]) stack.pop();
    else if (m[2]) {
      const attrs = {};
      for (const a of m[3].matchAll(/([\w.:]+)="([^"]*)"/g)) attrs[a[1]] = unescape(a[2]);
      const node = { name: m[2], attrs, children: [], text: '' };
      top.children.push(node);
      if (!m[4]) stack.push(node);
    } else if (m[5] && m[5].trim()) top.text += unescape(m[5]);
  }
  return root.children[0];
}

// Expressions -------------------------------------------------------------

function sources(s) {
  const t = new Date(s.time);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: s.zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(t).map((p) => [p.type, Number(p.value)]));
  const ms = t.getUTCMilliseconds();
  return {
    SECONDS_IN_DAY: parts.hour * 3600 + parts.minute * 60 + parts.second,
    SECOND_MILLISECOND: parts.second + ms / 1000,
    MILLISECOND: ms,
    SECOND: parts.second,
    MINUTE: parts.minute,
    HOUR_0_23: parts.hour,
    DAY: parts.day,
    TIMEZONE_OFFSET_MINUTES: s.offsetStd,
    TIMEZONE_OFFSET_MINUTES_DST: s.offsetDst,
    TIMEZONE_ABB: s.zoneAbb,
  };
}

const FUNCS = {
  fract: (x) => x - Math.floor(x),
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  abs: Math.abs,
  clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
};

function evaluate(expr, ctx) {
  const js = expr.replace(/\[([A-Z_.0-9a-z]+)\]/g, (_, name) => `$(${JSON.stringify(name)})`);
  const lookup = (name) => {
    if (name.startsWith('CONFIGURATION.')) return ctx.s.config[name.slice(14)];
    if (name.startsWith('REFERENCE.')) return ctx.refs[name.slice(10)] ?? ctx.refDefaults[name.slice(10)] ?? 0;
    if (name.startsWith('COMPLICATION.')) {
      if (!ctx.slot) throw new Error(`${name} outside a complication`);
      return ctx.slot[name.slice(13)] ?? null;
    }
    if (!(name in ctx.src)) throw new Error(`unknown data source ${name}`);
    return ctx.src[name];
  };
  // eslint-disable-next-line no-new-func
  return new Function('$', ...Object.keys(FUNCS), `return (${js});`)(lookup, ...Object.values(FUNCS));
}

const num = (v, ctx) => (v === undefined ? undefined : /^-?[\d.]+$/.test(v) ? Number(v) : evaluate(v, ctx));

// Rendering ---------------------------------------------------------------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const argb = (c) => (c && c.length === 9 ? { color: '#' + c.slice(3), opacity: parseInt(c.slice(1, 3), 16) / 255 } : { color: c, opacity: 1 });
const kids = (node, name) => node.children.filter((c) => c.name === name);

// Resolves an element's attributes: static values, then Transforms, then the
// ambient Variant. Publishes any References it carries.
function resolve(node, ctx) {
  const a = { ...node.attrs };
  for (const t of kids(node, 'Transform')) a[t.attrs.target] = evaluate(t.attrs.value, ctx);
  if (ctx.s.ambient) for (const v of kids(node, 'Variant')) a[v.attrs.target] = v.attrs.value;
  for (const r of kids(node, 'Reference')) {
    ctx.refDefaults[r.attrs.name] = Number(r.attrs.defaultValue);
    ctx.refs[r.attrs.name] = Number(a[r.attrs.source]);
  }
  return a;
}

function wrap(a, w, h, body) {
  const alpha = a.alpha === undefined ? 255 : Number(a.alpha);
  if (alpha === 0 || !body) return '';
  const x = Number(a.x || 0), y = Number(a.y || 0);
  const px = Number(a.pivotX ?? 0.5) * w, py = Number(a.pivotY ?? 0.5) * h;
  const rot = a.angle ? ` rotate(${Number(a.angle)} ${px} ${py})` : '';
  return `<g transform="translate(${x} ${y})${rot}" opacity="${alpha / 255}">${body}</g>`;
}

function stroke(node, ctx) {
  const s = kids(node, 'Stroke')[0];
  if (!s) return 'stroke="none"';
  const sa = resolve(s, ctx);
  const { color, opacity } = argb(sa.color);
  return `stroke="${color}" stroke-opacity="${opacity}" stroke-width="${sa.thickness}" stroke-linecap="${(sa.cap || 'BUTT').toLowerCase()}"`;
}

function fill(node, ctx) {
  const f = kids(node, 'Fill')[0];
  if (!f) return 'fill="none"';
  const { color, opacity } = argb(resolve(f, ctx).color);
  return `fill="${color}" fill-opacity="${opacity}"`;
}

// WFF arcs: degrees clockwise from 12 o'clock.
function arc(a) {
  const cx = Number(a.centerX), cy = Number(a.centerY), rx = Number(a.width) / 2, ry = Number(a.height) / 2;
  const start = Number(a.startAngle), end = Number(a.endAngle);
  if (end - start >= 360) return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
  if (end === start) return '';
  const pt = (d) => [cx + rx * Math.sin((d * Math.PI) / 180), cy - ry * Math.cos((d * Math.PI) / 180)];
  const [x1, y1] = pt(start), [x2, y2] = pt(end);
  return `M${x1} ${y1}A${rx} ${ry} 0 ${end - start > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

function shape(node, ctx) {
  const a = resolve(node, ctx);
  switch (node.name) {
    case 'Line':
      return `<line x1="${a.startX}" y1="${a.startY}" x2="${a.endX}" y2="${a.endY}" ${stroke(node, ctx)}/>`;
    case 'Ellipse':
      return `<ellipse cx="${+a.x + a.width / 2}" cy="${+a.y + a.height / 2}" rx="${a.width / 2}" ry="${a.height / 2}" ${fill(node, ctx)} ${stroke(node, ctx)}/>`;
    case 'Rectangle':
    case 'RoundRectangle':
      return `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" rx="${a.cornerRadiusX || 0}" ry="${a.cornerRadiusY || 0}" ${fill(node, ctx)} ${stroke(node, ctx)}/>`;
    case 'Arc': {
      const d = arc(a);
      return d ? `<path d="${d}" fill="none" ${stroke(node, ctx)}/>` : '';
    }
    default:
      throw new Error(`unsupported shape ${node.name}`);
  }
}

function textContent(font, ctx) {
  const tpl = kids(font, 'Template')[0];
  if (!tpl) return font.text;
  const params = kids(tpl, 'Parameter').map((p) => evaluate(p.attrs.expression, ctx));
  let i = 0;
  return tpl.text.replace(/%s/g, () => {
    const v = params[i++];
    return v === null || v === undefined ? '' : String(v);
  });
}

const WEIGHTS = { THIN: 100, LIGHT: 300, NORMAL: 400, MEDIUM: 500, SEMI_BOLD: 600, BOLD: 700 };

const ANCHORS = { START: ['start', 0], CENTER: ['middle', 0.5], END: ['end', 1] };

function textSvg(box, font, content, ctx, align = 'CENTER') {
  const fa = resolve(font, ctx);
  const { color, opacity } = argb(fa.color || '#FFFFFFFF');
  const [anchor, ax] = ANCHORS[align];
  return `<text x="${box.width * ax}" y="${box.height / 2}" text-anchor="${anchor}" dominant-baseline="central" font-size="${fa.size}" font-weight="${WEIGHTS[fa.weight] || 400}" fill="${color}" fill-opacity="${opacity}" font-family="'Google Sans Flex', Roboto, sans-serif">${esc(content)}</text>`;
}

const pad2 = (n) => String(n).padStart(2, '0');

function render(node, ctx) {
  switch (node.name) {
    case 'Scene':
    case 'Default':
    case 'Compare':
    case 'BooleanOption':
    case 'Complication':
      return node.children.map((c) => render(c, ctx)).join('');
    case 'Group': {
      const a = resolve(node, ctx);
      const body = node.children.map((c) => render(c, ctx)).join('');
      return wrap(a, +a.width, +a.height, body);
    }
    case 'PartDraw': {
      const a = resolve(node, ctx);
      const body = node.children.filter((c) => ['Line', 'Ellipse', 'Arc', 'Rectangle', 'RoundRectangle'].includes(c.name)).map((c) => shape(c, ctx)).join('');
      return wrap(a, +a.width, +a.height, body);
    }
    case 'PartText': {
      const a = resolve(node, ctx);
      const t = kids(node, 'Text')[0];
      const font = kids(t, 'Font')[0];
      return wrap(a, +a.width, +a.height, textSvg(a, font, textContent(font, ctx), ctx, t.attrs.align));
    }
    case 'PartImage': {
      // Complication icons are not available offline; draw a placeholder.
      const a = resolve(node, ctx);
      const res = kids(node, 'Image')[0].attrs.resource;
      if (evaluate(res, ctx) == null) return '';
      const { color } = argb(a.tintColor || '#FFFFFFFF');
      const r = Math.min(a.width, a.height) / 2 - 2;
      return wrap(a, +a.width, +a.height, `<circle cx="${a.width / 2}" cy="${a.height / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="3 3"/>`);
    }
    case 'BooleanConfiguration':
    case 'ListConfiguration': {
      const chosen = ctx.s.config[node.attrs.id];
      const option = node.children.find((o) => o.attrs.id === chosen);
      return option ? render(option, ctx) : '';
    }
    case 'Condition': {
      const named = Object.fromEntries(kids(kids(node, 'Expressions')[0], 'Expression').map((e) => [e.attrs.name, e.text]));
      const hit = kids(node, 'Compare').find((c) => evaluate(named[c.attrs.expression], ctx));
      const branch = hit || kids(node, 'Default')[0];
      return branch ? render(branch, ctx) : '';
    }
    case 'ComplicationSlot': {
      const a = resolve(node, ctx);
      const data = ctx.s.slots[a.slotId] || { type: 'EMPTY' };
      const comp = kids(node, 'Complication').find((c) => c.attrs.type === data.type);
      if (!comp) return '';
      const body = render(comp, { ...ctx, slot: data });
      return wrap(a, +a.width, +a.height, body);
    }
    case 'DigitalClock': {
      const a = resolve(node, ctx);
      const body = kids(node, 'TimeText').map((tt) => {
        const ta = resolve(tt, ctx);
        const h = ctx.src.HOUR_0_23, m = ctx.src.MINUTE;
        const hour = ta.hourFormat === '24' ? h : ((h + 11) % 12) + 1;
        const text = ta.format.replace('hh', pad2(hour)).replace('h', hour).replace('mm', pad2(m));
        return wrap(ta, +ta.width, +ta.height, textSvg(ta, kids(tt, 'Font')[0], text, ctx));
      }).join('');
      return wrap(a, +a.width, +a.height, body);
    }
    case 'Transform':
    case 'Reference':
    case 'Variant':
    case 'DefaultProviderPolicy':
    case 'BoundingBox':
    case 'BoundingOval':
      return '';
    default:
      throw new Error(`unsupported element ${node.name}`);
  }
}

// Every Reference's default, including ones in branches that never render
// (an empty provider slot): the face relies on those defaults as fallbacks.
function referenceDefaults(node, out = {}) {
  if (node.name === 'Reference') out[node.attrs.name] = Number(node.attrs.defaultValue);
  node.children.forEach((c) => referenceDefaults(c, out));
  return out;
}

function renderFace(face, s) {
  const ctx = { s, src: sources(s), refs: {}, refDefaults: referenceDefaults(face), slot: null };
  const scene = kids(face, 'Scene')[0];
  // References are published wherever their element sits in the document, so
  // render once to collect them and again to use them.
  render(scene, ctx);
  const body = render(scene, ctx);
  const { width: w, height: h } = face.attrs;
  const bg = argb(scene.attrs.backgroundColor || '#FF000000').color;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><clipPath id="clip"><circle cx="${w / 2}" cy="${h / 2}" r="${w / 2}"/></clipPath></defs>
<g clip-path="url(#clip)"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</g></svg>`;
}

// Main --------------------------------------------------------------------

const face = parse(readFileSync(XML, 'utf8'));
mkdirSync(OUT, { recursive: true });
const svgs = {};
for (const [name, overrides] of Object.entries(SCENARIOS)) {
  svgs[name] = renderFace(face, { ...BASE, ...overrides });
  writeFileSync(`${OUT}/${name}.svg`, svgs[name]);
}
console.log(`wrote ${Object.keys(svgs).length} SVGs to ${OUT}`);

// PNGs need a browser for fonts. playwright-core is pinned in package.json to
// the version whose Chromium is already cached (`bunx playwright install
// chromium` otherwise); without it, stop at SVGs.
const pw = await import('playwright-core').catch(() => null);
if (!pw) process.exit(0);
const chromium = pw.chromium ?? pw.default.chromium;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 450, height: 450 }, deviceScaleFactor: 2 });
for (const [name, svg] of Object.entries(svgs)) {
  await page.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@100..900&display=block" rel="stylesheet"></head><body style="margin:0;background:#111">${svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 0, width: 450, height: 450 } });
}
await browser.close();
console.log('wrote PNGs');
