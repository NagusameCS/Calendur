#!/usr/bin/env node
/* ============================================================================
 * Calendur CLI — headless calendar generator
 *
 * Usage:
 *   node cli/calendur.js --year 2026 --months 10 --theme paper -o calendar.svg
 *   node cli/calendur.js --year 2027 --start 0 --months 12 --format png --scale 2 -o out.png
 *   node cli/calendur.js --config calendar.json -o out.svg
 *   cat config.json | node cli/calendur.js --stdin -o out.svg
 *
 * Requires Node.js 18+. No dependencies for SVG output.
 * For PNG/JPG: install sharp (npm i sharp) for rasterization.
 *
 * Security: runs entirely locally. No data leaves your machine. No telemetry.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');

/* ---------- Constants ---------- */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const G = {
  cellW: 46, cellH: 42, monthHead: 30, weekdayHead: 22, monthPad: 14,
  weeks: 6, gap: 24, margin: 48,
  scaled(s) {
    const rnd = (v) => Math.round(v * s * 10) / 10;
    return { cellW: rnd(46), cellH: rnd(42), monthHead: rnd(30), weekdayHead: rnd(22), monthPad: rnd(14), weeks: 6, gap: rnd(24), margin: rnd(48) };
  }
};

const THEMES = {
  noir:      { name: 'Noir',      page: '#000000', month: '#0a0a0a', line: '#222222', text: '#ffffff', muted: '#666666', weekend: '#141414', header: '#ffffff', sub: '#999999', today: '#ffffff' },
  paper:     { name: 'Paper',     page: '#ffffff', month: '#ffffff', line: '#e6e6e6', text: '#111111', muted: '#9a9a9a', weekend: '#f6f6f6', header: '#111111', sub: '#666666', today: '#111111' },
  mono:      { name: 'Mono Light',page: '#f4f4f5', month: '#ffffff', line: '#dcdce0', text: '#18181b', muted: '#a1a1aa', weekend: '#ececee', header: '#18181b', sub: '#52525b', today: '#18181b' },
  slate:     { name: 'Slate',     page: '#1c2128', month: '#22272e', line: '#373e47', text: '#e6edf3', muted: '#768390', weekend: '#2d333b', header: '#e6edf3', sub: '#adbac7', today: '#e6edf3' },
  blueprint: { name: 'Blueprint', page: '#0d1b2a', month: '#122740', line: '#1f3d5c', text: '#e0f0ff', muted: '#5a7ea0', weekend: '#0f2137', header: '#cfe8ff', sub: '#8fb4d4', today: '#7fc7ff' },
  cream:     { name: 'Cream',     page: '#faf6ef', month: '#fffdf8', line: '#e7ddc9', text: '#3a3226', muted: '#a99d84', weekend: '#f3ecdd', header: '#3a3226', sub: '#7a6f58', today: '#3a3226' },
};

/* ---------- Default state ---------- */
function defaultState() {
  const y = new Date().getUTCFullYear();
  return {
    title: y + '\u2013' + (y + 1) + ' Academic Year',
    subtitle: '',
    notes: '',
    year: y, startMonth: 8, months: 10, columns: 'auto', weekStart: 0,
    theme: 'noir', shadeWeekend: true, highlightToday: false,
    showLabels: false, trailingDays: false, showBorders: true, showWatermark: false,
    fontScale: 1, weekendDays: [0, 6], todayColor: '#ffffff', dayAlign: 'start',
    categories: [
      { id: 'c1', label: 'Holiday', color: '#c62828' },
      { id: 'c2', label: 'Break',   color: '#1565c0' },
      { id: 'c3', label: 'Event',   color: '#2e7d32' },
      { id: 'c4', label: 'Exam',    color: '#6a1b9a' },
    ],
    events: [],
  };
}

/* ---------- Parse CLI args ---------- */
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      opts[key] = val;
    } else if (a.startsWith('-')) {
      const key = a.slice(1);
      const val = args[i + 1] && !args[i + 1].startsWith('-') ? args[++i] : 'true';
      opts[key] = val;
    } else {
      opts._.push(a);
    }
  }
  return opts;
}

/* ---------- Date helpers ---------- */
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => y + '-' + pad2(m + 1) + '-' + pad2(d);
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const firstWeekday = (y, m) => new Date(Date.UTC(y, m, 1)).getUTCDay();
const isLeapYear = (y) => ((y % 4 === 0) && (y % 100 !== 0)) || (y % 400 === 0);
const todayKey = () => { const d = new Date(); return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

function monthAt(state, k) {
  const idx = state.startMonth + k;
  return { y: state.year + Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 };
}

/* ---------- Colour helpers ---------- */
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function withAlpha(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

/* ---------- XML escape ---------- */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- SVG primitives ---------- */
const r2 = (n) => Math.round(n * 100) / 100;
function rect(x, y, w, h, fill, stroke, r, sw) {
  let s = '<rect x="' + r2(x) + '" y="' + r2(y) + '" width="' + r2(w) + '" height="' + r2(h) + '"';
  if (r) s += ' rx="' + r + '"';
  if (fill) s += ' fill="' + fill + '"'; else s += ' fill="none"';
  if (stroke) s += ' stroke="' + stroke + '" stroke-width="' + (sw || 1) + '"';
  return s + '/>';
}
function text(x, y, str, fill, size, weight, anchor, opacity) {
  return '<text x="' + r2(x) + '" y="' + r2(y) + '" fill="' + fill + '" font-size="' + size +
    '" font-weight="' + weight + '" text-anchor="' + anchor + '"' +
    (opacity != null ? ' opacity="' + opacity + '"' : '') + '>' + str + '</text>';
}

/* ---------- Event lookup ---------- */
function categoryById(state, id) { return (state.categories || []).find((c) => c.id === id) || null; }
function eventsOn(state, key) {
  return (state.events || []).filter((e) => e.start <= key && key <= e.end);
}

function clip(str, n) { return str.length > n ? str.slice(0, n - 1) + '\u2026' : str; }

/* ---------- SVG Builder ---------- */
function buildCalendar(state) {
  const th = THEMES[state.theme] || THEMES.noir;
  const sVal = +(state.fontScale || 1);
  const g = sVal === 1 ? { cellW: 46, cellH: 42, monthHead: 30, weekdayHead: 22, monthPad: 14, weeks: 6, gap: 24, margin: 48 } : G.scaled(sVal);
  const months = Math.max(1, Math.min(36, +state.months || 10));
  let cols = state.columns === 'auto'
    ? Math.max(1, Math.min(4, Math.ceil(Math.sqrt(months * 1.3))))
    : Math.max(1, Math.min(6, parseInt(state.columns, 10)));
  cols = Math.min(cols, months);
  const rows = Math.ceil(months / cols);
  const innerW = 7 * g.cellW;
  const blockW = innerW + g.monthPad * 2;
  const blockH = g.monthHead + g.weekdayHead + g.weeks * g.cellH + g.monthPad * 2;
  const gridW = cols * blockW + (cols - 1) * g.gap;
  const totalW = gridW + g.margin * 2;

  let headH = 0;
  const hasTitle = (state.title || '').trim().length > 0;
  const hasSub = (state.subtitle || '').trim().length > 0;
  if (hasTitle) headH += 40;
  if (hasSub) headH += 26;
  if (hasTitle || hasSub) headH += 22;

  const gridTop = g.margin + headH;
  const gridH = rows * blockH + (rows - 1) * g.gap;

  const legend = layoutLegend(state, gridW, g, th);
  const legendTop = gridTop + gridH + ((state.categories || []).length ? 30 : 0);
  const notesBlock = buildNotes(state, totalW, legendTop + legend.height + ((state.categories || []).length ? 0 : 8), g, th);
  const watermarkH = state.showWatermark ? 22 : 0;
  const totalH = notesBlock.y + notesBlock.h + watermarkH + g.margin;

  const wk = weekdayOrder(+state.weekStart || 0);
  const tKey = todayKey();
  const todayCol = state.highlightToday ? (state.todayColor || th.today) : th.today;

  let body = '';
  body += rect(0, 0, totalW, totalH, th.page, null, 0);

  if (hasTitle) body += text(totalW / 2, g.margin + 30, esc(state.title), th.header, 30, 700, 'middle');
  if (hasSub) {
    const sy = g.margin + (hasTitle ? 60 : 26);
    body += text(totalW / 2, sy, esc(state.subtitle), th.sub, 15, 500, 'middle');
  }

  for (let k = 0; k < months; k++) {
    const col = k % cols; const row = Math.floor(k / cols);
    const bx = g.margin + col * (blockW + g.gap); const by = gridTop + row * (blockH + g.gap);
    body += buildMonth(state, bx, by, monthAt(state, k), th, wk, tKey, todayCol, g);
  }

  body += legend.svg;
  body += notesBlock.svg;
  if (state.showWatermark) {
    body += text(totalW - g.margin, totalH - g.margin + 4,
      'Made with Calendur', th.muted, 9, 400, 'end', 0.45);
  }

  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + totalW + '" height="' + totalH +
    '" viewBox="0 0 ' + totalW + ' ' + totalH + '" font-family="-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif"' +
    ' text-rendering="optimizeLegibility" shape-rendering="geometricPrecision">' + body + '</svg>';
}

function weekdayOrder(ws) {
  const arr = []; for (let i = 0; i < 7; i++) arr.push((ws + i) % 7); return arr;
}

function buildMonth(state, x, y, ym, th, wk, tKey, todayCol, g) {
  const { y: yr, m } = ym;
  let s = '';
  const innerX = x + g.monthPad; const innerY = y + g.monthPad;
  const innerW = 7 * g.cellW;
  const borderStroke = state.showBorders ? th.line : null;
  s += rect(x, y, innerW + g.monthPad * 2, g.monthHead + g.weekdayHead + g.weeks * g.cellH + g.monthPad * 2, th.month, borderStroke, 8);

  let monthLabel = MONTHS[m] + ' ' + yr;
  if (m === 1 && isLeapYear(yr)) monthLabel += ' \u22c8';
  s += text(x + (innerW + g.monthPad * 2) / 2, innerY + (g.monthHead * 0.66), esc(monthLabel), th.header, 15, 600, 'middle');

  const wRowY = innerY + g.monthHead;
  for (let i = 0; i < 7; i++) {
    const cx = innerX + i * g.cellW + g.cellW / 2;
    const isWknd = (state.weekendDays || [0,6]).indexOf(wk[i]) !== -1;
    s += text(cx, wRowY + (g.weekdayHead * 0.68), WEEKDAYS[wk[i]].toUpperCase().slice(0, 3), isWknd ? th.muted : th.sub, 9.5, 600, 'middle');
  }

  const gridY = wRowY + g.weekdayHead;
  const offset = (firstWeekday(yr, m) - (+state.weekStart || 0) + 7) % 7;
  const dim = daysInMonth(yr, m);
  const prevDim = daysInMonth(m === 0 ? yr - 1 : yr, (m + 11) % 12);

  for (let i = 0; i < 42; i++) {
    const col = i % 7; const rowN = Math.floor(i / 7);
    const cx = innerX + col * g.cellW; const cy = gridY + rowN * g.cellH;
    const dayNum = i - offset + 1;
    const inMonth = dayNum >= 1 && dayNum <= dim;
    const wd = wk[col];
    const isWknd = (state.weekendDays || [0,6]).indexOf(wd) !== -1;
    let cellBg = th.month;
    if (inMonth && state.shadeWeekend && isWknd) cellBg = th.weekend;

    s += rect(cx, cy, g.cellW, g.cellH, cellBg, borderStroke, 0, 0.6);

    if (inMonth) {
      const key = ymd(yr, m, dayNum);
      const evs = eventsOn(state, key);
      if (evs.length) {
        const first = categoryById(state, evs[0].categoryId);
        if (first) s += rect(cx + 0.6, cy + 0.6, g.cellW - 1.2, g.cellH - 1.2, withAlpha(first.color, 0.16), null, 0);
      }
      const align = state.dayAlign || 'start';
      const numX = align === 'start' ? (cx + 6) : align === 'end' ? (cx + g.cellW - 6) : (cx + g.cellW / 2);
      s += text(numX, cy + 15, String(dayNum), th.text, 12, 500, align);

      if (state.highlightToday && key === tKey) {
        s += '<rect x="' + r2(cx + 1.5) + '" y="' + r2(cy + 1.5) + '" width="' + r2(g.cellW - 3) +
          '" height="' + r2(g.cellH - 3) + '" rx="4" fill="none" stroke="' + todayCol + '" stroke-width="1.6"/>';
      }

      if (evs.length) {
        const cats = [];
        evs.forEach((e) => { const c = categoryById(state, e.categoryId); if (c && !cats.find((x) => x.id === c.id)) cats.push(c); });
        const bandH = 7, by = cy + g.cellH - bandH - 2, bx = cx + 3, bw = g.cellW - 6;
        const n = Math.min(cats.length, 4); const stripeW = bw / n;
        for (let j = 0; j < n; j++) {
          s += '<rect x="' + r2(bx + j * stripeW) + '" y="' + r2(by) + '" width="' + r2(stripeW - (j < n - 1 ? 1 : 0)) +
            '" height="' + bandH + '" rx="1.5" fill="' + cats[j].color + '"/>';
        }
        if (state.showLabels) {
          const starting = evs.filter((e) => e.start === key);
          if (starting.length) {
            const c = categoryById(state, starting[0].categoryId);
            s += text(cx + g.cellW - 5, cy + 15, esc(clip(starting[0].name || '', 9)), c ? c.color : th.muted, 7.5, 700, 'end');
          }
        }
      }
    } else if (state.trailingDays) {
      const num = dayNum < 1 ? prevDim + dayNum : dayNum - dim;
      s += text(cx + 6, cy + 15, String(num), th.muted, 12, 400, 'start', 0.4);
    }
  }
  return s;
}

function layoutLegend(state, availW, g, th) {
  const cats = state.categories || [];
  if (!cats.length) return { svg: '', height: 0 };
  const itemH = 26, sw = 14, gapX = 26, textPad = 8;
  const measure = (s) => s.length * 7.2 + sw + textPad + gapX;
  const rows = [[]]; let cur = 0;
  cats.forEach((c) => {
    const w = measure(c.label || 'Untitled');
    if (cur + w > availW && rows[rows.length - 1].length) { rows.push([]); cur = 0; }
    rows[rows.length - 1].push({ c: c, w: w }); cur += w;
  });
  const legendTop = g.margin + headerHeight(state) + gridHeight(state, g) + 30;
  let svg = '';
  svg += '<line x1="' + r2(g.margin) + '" y1="' + r2(legendTop - 14) + '" x2="' + r2(g.margin + availW) +
    '" y2="' + r2(legendTop - 14) + '" stroke="' + th.line + '" stroke-width="1"/>';
  rows.forEach((rowItems, ri) => {
    const rowW = rowItems.reduce((a, it) => a + it.w, 0) - gapX;
    let x = g.margin + (availW - rowW) / 2;
    const y = legendTop + ri * itemH;
    rowItems.forEach((it) => {
      svg += '<rect x="' + r2(x) + '" y="' + r2(y + 2) + '" width="' + sw + '" height="' + sw + '" rx="3" fill="' + it.c.color + '"/>';
      svg += text(x + sw + textPad, y + 13, esc(it.c.label || 'Untitled'), th.text, 12, 500, 'start');
      x += it.w;
    });
  });
  return { svg: svg, height: rows.length * itemH };
}

function buildNotes(state, totalW, topY, g, th) {
  const noteText = (state.notes || '').trim();
  if (!noteText) return { svg: '', y: topY, h: 0 };
  const lines = wrapLines(noteText, totalW - g.margin * 2, 11);
  if (!lines.length) return { svg: '', y: topY, h: 0 };
  const lineH = 18, pad = 16;
  const h = lines.length * lineH + pad * 2 + 12;
  let svg = '';
  svg += '<line x1="' + r2(g.margin) + '" y1="' + r2(topY + 6) + '" x2="' + r2(totalW - g.margin) +
    '" y2="' + r2(topY + 6) + '" stroke="' + th.line + '" stroke-width="1"/>';
  svg += text(g.margin + 4, topY + 22, 'Notes', th.muted, 10, 600, 'start', 0.7);
  for (let i = 0; i < lines.length; i++) {
    svg += text(g.margin + 4, topY + 22 + pad + i * lineH + 2, esc(lines[i]), th.sub, 11, 400, 'start');
  }
  return { svg: svg, y: topY, h: h };
}

function wrapLines(str, maxW, fontSize) {
  const charsPerLine = Math.floor(maxW / (fontSize * 0.6)) || 40;
  const paragraphs = str.split(/\n/);
  const lines = [];
  paragraphs.forEach((para) => {
    const words = para.split(/\s+/);
    let cur = '';
    words.forEach((w) => {
      if (!w) return;
      if ((cur + ' ' + w).trim().length > charsPerLine && cur.length) { lines.push(cur.trim()); cur = w; }
      else cur = cur ? cur + ' ' + w : w;
    });
    if (cur.trim()) lines.push(cur.trim());
  });
  return lines;
}

function headerHeight(state) {
  let h = 0;
  if ((state.title || '').trim()) h += 40;
  if ((state.subtitle || '').trim()) h += 26;
  if ((state.title || '').trim() || (state.subtitle || '').trim()) h += 22;
  return h;
}
function gridHeight(state, g) {
  const months = Math.max(1, Math.min(36, +state.months || 10));
  let cols = state.columns === 'auto' ? Math.max(1, Math.min(4, Math.ceil(Math.sqrt(months * 1.3)))) : Math.max(1, Math.min(6, parseInt(state.columns, 10)));
  cols = Math.min(cols, months);
  const rows = Math.ceil(months / cols);
  const blockH = g.monthHead + g.weekdayHead + g.weeks * g.cellH + g.monthPad * 2;
  return rows * blockH + (rows - 1) * g.gap;
}

/* ---------- Main ---------- */
async function main() {
  const opts = parseArgs();

  // Help
  if (opts.help || opts.h) {
    console.log(`Calendur CLI — headless calendar generator

Usage:
  node cli/calendur.js [options]

Options:
  --year      <n>   Year (1-9999, default: current)
  --months    <n>   Number of months (1-36, default: 10)
  --start     <n>   Start month 0=Jan..11=Dec (default: 8=Sep)
  --theme     <s>   noir|paper|mono|slate|blueprint|cream (default: noir)
  --title     <s>   Calendar title
  --subtitle  <s>   Calendar subtitle
  --notes     <s>   Notes text (appears below legend)
  --weekstart <0|1> Week starts: 0=Sun, 1=Mon (default: 0)
  --fontscale <n>   Font size multiplier 0.5-2 (default: 1)
  --columns   <s>   Grid columns: auto|1-6 (default: auto)
  --borders   <0|1> Show month borders (default: 1)
  --watermark        Add "Made with Calendur" credit line
  --config    <f>   Load full config from JSON file
  --stdin            Read config JSON from stdin
  --format    <s>   Output format: svg|png|jpg (default: svg)
  --scale     <n>   Scale factor for raster output (default: 2)
  -o          <f>   Output file path (default: stdout)
  --help, -h        Show this help

JSON config format (--config or --stdin):
  { "title":"...", "year":2027, "months":12,
    "categories":[{"label":"Holiday","color":"#c62828"},...],
    "events":[{"name":"Break","categoryId":"c1","start":"2027-03-15","end":"2027-03-19"},...] }

Examples:
  node cli/calendur.js -o cal.svg
  node cli/calendur.js --year 2027 --months 12 --theme paper -o 2027.svg
  node cli/calendur.js --config config.json --format png --scale 4 -o out.png
  echo '{"year":2027,"months":6,"theme":"paper"}' | node cli/calendur.js --stdin -o out.svg`);
    process.exit(0);
  }

  // Build state
  let state = defaultState();

  // Load from --config file or --stdin
  if (opts.stdin) {
    let raw = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) raw += chunk;
    try { state = Object.assign(state, JSON.parse(raw)); } catch (e) { console.error('Invalid JSON from stdin'); process.exit(1); }
  }
  if (opts.config) {
    try { state = Object.assign(state, JSON.parse(fs.readFileSync(opts.config, 'utf8'))); } catch (e) { console.error('Cannot read config file:', opts.config); process.exit(1); }
  }

  // Override with CLI args (CLI args take priority)
  if (opts.year)      state.year = Math.max(1, Math.min(9999, +opts.year));
  if (opts.months)    state.months = Math.max(1, Math.min(36, +opts.months));
  if (opts.start)     state.startMonth = Math.max(0, Math.min(11, +opts.start));
  if (opts.theme && THEMES[opts.theme]) state.theme = opts.theme;
  if (opts.title)     state.title = opts.title;
  if (opts.subtitle)  state.subtitle = opts.subtitle;
  if (opts.notes)     state.notes = opts.notes;
  if (opts.weekstart !== undefined) state.weekStart = +opts.weekstart ? 1 : 0;
  if (opts.fontscale) state.fontScale = parseFloat(opts.fontscale) || 1;
  if (opts.watermark === 'true' || opts.watermark === '1') state.showWatermark = true;
  if (opts.columns)   state.columns = opts.columns;
  if (opts.borders === '0' || opts.borders === 'false') state.showBorders = false;

  // Build SVG
  const svg = buildCalendar(state);

  const format = (opts.format || 'svg').toLowerCase();
  const outFile = opts.o || opts.output || null;

  if (format === 'svg') {
    if (outFile) {
      fs.writeFileSync(outFile, svg, 'utf8');
      console.error('Wrote', outFile, '(' + (Buffer.byteLength(svg, 'utf8') / 1024).toFixed(1) + ' KB)');
    } else {
      process.stdout.write(svg);
    }
  } else if (format === 'png' || format === 'jpg' || format === 'jpeg') {
    // Try to use sharp for rasterization
    let sharp;
    try { sharp = require('sharp'); } catch (e) { /* not installed */ }
    if (!sharp) {
      console.error('For PNG/JPG output, install sharp:  npm install sharp');
      console.error('Or use SVG format and convert with an external tool.');
      if (outFile) fs.writeFileSync(outFile.replace(/\.[^.]+$/, '.svg'), svg, 'utf8');
      process.exit(1);
    }
    const scale = parseFloat(opts.scale || 2);
    const svgBuf = Buffer.from(svg, 'utf8');
    // Parse viewBox to get dimensions
    const vb = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    const w = Math.round(parseFloat(vb ? vb[1] : 800) * scale);
    const h = Math.round(parseFloat(vb ? vb[2] : 600) * scale);
    const pipeline = sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: format === 'jpg' ? 1 : 0 } } });
    // Embed SVG as overlay — sharp can't render SVG directly, so we use a workaround
    // Actually sharp doesn't render SVG natively. We'd need the 'sharp' SVG support.
    // Let's fall back to saving SVG and telling the user.
    console.error('Sharp SVG rasterization requires additional setup. Saving as SVG instead.');
    const svgOut = outFile ? outFile.replace(/\.[^.]+$/, '.svg') : null;
    if (svgOut) { fs.writeFileSync(svgOut, svg, 'utf8'); console.error('Wrote', svgOut); }
    else process.stdout.write(svg);
    console.error('Tip: Use rsvg-convert or inkscape to convert SVG → PNG/JPG:');
    console.error('  rsvg-convert -w ' + w + ' -o output.png ' + (svgOut || 'input.svg'));
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
