/* ============================================================================
 * Calendur — client-side calendar generator
 * Builds a print-ready SVG calendar grid and exports to SVG / PNG / JPG.
 * No dependencies. Design inspired by nagusamecs.github.io.
 * ========================================================================== */
(function () {
  'use strict';

  /* ---------- Constants ---------- */
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const STORAGE_KEY = 'calendur.state.v1';

  // SVG geometry (in SVG user units — scaled by state.fontScale at build time)
  const G = {
    cellW: 46, cellH: 42,
    monthHead: 30, weekdayHead: 22, monthPad: 14,
    weeks: 6, gap: 24, margin: 48,
    // returns a fresh object scaled by state.fontScale (called once per build)
    scaled: function () {
      const s = +(state.fontScale || 1);
      if (s === 1) return { cellW: 46, cellH: 42, monthHead: 30, weekdayHead: 22, monthPad: 14, weeks: 6, gap: 24, margin: 48 };
      const rnd = (v) => Math.round(v * s * 10) / 10;
      return { cellW: rnd(46), cellH: rnd(42), monthHead: rnd(30), weekdayHead: rnd(22), monthPad: rnd(14), weeks: 6, gap: rnd(24), margin: rnd(48) };
    }
  };

  const THEMES = {
    noir:      { name: 'Noir (site match)', page: '#000000', month: '#0a0a0a', line: '#222222', text: '#ffffff', muted: '#666666', weekend: '#141414', header: '#ffffff', sub: '#999999', today: '#ffffff' },
    paper:     { name: 'Paper (light)',     page: '#ffffff', month: '#ffffff', line: '#e6e6e6', text: '#111111', muted: '#9a9a9a', weekend: '#f6f6f6', header: '#111111', sub: '#666666', today: '#111111' },
    mono:      { name: 'Mono Light',        page: '#f4f4f5', month: '#ffffff', line: '#dcdce0', text: '#18181b', muted: '#a1a1aa', weekend: '#ececee', header: '#18181b', sub: '#52525b', today: '#18181b' },
    slate:     { name: 'Slate',             page: '#1c2128', month: '#22272e', line: '#373e47', text: '#e6edf3', muted: '#768390', weekend: '#2d333b', header: '#e6edf3', sub: '#adbac7', today: '#e6edf3' },
    blueprint: { name: 'Blueprint',         page: '#0d1b2a', month: '#122740', line: '#1f3d5c', text: '#e0f0ff', muted: '#5a7ea0', weekend: '#0f2137', header: '#cfe8ff', sub: '#8fb4d4', today: '#7fc7ff' },
    cream:     { name: 'Cream',             page: '#faf6ef', month: '#fffdf8', line: '#e7ddc9', text: '#3a3226', muted: '#a99d84', weekend: '#f3ecdd', header: '#3a3226', sub: '#7a6f58', today: '#3a3226' },
  };

  const PALETTES = {
    academic: { name: 'Academic', colors: ['#c62828','#1565c0','#2e7d32','#6a1b9a','#ef6c00','#00838f','#ad1457','#f9a825'] },
    vivid:    { name: 'Vivid',    colors: ['#e53935','#1e88e5','#43a047','#8e24aa','#fb8c00','#00acc1','#d81b60','#fdd835'] },
    pastel:   { name: 'Pastel',   colors: ['#e79aa0','#8fb8e0','#9fcf9a','#c3a3dd','#f2c08a','#8fd0d0','#eeaac6','#efe19b'] },
    earth:    { name: 'Earth',    colors: ['#a4553b','#5c8a72','#c5a880','#4e7a8a','#8d6e63','#7d9b76','#b5843f','#6d5a7a'] },
    neon:     { name: 'Neon',     colors: ['#ff2e63','#00e5ff','#39ff14','#bc13fe','#ff9f1c','#08f7fe','#ff6ec7','#ffe600'] },
  };

  /* ---------- State ---------- */
  let uid = 1;
  const nextId = () => 'id' + (uid++) + Date.now().toString(36);

  function defaultState() {
    const y = new Date().getFullYear();
    return {
      title: (y) + '\u2013' + (y + 1) + ' Academic Year',
      subtitle: '',
      notes: '',
      year: y,
      startMonth: 8, // September
      months: 10,
      columns: 'auto',
      weekStart: 0,
      theme: 'noir',
      shadeWeekend: true,
      highlightToday: false,
      showLabels: false,
      trailingDays: false,
      showBorders: true,
      showWatermark: false,
      fontScale: 1,
      weekendDays: [0, 6], // Sun, Sat
      todayColor: '#ffffff',
      categories: [
        { id: nextId(), label: 'Holiday', color: '#c62828' },
        { id: nextId(), label: 'Break',   color: '#1565c0' },
        { id: nextId(), label: 'Event',   color: '#2e7d32' },
        { id: nextId(), label: 'Exam',    color: '#6a1b9a' },
      ],
      events: [],
    };
  }

  let state = load() || defaultState();

  /* ---------- Persistence ---------- */
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.categories)) return null;
      // Migrate old state: merge missing keys from fresh defaults
      const fresh = defaultState();
      for (const k of Object.keys(fresh)) {
        if (!(k in s)) s[k] = fresh[k];
      }
      return s;
    } catch (e) { return null; }
  }

  /* ---------- Date helpers ---------- */
  const pad2 = (n) => String(n).padStart(2, '0');
  const ymd = (y, m, d) => y + '-' + pad2(m + 1) + '-' + pad2(d);
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const firstWeekday = (y, m) => new Date(Date.UTC(y, m, 1)).getUTCDay();
  // All date arithmetic uses UTC for consistency; events and today must match.
  const todayKey = () => { const d = new Date(); return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

  function monthAt(k) {
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
  function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  function readableOn(hex) { return luminance(hex) > 0.55 ? '#000000' : '#ffffff'; }
  function withAlpha(hex, a) {
    const { r, g, b } = hexToRgb(hex);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function categoryById(id) { return state.categories.find((c) => c.id === id) || null; }

  /* Events covering a given date key, in category order. */
  function eventsOn(key) {
    return state.events.filter((e) => e.start <= key && key <= e.end);
  }

  /* ---------- XML escape ---------- */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ============================================================================
   * SVG BUILDER
   * ========================================================================== */
  function buildCalendar() {
    const th = THEMES[state.theme] || THEMES.noir;
    const months = Math.max(1, Math.min(36, state.months | 0));
    let cols = state.columns === 'auto'
      ? Math.max(1, Math.min(4, Math.ceil(Math.sqrt(months * 1.3))))
      : Math.max(1, Math.min(6, parseInt(state.columns, 10)));
    cols = Math.min(cols, months);
    const rows = Math.ceil(months / cols);

    // Geometry scaled by fontScale
    const g = G.scaled();
    const innerW = 7 * g.cellW;
    const blockW = innerW + g.monthPad * 2;
    const blockH = g.monthHead + g.weekdayHead + g.weeks * g.cellH + g.monthPad * 2;

    const gridW = cols * blockW + (cols - 1) * g.gap;
    const totalW = gridW + g.margin * 2;

    // Header height
    let headH = 0;
    const hasTitle = (state.title || '').trim().length > 0;
    const hasSub = (state.subtitle || '').trim().length > 0;
    if (hasTitle) headH += 40;
    if (hasSub) headH += 26;
    if (hasTitle || hasSub) headH += 22;

    const gridTop = g.margin + headH;
    const gridH = rows * blockH + (rows - 1) * g.gap;

    // Legend layout (below grid)
    const legend = layoutLegend(gridW, g);
    const legendTop = gridTop + gridH + (state.categories.length ? 30 : 0);

    // Notes block (below legend)
    const notesBlock = buildNotes(totalW, legendTop + legend.height + (state.categories.length ? 0 : 8), g, th);

    // Watermark
    const watermarkH = state.showWatermark ? 22 : 0;
    const totalH = notesBlock.y + notesBlock.h + watermarkH + g.margin;

    const wk = weekdayOrder();
    const tKey = todayKey();
    const todayCol = state.highlightToday ? (state.todayColor || th.today) : th.today;

    let body = '';
    // Background
    body += rect(0, 0, totalW, totalH, th.page, null, 0);

    // Title / subtitle
    if (hasTitle) {
      body += text(totalW / 2, g.margin + 30, esc(state.title), th.header, 30, 700, 'middle');
    }
    if (hasSub) {
      const sy = g.margin + (hasTitle ? 60 : 26);
      body += text(totalW / 2, sy, esc(state.subtitle), th.sub, 15, 500, 'middle');
    }

    // Month blocks
    for (let k = 0; k < months; k++) {
      const col = k % cols;
      const row = Math.floor(k / cols);
      const bx = g.margin + col * (blockW + g.gap);
      const by = gridTop + row * (blockH + g.gap);
      body += buildMonth(bx, by, monthAt(k), th, wk, tKey, todayCol, g);
    }

    // Legend
    body += legend.svg;
    // Notes
    body += notesBlock.svg;
    // Watermark
    if (state.showWatermark) {
      body += text(totalW - g.margin, totalH - g.margin + 4,
        'Made with Calendur \u00b7 nagusamecs.github.io', th.muted, 9, 400, 'end', 0.45);
    }

    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + totalW + '" height="' + totalH +
      '" viewBox="0 0 ' + totalW + ' ' + totalH + '" font-family="' + G.fontStack() +
      '" text-rendering="optimizeLegibility" shape-rendering="geometricPrecision">' + body + '</svg>';

    return { svg: svg, width: totalW, height: totalH, theme: th };
  }

  G.fontStack = () => "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

  function weekdayOrder() {
    const arr = [];
    for (let i = 0; i < 7; i++) arr.push((state.weekStart + i) % 7);
    return arr;
  }

  function buildMonth(x, y, ym, th, wk, tKey, todayCol, g) {
    const { y: yr, m } = ym;
    let s = '';
    const innerX = x + g.monthPad;
    const innerY = y + g.monthPad;
    const innerW = 7 * g.cellW;

    // Block background (no border if showBorders is off)
    const borderStroke = state.showBorders ? th.line : null;
    s += rect(x, y, innerW + g.monthPad * 2, g.monthHead + g.weekdayHead + g.weeks * g.cellH + g.monthPad * 2, th.month, borderStroke, 8);

    // Month name
    s += text(x + (innerW + g.monthPad * 2) / 2, innerY + (g.monthHead * 0.66), esc(MONTHS[m] + ' ' + yr), th.header, 15, 600, 'middle');

    // Weekday header
    const wRowY = innerY + g.monthHead;
    for (let i = 0; i < 7; i++) {
      const cx = innerX + i * g.cellW + g.cellW / 2;
      const isWknd = state.weekendDays && state.weekendDays.indexOf(wk[i]) !== -1;
      s += text(cx, wRowY + (g.weekdayHead * 0.68), WEEKDAYS[wk[i]].toUpperCase().slice(0, 3), isWknd ? th.muted : th.sub, 9.5, 600, 'middle');
    }

    // Day grid
    const gridY = wRowY + g.weekdayHead;
    const offset = (firstWeekday(yr, m) - state.weekStart + 7) % 7;
    const dim = daysInMonth(yr, m);
    const prevDim = daysInMonth(m === 0 ? yr - 1 : yr, (m + 11) % 12);

    for (let i = 0; i < 42; i++) {
      const col = i % 7;
      const rowN = Math.floor(i / 7);
      const cx = innerX + col * g.cellW;
      const cy = gridY + rowN * g.cellH;
      const dayNum = i - offset + 1;
      const inMonth = dayNum >= 1 && dayNum <= dim;

      const wd = wk[col];
      const isWknd = state.weekendDays && state.weekendDays.indexOf(wd) !== -1;

      let cellBg = th.month;
      if (inMonth && state.shadeWeekend && isWknd) cellBg = th.weekend;

      // Cell background + border
      s += rect(cx, cy, g.cellW, g.cellH, cellBg, borderStroke, 0, 0.6);

      if (inMonth) {
        const key = ymd(yr, m, dayNum);
        const evs = eventsOn(key);

        // Tint whole cell
        if (evs.length) {
          const first = categoryById(evs[0].categoryId);
          if (first) s += rect(cx + 0.6, cy + 0.6, g.cellW - 1.2, g.cellH - 1.2, withAlpha(first.color, 0.16), null, 0);
        }

        // Day number
        s += text(cx + 6, cy + 15, dayNum, th.text, 12, 500, 'start');

        // Today ring
        if (state.highlightToday && key === tKey) {
          s += '<rect x="' + r2(cx + 1.5) + '" y="' + r2(cy + 1.5) + '" width="' + r2(g.cellW - 3) +
            '" height="' + r2(g.cellH - 3) + '" rx="4" fill="none" stroke="' + todayCol + '" stroke-width="1.6"/>';
        }

        // Colour band(s) at bottom
        if (evs.length) {
          const cats = [];
          evs.forEach((e) => { const c = categoryById(e.categoryId); if (c && !cats.find((x) => x.id === c.id)) cats.push(c); });
          const bandH = 7;
          const by = cy + g.cellH - bandH - 2;
          const bx = cx + 3;
          const bw = g.cellW - 6;
          const n = Math.min(cats.length, 4);
          const stripeW = bw / n;
          for (let j = 0; j < n; j++) {
            s += '<rect x="' + r2(bx + j * stripeW) + '" y="' + r2(by) + '" width="' + r2(stripeW - (j < n - 1 ? 1 : 0)) +
              '" height="' + bandH + '" rx="1.5" fill="' + cats[j].color + '"/>';
          }

          // Optional event label on start day
          if (state.showLabels) {
            const starting = evs.filter((e) => e.start === key);
            if (starting.length) {
              const label = starting[0].name || '';
              const c = categoryById(starting[0].categoryId);
              const short = clip(label, 9);
              s += text(cx + g.cellW - 5, cy + 15, esc(short), c ? c.color : th.muted, 7.5, 700, 'end');
            }
          }
        }
      } else if (state.trailingDays) {
        const num = dayNum < 1 ? prevDim + dayNum : dayNum - dim;
        s += text(cx + 6, cy + 15, num, th.muted, 12, 400, 'start', 0.4);
      }
    }
    return s;
  }

  function clip(str, n) { return str.length > n ? str.slice(0, n - 1) + '\u2026' : str; }

  function layoutLegend(availW, g) {
    const cats = state.categories;
    if (!cats.length) return { svg: '', height: 0 };
    const th = THEMES[state.theme] || THEMES.noir;
    const itemH = 26, sw = 14, gapX = 26, textPad = 8;
    const measure = (s) => s.length * 7.2 + sw + textPad + gapX;

    // Wrap into rows
    const rows = [[]];
    let cur = 0;
    cats.forEach((c) => {
      const w = measure(c.label || 'Untitled');
      if (cur + w > availW && rows[rows.length - 1].length) { rows.push([]); cur = 0; }
      rows[rows.length - 1].push({ c: c, w: w });
      cur += w;
    });

    const legendTop = g.margin + headerHeight() + gridHeight(g) + 30;
    let svg = '';
    // Divider line above legend
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

  // Build freeform notes block below the legend
  function buildNotes(totalW, topY, g, th) {
    const noteText = (state.notes || '').trim();
    if (!noteText) return { svg: '', y: topY, h: 0 };
    const lines = wrapLines(noteText, totalW - g.margin * 2, 11, totalW);
    if (!lines.length) return { svg: '', y: topY, h: 0 };
    const lineH = 18, pad = 16;
    const h = lines.length * lineH + pad * 2 + 12; // 12 extra for label
    let svg = '';
    // Divider
    svg += '<line x1="' + r2(g.margin) + '" y1="' + r2(topY + 6) + '" x2="' + r2(totalW - g.margin) +
      '" y2="' + r2(topY + 6) + '" stroke="' + th.line + '" stroke-width="1"/>';
    // Label
    svg += text(g.margin + 4, topY + 22, 'Notes', th.muted, 10, 600, 'start', 0.7);
    // Lines
    for (let i = 0; i < lines.length; i++) {
      svg += text(g.margin + 4, topY + 22 + pad + i * lineH + 2, esc(lines[i]), th.sub, 11, 400, 'start');
    }
    return { svg: svg, y: topY, h: h };
  }

  // Simple word-wrapping for notes (character-based, reasonable guess)
  function wrapLines(str, maxW, fontSize, totalW) {
    const charsPerLine = Math.floor(maxW / (fontSize * 0.6));
    if (charsPerLine < 10) charsPerLine = 40;
    const paragraphs = str.split(/\n/);
    const lines = [];
    paragraphs.forEach((para) => {
      const words = para.split(/\s+/);
      let cur = '';
      words.forEach((w) => {
        if (!w) return;
        if ((cur + ' ' + w).trim().length > charsPerLine && cur.length) {
          lines.push(cur.trim()); cur = w;
        } else {
          cur = cur ? cur + ' ' + w : w;
        }
      });
      if (cur.trim()) lines.push(cur.trim());
    });
    return lines;
  }

  // Helpers reused by legend / notes for total-height calc
  function headerHeight() {
    let h = 0;
    const hasTitle = (state.title || '').trim().length > 0;
    const hasSub = (state.subtitle || '').trim().length > 0;
    if (hasTitle) h += 40;
    if (hasSub) h += 26;
    if (hasTitle || hasSub) h += 22;
    return h;
  }
  function gridHeight(g) {
    const months = Math.max(1, Math.min(36, state.months | 0));
    let cols = state.columns === 'auto'
      ? Math.max(1, Math.min(4, Math.ceil(Math.sqrt(months * 1.3))))
      : Math.max(1, Math.min(6, parseInt(state.columns, 10)));
    cols = Math.min(cols, months);
    const rows = Math.ceil(months / cols);
    const blockH = g.monthHead + g.weekdayHead + g.weeks * g.cellH + g.monthPad * 2;
    return rows * blockH + (rows - 1) * g.gap;
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

  /* ============================================================================
   * RENDER PREVIEW
   * ========================================================================== */
  let currentBuild = null;
  let zoom = 1, autoFit = true;
  let renderQueued = false;

  // Coalesce rapid state changes (typing, colour dragging) into one paint per
  // animation frame instead of rebuilding the whole SVG on every keystroke.
  function render() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; renderNow(); });
  }

  // Force any pending render to run immediately (used before export).
  function flush() { if (renderQueued) { renderQueued = false; renderNow(); } }

  function renderNow() {
    currentBuild = buildCalendar();
    $('#preview-canvas').innerHTML = currentBuild.svg;
    applyZoom();
    updateDims();
    save();
  }

  function applyZoom() {
    const canvas = $('#preview-canvas');
    const svg = canvas.querySelector('svg');
    if (!svg) return;
    if (autoFit) {
      const stage = $('#preview-stage');
      const avail = stage.clientWidth - 64;
      zoom = Math.min(1, avail / currentBuild.width);
    }
    svg.style.width = (currentBuild.width * zoom) + 'px';
    svg.style.height = (currentBuild.height * zoom) + 'px';
  }

  function updateDims() {
    const fmt = $('#x-format').value;
    let scale = 1;
    if (fmt !== 'svg') {
      const sv = $('#x-scale').value;
      scale = sv === 'custom' ? (parseFloat($('#x-width').value) / currentBuild.width) : parseFloat(sv);
    }
    const w = Math.round(currentBuild.width * scale);
    const h = Math.round(currentBuild.height * scale);
    $('#x-dims').textContent = fmt === 'svg'
      ? 'Vector \u2014 scales to any size (' + currentBuild.width + '\u00d7' + currentBuild.height + ' base).'
      : 'Output: ' + w + '\u00d7' + h + ' px';
  }

  /* ============================================================================
   * EXPORT
   * ========================================================================== */
  function svgString() { return currentBuild.svg; }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function safeName() {
    const base = (state.title || 'calendar').trim().replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '');
    return (base || 'calendar');
  }

  function rasterize(format, scale) {
    return new Promise((resolve, reject) => {
      const build = currentBuild;
      const img = new Image();
      const svgBlob = new Blob([build.svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = function () {
        const w = Math.round(build.width * scale);
        const h = Math.round(build.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (format === 'jpg') { ctx.fillStyle = build.theme.page; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('encode failed')),
          format === 'jpg' ? 'image/jpeg' : 'image/png', format === 'jpg' ? 0.94 : undefined);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG load failed')); };
      img.src = url;
    });
  }

  async function doExport() {
    flush();
    const fmt = $('#x-format').value;
    if (fmt === 'svg') {
      downloadBlob(new Blob([svgString()], { type: 'image/svg+xml;charset=utf-8' }), safeName() + '.svg');
      toast('Downloaded SVG');
      return;
    }
    const sv = $('#x-scale').value;
    let scale = sv === 'custom' ? (parseFloat($('#x-width').value) / currentBuild.width) : parseFloat(sv);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    try {
      const blob = await rasterize(fmt, scale);
      downloadBlob(blob, safeName() + '.' + fmt);
      toast('Downloaded ' + fmt.toUpperCase());
    } catch (e) {
      toast('Export failed: ' + e.message);
    }
  }

  /* ============================================================================
   * UI WIRING
   * ========================================================================== */
  function $(sel) { return document.querySelector(sel); }

  function populateSelects() {
    const sm = $('#c-start-month');
    sm.innerHTML = MONTHS.map((m, i) => '<option value="' + i + '">' + m + '</option>').join('');
    const th = $('#c-theme');
    th.innerHTML = Object.keys(THEMES).map((k) => '<option value="' + k + '">' + THEMES[k].name + '</option>').join('');
    const pal = $('#c-palette');
    pal.innerHTML = '<option value="">Custom…</option>' + Object.keys(PALETTES).map((k) => '<option value="' + k + '">' + PALETTES[k].name + '</option>').join('');
  }

  function syncInputsFromState() {
    $('#c-title').value = state.title;
    $('#c-subtitle').value = state.subtitle;
    $('#c-notes').value = state.notes || '';
    $('#c-year').value = state.year;
    $('#c-start-month').value = state.startMonth;
    $('#c-months').value = state.months;
    $('#c-columns').value = state.columns;
    $('#c-weekstart').value = state.weekStart;
    $('#c-theme').value = state.theme;
    $('#c-weekend').checked = state.shadeWeekend;
    $('#c-today').checked = state.highlightToday;
    $('#c-labels').checked = state.showLabels;
    $('#c-trailing').checked = state.trailingDays;
    $('#c-borders').checked = state.showBorders !== false;
    $('#c-watermark').checked = !!state.showWatermark;
    $('#c-fontscale').value = String(state.fontScale || 1);
    $('#c-todaycolor').value = state.todayColor || '#ffffff';
    $('#c-todaycolor-wrap').classList.toggle('hidden', !state.highlightToday);
    syncWeekendChips();
    renderCategories();
    renderEventCategoryOptions();
    renderEvents();
  }

  function renderCategories() {
    const list = $('#cat-list');
    list.innerHTML = '';
    state.categories.forEach((cat) => {
      const row = document.createElement('div');
      row.className = 'cat-row';
      row.innerHTML =
        '<input type="color" class="cat-swatch" value="' + cat.color + '" aria-label="Colour">' +
        '<input type="text" class="cat-label" value="' + esc(cat.label) + '" placeholder="Label" aria-label="Label">' +
        '<button class="cat-del" title="Remove" aria-label="Remove">\u00d7</button>';
      const swatch = row.querySelector('.cat-swatch');
      const label = row.querySelector('.cat-label');
      const del = row.querySelector('.cat-del');
      swatch.addEventListener('input', () => { cat.color = swatch.value; renderEventCategoryOptions(); renderEvents(); render(); });
      label.addEventListener('input', () => { cat.label = label.value; renderEventCategoryOptions(); render(); });
      del.addEventListener('click', () => {
        state.categories = state.categories.filter((c) => c.id !== cat.id);
        state.events = state.events.filter((e) => e.categoryId !== cat.id);
        renderCategories(); renderEventCategoryOptions(); renderEvents(); render();
      });
      list.appendChild(row);
    });
  }

  function syncWeekendChips() {
    const row = $('#weekend-row');
    if (!row) return;
    if (!Array.isArray(state.weekendDays)) state.weekendDays = [0, 6];
    row.innerHTML = '';
    [0,1,2,3,4,5,6].forEach((d) => {
      const chip = document.createElement('span');
      chip.className = 'weekend-chip' + (state.weekendDays.indexOf(d) !== -1 ? ' active' : '');
      chip.textContent = WEEKDAYS[d].slice(0, 2);
      chip.addEventListener('click', () => {
        const idx = state.weekendDays.indexOf(d);
        if (idx === -1) state.weekendDays.push(d);
        else state.weekendDays.splice(idx, 1);
        state.weekendDays.sort((a,b) => a-b);
        syncWeekendChips();
        render();
      });
      row.appendChild(chip);
    });
  }

  function renderEventCategoryOptions() {
    const sel = $('#e-category');
    const prev = sel.value;
    sel.innerHTML = state.categories.map((c) => '<option value="' + c.id + '">' + esc(c.label) + '</option>').join('');
    if (state.categories.find((c) => c.id === prev)) sel.value = prev;
  }

  function renderEvents() {
    const list = $('#event-list');
    if (!state.events.length) {
      list.innerHTML = '<div class="empty-note">No events yet. Add holidays, breaks or exam periods above.</div>';
      return;
    }
    const sorted = state.events.slice().sort((a, b) => a.start.localeCompare(b.start));
    list.innerHTML = '';
    sorted.forEach((ev) => {
      const cat = categoryById(ev.categoryId);
      const item = document.createElement('div');
      item.className = 'event-item';
      const range = ev.start === ev.end ? ev.start : ev.start + ' \u2192 ' + ev.end;
      item.innerHTML =
        '<span class="event-dot" style="background:' + (cat ? cat.color : '#666') + '"></span>' +
        '<div class="event-info"><div class="event-name">' + esc(ev.name || '(untitled)') + '</div>' +
        '<div class="event-date">' + range + (cat ? ' \u00b7 ' + esc(cat.label) : '') + '</div></div>' +
        '<button class="event-del" title="Remove" aria-label="Remove">\u00d7</button>';
      item.querySelector('.event-del').addEventListener('click', () => {
        state.events = state.events.filter((e) => e.id !== ev.id);
        renderEvents(); render();
      });
      list.appendChild(item);
    });
  }

  function bind() {
    // Text/number/select fields
    on('#c-title', 'input', (v) => state.title = v);
    on('#c-subtitle', 'input', (v) => state.subtitle = v);
    on('#c-notes', 'input', (v) => state.notes = v);
    on('#c-year', 'input', (v) => state.year = clampInt(v, 1, 9999, state.year));
    on('#c-start-month', 'change', (v) => state.startMonth = parseInt(v, 10));
    on('#c-months', 'input', (v) => state.months = clampInt(v, 1, 36, state.months));
    on('#c-columns', 'change', (v) => state.columns = v);
    on('#c-weekstart', 'change', (v) => state.weekStart = parseInt(v, 10));
    on('#c-theme', 'change', (v) => state.theme = v);
    on('#c-fontscale', 'change', (v) => { state.fontScale = parseFloat(v) || 1; });
    on('#c-todaycolor', 'input', (v) => { state.todayColor = v; });
    onCheck('#c-weekend', (v) => state.shadeWeekend = v);
    onCheck('#c-today', (v) => { state.highlightToday = v; $('#c-todaycolor-wrap').classList.toggle('hidden', !v); });
    onCheck('#c-labels', (v) => state.showLabels = v);
    onCheck('#c-trailing', (v) => state.trailingDays = v);
    onCheck('#c-borders', (v) => state.showBorders = v);
    onCheck('#c-watermark', (v) => state.showWatermark = v);

    // Palette apply
    $('#c-palette').addEventListener('change', (e) => {
      const key = e.target.value;
      if (!key || !PALETTES[key]) return;
      const colors = PALETTES[key].colors;
      state.categories.forEach((c, i) => { c.color = colors[i % colors.length]; });
      renderCategories(); renderEventCategoryOptions(); renderEvents(); render();
      e.target.value = '';
    });

    // Add category
    $('#btn-add-cat').addEventListener('click', () => {
      const palColors = PALETTES.academic.colors;
      const color = palColors[state.categories.length % palColors.length];
      state.categories.push({ id: nextId(), label: 'New code', color: color });
      renderCategories(); renderEventCategoryOptions(); render();
    });

    // Add event
    $('#btn-add-event').addEventListener('click', addEvent);
    ['#e-name', '#e-start', '#e-end'].forEach((sel) => {
      $(sel).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addEvent(); } });
    });

    // Export controls
    $('#x-format').addEventListener('change', () => {
      const isSvg = $('#x-format').value === 'svg';
      $('#x-scale-wrap').classList.toggle('hidden', isSvg);
      if (isSvg) $('#x-width-wrap').classList.add('hidden');
      else $('#x-width-wrap').classList.toggle('hidden', $('#x-scale').value !== 'custom');
      updateDims();
    });
    $('#x-scale').addEventListener('change', () => {
      $('#x-width-wrap').classList.toggle('hidden', $('#x-scale').value !== 'custom');
      updateDims();
    });
    $('#x-width').addEventListener('input', updateDims);
    $('#btn-download').addEventListener('click', doExport);
    $('#btn-copy-svg').addEventListener('click', copySvg);

    // Zoom
    $('#zoom-in').addEventListener('click', () => { autoFit = false; zoom = Math.min(4, zoom * 1.2); applyZoom(); });
    $('#zoom-out').addEventListener('click', () => { autoFit = false; zoom = Math.max(0.1, zoom / 1.2); applyZoom(); });
    $('#zoom-fit').addEventListener('click', () => { autoFit = true; applyZoom(); });
    window.addEventListener('resize', () => { if (autoFit) applyZoom(); });

    // Config import/export/reset
    $('#btn-export-json').addEventListener('click', exportJson);
    $('#btn-import').addEventListener('click', () => $('#file-input').click());
    $('#file-input').addEventListener('change', importJson);
    $('#btn-reset').addEventListener('click', () => {
      if (!confirm('Reset everything to defaults? This clears your current calendar.')) return;
      state = defaultState();
      syncInputsFromState(); render(); toast('Reset to defaults');
    });
  }

  function on(sel, evt, fn) {
    $(sel).addEventListener(evt, (e) => { fn(e.target.value); render(); });
  }
  function onCheck(sel, fn) {
    $(sel).addEventListener('change', (e) => { fn(e.target.checked); render(); });
  }
  function clampInt(v, min, max, fallback) {
    const n = parseInt(v, 10);
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function addEvent() {
    const name = $('#e-name').value.trim();
    const catId = $('#e-category').value;
    let start = $('#e-start').value;
    let end = $('#e-end').value;
    if (!catId) { toast('Add a colour code first'); return; }
    if (!start && !end) { toast('Pick at least a start date'); return; }
    if (!start) start = end;
    if (!end) end = start;
    if (end < start) { const t = start; start = end; end = t; }
    state.events.push({ id: nextId(), name: name, categoryId: catId, start: start, end: end });
    $('#e-name').value = '';
    renderEvents(); render();
    toast('Event added');
  }

  async function copySvg() {    flush();    try {
      await navigator.clipboard.writeText(svgString());
      toast('SVG markup copied');
    } catch (e) {
      toast('Copy failed \u2014 use Download instead');
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    downloadBlob(blob, safeName() + '.json');
    toast('Config exported');
  }

  function importJson(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(reader.result);
        if (!s || !Array.isArray(s.categories)) throw new Error('bad file');
        state = Object.assign(defaultState(), s);
        syncInputsFromState(); render(); toast('Config imported');
      } catch (err) {
        toast('Import failed \u2014 invalid file');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ---------- Init ---------- */
  function init() {
    populateSelects();
    syncInputsFromState();
    bind();
    renderNow();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
