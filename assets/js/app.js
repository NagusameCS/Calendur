/* ============================================================================
 * Calendur — client-side calendar generator
 * Builds a print-ready SVG calendar grid and exports to SVG / PNG / JPG.
 * No dependencies.
 * ========================================================================== */
(function () {
  'use strict';

  /* ---------- Constants ---------- */
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const STORAGE_KEY = 'calendur.state.v1';

  // Locale data: month names (full), weekday names (3-char)
  const LOCALES = {
    en: { name:'English', months:MONTHS, weekdays:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] },
    es: { name:'Español', months:['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'], weekdays:['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'] },
    fr: { name:'Français', months:['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'], weekdays:['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'] },
    de: { name:'Deutsch', months:['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'], weekdays:['So','Mo','Di','Mi','Do','Fr','Sa'] },
    ja: { name:'日本語', months:['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'], weekdays:['日','月','火','水','木','金','土'] },
    zh: { name:'中文', months:['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'], weekdays:['日','一','二','三','四','五','六'] },
    pt: { name:'Português', months:['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'], weekdays:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'] },
    it: { name:'Italiano', months:['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'], weekdays:['Dom','Lun','Mar','Mer','Gio','Ven','Sab'] },
    ru: { name:'Русский', months:['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'], weekdays:['Вс','Пн','Вт','Ср','Чт','Пт','Сб'] },
    ar: { name:'العربية', months:['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'], weekdays:['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'] },
    ko: { name:'한국어', months:['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'], weekdays:['일','월','화','수','목','금','토'] },
    hi: { name:'हिन्दी', months:['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'], weekdays:['रवि','सोम','मंगल','बुध','गुरु','शुक्र','शनि'] },
  };

  function localeMonths() { var l=LOCALES[state.language||'en']; return l?l.months:MONTHS; }
  function localeWeekdays() { var l=LOCALES[state.language||'en']; return l?l.weekdays:WEEKDAYS; }

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
      language: 'en',
      shadeWeekend: true,
      highlightToday: false,
      showLabels: false,
      trailingDays: false,
      showBorders: true,
      showWatermark: false,
      fontScale: 1,
      weekendDays: [0, 6], // Sun, Sat
      todayColor: '#ffffff',
      dayAlign: 'start',
      eventFilter: '',
      interactiveView: false,
      interactiveSvg: true,  // embed hover tooltips in SVG exports
      showQr: false,
      showWeekNumbers: false,
      termLabels: [],
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
  let _saveQueued = false;
  function save() {
    // Defer localStorage writes to idle time — avoids blocking the render path
    if (_saveQueued) return;
    _saveQueued = true;
    const doSave = () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
      _saveQueued = false;
    };
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(doSave, { timeout: 2000 });
    } else {
      setTimeout(doSave, 100);
    }
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
  const isLeapYear = (y) => ((y % 4 === 0) && (y % 100 !== 0)) || (y % 400 === 0);
  // All date arithmetic uses UTC for consistency; events and today must match.
  const todayKey = () => { const d = new Date(); return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

  function monthAt(k) {
    const idx = state.startMonth + k;
    return { y: state.year + Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 };
  }

  /* ---------- Colour helpers ---------- */
  function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function withAlpha(hex, a) {
    const h = hex.replace('#', '');
    const n = h.length === 3
      ? parseInt(h[0]+h[0]+h[1]+h[1]+h[2]+h[2], 16)
      : parseInt(h, 16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

  // Category lookup cache — built once per render
  let _catMap = null;
  function buildCatMap() {
    _catMap = new Map();
    state.categories.forEach((c) => _catMap.set(c.id, c));
  }
  function categoryById(id) {
    if (_catMap) {
      const c = _catMap.get(id);
      return c || null;
    }
    return state.categories.find((c) => c.id === id) || null;
  }

  /* ---------- Event lookup ---------- */

  /** Pre-compute event index: Map<dateKey, Event[]> for O(1) day lookups.
   *  Rebuilt once per render. Expands date ranges into individual day keys.
   *  Capped at 1000 days per event to prevent runaway on multi-year ranges. */
  let _eventIndex = null;
  function buildEventIndex() {
    _eventIndex = new Map();
    state.events.forEach((ev) => {
      let s = ev.start, e = ev.end;
      if (e < s) { const t = s; s = e; e = t; }
      const startDate = new Date(s + 'T00:00:00Z');
      const endDate = new Date(e + 'T00:00:00Z');
      let count = 0;

      // Handle recurring events
      var repeat = ev.repeat;
      if (repeat && repeat !== 'none') {
        var interval = repeat === 'biweekly' ? 14 : repeat === 'weekly' ? 7 : 0;
        if (repeat === 'monthly') {
          // Monthly: increment month, keep same day (clamped to month end)
          var calendarEnd = new Date(Date.UTC(state.year, state.startMonth + state.months, 0));
          var rd = new Date(startDate);
          while (rd <= calendarEnd && count < 1000) {
            var key = ymd(rd.getUTCFullYear(), rd.getUTCMonth(), rd.getUTCDate());
            if (!_eventIndex.has(key)) _eventIndex.set(key, []);
            _eventIndex.get(key).push(ev);
            count++;
            // Next month, same day
            var targetDay = startDate.getUTCDate();
            rd.setUTCMonth(rd.getUTCMonth() + 1);
            rd.setUTCDate(1); // safe reset
            var dim = new Date(Date.UTC(rd.getUTCFullYear(), rd.getUTCMonth() + 1, 0)).getUTCDate();
            rd.setUTCDate(Math.min(targetDay, dim));
          }
          return;
        }
        if (interval > 0) {
          // Weekly/biweekly
          var calendarEnd = new Date(Date.UTC(state.year, state.startMonth + state.months, 0));
          for (var rd = new Date(startDate); rd <= calendarEnd && count < 1000; rd.setUTCDate(rd.getUTCDate() + interval)) {
            var key = ymd(rd.getUTCFullYear(), rd.getUTCMonth(), rd.getUTCDate());
            if (!_eventIndex.has(key)) _eventIndex.set(key, []);
            _eventIndex.get(key).push(ev);
            count++;
          }
          return;
        }
      }

      // Standard range expansion
      for (let d = new Date(startDate); d <= endDate && count < 1000; d.setUTCDate(d.getUTCDate() + 1)) {
        const key = ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        if (!_eventIndex.has(key)) _eventIndex.set(key, []);
        _eventIndex.get(key).push(ev);
        count++;
      }
    });
    return _eventIndex;
  }

  /* Events covering a given date key — O(1) lookup from pre-built index. */
  function eventsOn(key) {
    if (_eventIndex) {
      const found = _eventIndex.get(key);
      return found || [];
    }
    // Fallback to linear scan (shouldn't happen during render)
    return state.events.filter((e) => e.start <= key && key <= e.end);
  }

  /* ---------- XML escape ---------- */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- Week numbers ---------- */
  // ISO 8601 week number. Week 1 is the week with the first Thursday.
  function isoWeekNum(y, m, d) {
    var date = new Date(Date.UTC(y, m, d));
    date.setUTCDate(date.getUTCDate() + 3 - (date.getUTCDay() + 6) % 7);
    var week1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    week1.setUTCDate(week1.getUTCDate() + 3 - (week1.getUTCDay() + 6) % 7);
    return 1 + Math.round((date - week1) / 604800000);
  }

  /* ============================================================================
   * SVG BUILDER
   * ========================================================================== */

  /** Build the full SVG calendar from current state.
   *  Returns { svg, width, height, theme }.
   *  Layout: title + subtitle → month grid → legend → notes → watermark. */
  function buildCalendar() {
    const th = THEMES[state.theme] || THEMES.noir;
    const months = Math.max(1, Math.min(36, state.months | 0));
    // Pre-compute event index for O(1) lookups during cell rendering
    buildEventIndex();
    // Pre-compute category lookup map
    buildCatMap();
    let cols = state.columns === 'auto'
      ? Math.max(1, Math.min(4, Math.ceil(Math.sqrt(months * 1.3))))
      : Math.max(1, Math.min(6, parseInt(state.columns, 10)));
    cols = Math.min(cols, months);
    const rows = Math.ceil(months / cols);

    // Geometry scaled by fontScale
    const g = G.scaled();
    const innerW = 7 * g.cellW + (state.showWeekNumbers ? 20 : 0);
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


  function downloadQr() {
    var qrUrl = 'https://nagusamecs.github.io/Calendur/';
    try {
      var json = JSON.stringify({ categories: state.categories, events: state.events, notes: state.notes });
      try { qrUrl += '#cfg=' + btoa(unescape(encodeURIComponent(json))); } catch (e) {}
    } catch (e) {}
    var apiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(qrUrl);
    // Open in new tab for download
    var a = document.createElement('a');
    a.href = apiUrl;
    a.download = 'calendur-qr.png';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast('QR opened for download');
  }


    // QR code (if enabled) — reserve space at bottom
    var qrH = state.showQr ? 80 + g.margin : 0;
    var totalH = notesBlock.y + notesBlock.h + watermarkH + qrH + g.margin;

    const wk = weekdayOrder();
    const tKey = todayKey();
    const todayCol = state.highlightToday ? (state.todayColor || th.today) : th.today;

    const body = [];
    const p = body.push.bind(body);
    // Background
    p(rect(0, 0, totalW, totalH, th.page, null, 0));

    // Interactive SVG: embed CSS for hover feedback + tooltips
    if (state.interactiveSvg !== false) {
      p('<style>' +
        '.ev-day:hover { filter: brightness(1.18); cursor: pointer; }' +
        '.ev-day:hover .ev-tint { opacity: 0.35; }' +
        '.ev-band-stripe:hover { filter: brightness(1.3); }' +
        '.ev-band-stripe { transition: filter 0.12s ease; }' +
        '.ev-day { transition: filter 0.12s ease; }' +
        '</style>');
    }

    // Title / subtitle
    if (hasTitle) {
      p(text(totalW / 2, g.margin + 30, esc(state.title), th.header, 30, 700, 'middle'));
    }
    if (hasSub) {
      const sy = g.margin + (hasTitle ? 60 : 26);
      p(text(totalW / 2, sy, esc(state.subtitle), th.sub, 15, 500, 'middle'));
    }


    // Month blocks with term label dividers
    var terms = state.termLabels || [];
    var termDivs = [];
    if (terms.length > 1) {
      var monthsPerTerm = Math.ceil(months / terms.length);
      for (var ti = 0; ti < terms.length - 1; ti++) {
        var afterRow = Math.floor(((ti + 1) * monthsPerTerm - 1) / cols);
        termDivs.push({ row: afterRow, label: terms[ti + 1] });
      }
    }
    for (let k = 0; k < months; k++) {
      const col = k % cols;
      const row = Math.floor(k / cols);
      const bx = g.margin + col * (blockW + g.gap);
      const by = gridTop + row * (blockH + g.gap);
      // Check for term divider before this row
      for (var td = 0; td < termDivs.length; td++) {
        if (termDivs[td].row === row && col === 0 && !termDivs[td].drawn) {
          var divY = by - g.gap / 2;
          p('<line x1="' + r2(g.margin) + '" y1="' + r2(divY) + '" x2="' + r2(totalW - g.margin) + '" y2="' + r2(divY) + '" stroke="' + th.line + '" stroke-width="1.5" stroke-dasharray="6,3"/>');
          p(text(totalW / 2, divY - 6, esc(termDivs[td].label), th.sub, 13, 600, 'middle'));
          termDivs[td].drawn = true;
        }
      }
      p(buildMonth(bx, by, monthAt(k), th, wk, tKey, todayCol, g));
    }


    // Legend
    p(legend.svg);
    // Notes
    p(notesBlock.svg);
    // Watermark
    if (state.showWatermark) {
      p(text(totalW - g.margin, totalH - g.margin + 4,
        'Made with Calendur', th.muted, 9, 400, 'end', 0.45));
    }

    // QR code in bottom-left corner
    // QR code
    if (state.showQr) {
      try {
        var qrUrl = 'https://nagusamecs.github.io/Calendur/';
        var qrJson = JSON.stringify({ categories: state.categories, events: state.events, notes: state.notes });
        try { qrUrl += '#cfg=' + btoa(unescape(encodeURIComponent(qrJson))); } catch (e) {}
        var qs = 80;
        p('<g transform="translate(' + r2(g.margin) + ',' + r2(totalH - g.margin - qs) + ')">' +
          '<rect x="-4" y="-4" width="' + (qs + 8) + '" height="' + (qs + 8) + '" fill="' + th.page + '" rx="4"/>' +
          '<image x="0" y="0" width="' + qs + '" height="' + qs + '" ' +
          'href="https://api.qrserver.com/v1/create-qr-code/?size=' + qs + 'x' + qs + '&amp;data=' + encodeURIComponent(qrUrl) + '" ' +
          'preserveAspectRatio="none"/>' +
          '</g>');
      } catch (e) {}
    }

    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + totalW + '" height="' + totalH +
      '" viewBox="0 0 ' + totalW + ' ' + totalH + '" font-family="' + G.fontStack() +
      '" text-rendering="optimizeLegibility" shape-rendering="geometricPrecision">' + body.join('') + '</svg>';

    return { svg: svg, width: totalW, height: totalH, theme: th };
  }

  /* ============================================================================
   * HTML CALENDAR BUILDER (interactive hover view with tooltips)
   * ========================================================================== */
  /** Build interactive HTML calendar matching the SVG layout.
   *  Each month is a <table>, cells have data-tip attributes for hover tooltips.
   *  Returns HTML string. */
  function buildHtmlCalendar() {
    const th = THEMES[state.theme] || THEMES.noir;
    const months = Math.max(1, Math.min(36, state.months | 0));
    buildEventIndex();
    buildCatMap();
    const tKey = todayKey();
    const wk = weekdayOrder();
    const todayCol = state.highlightToday ? (state.todayColor || th.today) : th.today;

    let html = '<div class="cal-html-grid" style="background:' + th.page + '">';
    // Header
    if ((state.title || '').trim()) {
      html += '<div class="cal-title" style="color:' + th.header + ';background:' + th.page + ';width:100%">' + esc(state.title) + '</div>';
    }
    if ((state.subtitle || '').trim()) {
      html += '<div class="cal-subtitle" style="color:' + th.sub + ';background:' + th.page + ';width:100%">' + esc(state.subtitle) + '</div>';
    }

    const wdShort = localeWeekdays();

    for (let k = 0; k < months; k++) {
      const ym = monthAt(k);
      const { y: yr, m } = ym;
      const offset = (firstWeekday(yr, m) - state.weekStart + 7) % 7;
      const dim = daysInMonth(yr, m);
      const prevDim = daysInMonth(m === 0 ? yr - 1 : yr, (m + 11) % 12);
      const borderStyle = state.showBorders ? '1px solid ' + th.line : 'none';

      html += '<div class="cal-month" style="background:' + th.month + ';border:' + borderStyle + '">';
      let mLabel=localeMonths()[m]+' '+yr;
      if (m === 1 && isLeapYear(yr)) mLabel += ' ⋈';
      html += '<div class="cal-month-name" style="color:' + th.header + '">' + esc(mLabel) + '</div>';
      html += '<table><thead><tr>';
      for (let i = 0; i < 7; i++) {
        const wd = wk[i];
        const isWknd = state.weekendDays && state.weekendDays.indexOf(wd) !== -1;
        html += '<th style="color:' + (isWknd ? th.muted : th.sub) + '">' + wdShort[wd] + '</th>';
      }
      html += '</tr></thead><tbody>';

      let dayIdx = 0;
      for (let rowN = 0; rowN < 6; rowN++) {
        html += '<tr>';
        for (let col = 0; col < 7; col++) {
          const dayNum = dayIdx - offset + 1;
          const inMonth = dayNum >= 1 && dayNum <= dim;
          const wd = wk[col];
          const isWknd = state.weekendDays && state.weekendDays.indexOf(wd) !== -1;
          let cellBg = th.month;
          if (inMonth && state.shadeWeekend && isWknd) cellBg = th.weekend;

          let cls = '';
          let dataAttrs = '';
          let bands = '';
          let tipTitle = '';
          let tipBody = '';

          if (inMonth) {
            const key = ymd(yr, m, dayNum);
            const evs = eventsOn(key);
            if (evs.length) {
              cls += ' has-event';
              const cats = [];
              evs.forEach((e) => { const c = categoryById(e.categoryId); if (c && !cats.find((x) => x.id === c.id)) cats.push(c); });
              bands = '<div class="event-band">' + cats.slice(0, 4).map((c) => '<span style="background:' + c.color + '"></span>').join('') + '</div>';
              // Build tooltip data
              const tipParts = evs.map((e) => {
                const c2 = categoryById(e.categoryId);
                const range2 = e.start === e.end ? e.start : e.start + ' → ' + e.end;
                return '<div class="tt-name">' + esc(e.name || 'Untitled') + '</div>' +
                  '<div class="tt-meta">' + esc(range2) + (c2 ? ' · ' + esc(c2.label) : '') + '</div>' +
                  (e.description ? '<div class="tt-desc">' + esc(e.description) + '</div>' : '');
              });
              tipTitle = esc(evs[0].name || '');
              tipBody = tipParts.join('');
              dataAttrs = ' data-tip="' + esc(tipBody) + '"';
            }
            if (state.highlightToday && key === tKey) cls += ' today-ring';
          } else if (state.trailingDays) {
            cls += ' trailing';
          }

          const num = inMonth ? dayNum : (dayNum < 1 ? prevDim + dayNum : dayNum - dim);
          const align = state.dayAlign || 'start';
          html += '<td class="' + cls + '" style="background:' + cellBg + ';border:' + borderStyle + ';text-align:' + align +
            (cls.includes('today-ring') ? ';box-shadow:inset 0 0 0 1.6px ' + todayCol : '') +
            '"' + dataAttrs + '>' +
            '<span class="day-num" style="color:' + th.text + '">' + num + '</span>' + bands + '</td>';
          dayIdx++;
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }
    html += '</div>';

    // Legend
    if (state.categories.length) {
      html += '<div class="cal-legend" style="border-color:' + th.line + ';color:' + th.text + '">';
      state.categories.forEach((c) => {
        html += '<span><span class="lg-swatch" style="background:' + c.color + '"></span>' + esc(c.label) + '</span>';
      });
      html += '</div>';
    }

    // Notes
    if ((state.notes || '').trim()) {
      html += '<div class="cal-notes" style="color:' + th.sub + '">' +
        esc(state.notes).replace(/\n/g, '<br>') + '</div>';
    }

    // Watermark
    if (state.showWatermark) {
      html += '<div class="cal-watermark" style="color:' + th.muted + '">Made with Calendur</div>';
    }

    return html;
  }

  /* Tooltip handler for HTML calendar */
  function initTooltip() {
    const tip = $('#cal-tooltip');
    if (!tip) return;
    const htmlPane = $('#preview-html');
    if (!htmlPane) return;
    htmlPane.addEventListener('mouseover', (e) => {
      const cell = e.target.closest('[data-tip]');
      if (!cell) { tip.classList.remove('show'); return; }
      tip.innerHTML = cell.getAttribute('data-tip');
      tip.classList.add('show');
    });
    htmlPane.addEventListener('mousemove', (e) => {
      if (!tip.classList.contains('show')) return;
      let x = e.clientX + 16, y = e.clientY + 12;
      if (x + tip.offsetWidth > window.innerWidth - 8) x = e.clientX - tip.offsetWidth - 8;
      if (y + tip.offsetHeight > window.innerHeight - 8) y = e.clientY - tip.offsetHeight - 8;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    });
    htmlPane.addEventListener('mouseleave', () => tip.classList.remove('show'));
  }

  G.fontStack = () => "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

  function weekdayOrder() {
    const arr = [];
    for (let i = 0; i < 7; i++) arr.push((state.weekStart + i) % 7);
    return arr;
  }

  /** Build one month block as SVG. Returns string.
   *  @param {number} x, y — top-left position in SVG coords
   *  @param {{y,m}} ym — year and month index (0=Jan)
   *  @param {object} th — theme object
   *  @param {number[]} wk — weekday order array
   *  @param {string} tKey — today's date key (YYYY-MM-DD)
   *  @param {string} todayCol — today ring colour
   *  @param {object} g — scaled geometry object */
  function buildMonth(x, y, ym, th, wk, tKey, todayCol, g) {
    const { y: yr, m } = ym;
    const parts = [];
    const push = parts.push.bind(parts);
    const innerX = x + g.monthPad;
    const innerY = y + g.monthPad;
    const innerW = 7 * g.cellW + (state.showWeekNumbers ? 20 : 0);

    // Block background
    const borderStroke = state.showBorders ? th.line : null;
    push(rect(x, y, innerW + g.monthPad * 2, g.monthHead + g.weekdayHead + g.weeks * g.cellH + g.monthPad * 2, th.month, borderStroke, 8));

    // Month name
    const lcMonths=localeMonths(); let monthLabel=lcMonths[m]+' '+yr;
    if (m === 1 && isLeapYear(yr)) monthLabel += ' \u22c8';
    push(text(x + (innerW + g.monthPad * 2) / 2, innerY + (g.monthHead * 0.66), esc(monthLabel), th.header, 15, 600, 'middle'));

    // Weekday header
    const wRowY = innerY + g.monthHead;
    for (let i = 0; i < 7; i++) {
      const cx = innerX + i * g.cellW + g.cellW / 2;
      const isWknd = state.weekendDays && state.weekendDays.indexOf(wk[i]) !== -1;
      push(text(cx, wRowY + (g.weekdayHead * 0.68), localeWeekdays()[wk[i]], isWknd ? th.muted : th.sub, 9.5, 600, 'middle'));
    }


    // Day grid
    const gridY = wRowY + g.weekdayHead;
    const offset = (firstWeekday(yr, m) - state.weekStart + 7) % 7;
    const dim = daysInMonth(yr, m);
    const prevDim = daysInMonth(m === 0 ? yr - 1 : yr, (m + 11) % 12);

    // Week number column (rendered before cells so they appear on the left)
    if (state.showWeekNumbers) {
      var prevWeek = 0;
      for (var wi = 0; wi < 42; wi++) {
        var wday = wi - offset + 1;
        if (wday >= 1 && wday <= dim) {
          var wkNum = isoWeekNum(yr, m, wday);
          if (wkNum !== prevWeek) {
            var wrow = Math.floor(wi / 7);
            var wy = gridY + wrow * g.cellH;
            push(text(innerX - 16, wy + 13, wkNum, th.muted, 8, 400, 'end'));
            prevWeek = wkNum;
          }
        }
      }
    }


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

      const hasEvents = inMonth && eventsOn(ymd(yr, m, dayNum)).length > 0;
      if (hasEvents && state.interactiveSvg !== false) {
        const key = ymd(yr, m, dayNum);
        const evs = eventsOn(key);
        const tipParts = evs.map((e) => {
          const c2 = categoryById(e.categoryId);
          const r2d = e.start === e.end ? e.start : e.start + ' → ' + e.end;
          return esc(e.name || 'Untitled') + ' | ' + esc(r2d) +
            (c2 ? ' · ' + esc(c2.label) : '') +
            (e.description ? ' — ' + esc(e.description) : '');
        });
        push('<g class="ev-day"><title>' + tipParts.join('&#10;') + '</title>');
      }

      // Cell background + border (with data-date for click-to-add)
      var dateAttr = inMonth ? ' data-date="' + ymd(yr, m, dayNum) + '"' : '';
      push(rect(cx, cy, g.cellW, g.cellH, cellBg, borderStroke, 0, 0.6, 'class="cal-cell"' + dateAttr));

      if (inMonth) {
        const key = ymd(yr, m, dayNum);
        const evs = eventsOn(key);

        // Tint
        if (evs.length) {
          const first = categoryById(evs[0].categoryId);
          if (first) push(rect(cx + 0.6, cy + 0.6, g.cellW - 1.2, g.cellH - 1.2, withAlpha(first.color, 0.16), null, 0, 'class="ev-tint"'));
        }

        // Day number
        const align = state.dayAlign || 'start';
        const numX = align === 'start' ? (cx + 6) : align === 'end' ? (cx + g.cellW - 6) : (cx + g.cellW / 2);
        push(text(numX, cy + 13, dayNum, th.text, 12, 500, align));

        // Today ring
        if (state.highlightToday && key === tKey) {
          push('<rect x="' + r2(cx + 1.5) + '" y="' + r2(cy + 1.5) + '" width="' + r2(g.cellW - 3) +
            '" height="' + r2(g.cellH - 3) + '" rx="4" fill="none" stroke="' + todayCol + '" stroke-width="1.6"/>');
        }

        // Colour band(s)
        if (evs.length) {
          const cats = [];
          evs.forEach((e) => { const c = categoryById(e.categoryId); if (c && !cats.find((x) => x.id === c.id)) cats.push(c); });
          const bandH = 7, by = cy + g.cellH - bandH - 2, bx = cx + 3, bw = g.cellW - 6;
          const n = Math.min(cats.length, 4); const stripeW = bw / n;
          for (let j = 0; j < n; j++) {
            push('<rect class="ev-band-stripe" x="' + r2(bx + j * stripeW) + '" y="' + r2(by) + '" width="' + r2(stripeW - (j < n - 1 ? 1 : 0)) +
              '" height="' + bandH + '" rx="1.5" fill="' + cats[j].color + '"/>');
          }

          if (state.showLabels) {
            const starting = evs.filter((e) => e.start === key);
            if (starting.length) {
              const maxLabels = 2;
              const labelH = 7;
              const baseY = cy + 26;
              for (let li = 0; li < Math.min(starting.length, maxLabels); li++) {
                const c = categoryById(starting[li].categoryId);
                push(text(cx + g.cellW - 4, baseY + li * labelH,
                  esc(clip(starting[li].name || '', 7)),
                  c ? c.color : th.muted, 6.5, 600, 'end'));
              }
              if (starting.length > maxLabels) {
                push(text(cx + g.cellW - 4, baseY + maxLabels * labelH,
                  '+' + (starting.length - maxLabels), th.muted, 6, 600, 'end'));
              }
            }
          }
        }
      } else if (state.trailingDays) {
        const num = dayNum < 1 ? prevDim + dayNum : dayNum - dim;
        push(text(cx + 6, cy + 15, num, th.muted, 12, 400, 'start', 0.4));
      }

      if (hasEvents && state.interactiveSvg !== false) push('</g>');
    }
    return parts.join('');
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
  function rect(x, y, w, h, fill, stroke, r, sw, extra) {
    let s = '<rect x="' + r2(x) + '" y="' + r2(y) + '" width="' + r2(w) + '" height="' + r2(h) + '"';
    if (r) s += ' rx="' + r + '"';
    if (fill) s += ' fill="' + fill + '"'; else s += ' fill="none"';
    if (stroke) s += ' stroke="' + stroke + '" stroke-width="' + (sw || 1) + '"';
    if (extra) s += ' ' + extra;
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
    if (state.interactiveView) {
      // HTML mode: skip SVG build entirely for speed
      $('#preview-canvas').classList.add('hidden');
      $('#preview-html').classList.remove('hidden');
      $('#preview-html').innerHTML = buildHtmlCalendar();
      persistHighlight();
      updateDims();
      save();
      initTooltip();
    } else {
      currentBuild = buildCalendar();
      $('#preview-html').classList.add('hidden');
      $('#preview-canvas').classList.remove('hidden');
      $('#preview-canvas').innerHTML = currentBuild.svg;
      applyZoom();
      persistHighlight();
      updateDims();
      save();
    }
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
      scale = scaleFor(sv);
    }
    const w = Math.round((currentBuild && currentBuild.width || 800) * scale);
    const h = Math.round((currentBuild && currentBuild.height || 600) * scale);
    const label = $('#x-scale option:checked').textContent;
    $('#x-dims').textContent = fmt === 'svg'
      ? 'Vector \u2014 scales to any size (' + (currentBuild && currentBuild.width || 0) + '\u00d7' + (currentBuild && currentBuild.height || 0) + ' base).'
      : 'Output: ' + w + '\u00d7' + h + ' px (' + label + ')';
  }


  function scaleFor(sv) {
    if (sv === 'custom') { var cw = parseFloat($('#x-width').value) || 3000; return cw / (currentBuild && currentBuild.width || 1); }
    if (sv === 'a4')    return 2480 / (currentBuild && currentBuild.width || 1);
    if (sv === 'letter') return 2550 / (currentBuild && currentBuild.width || 1);
    if (sv === 'tabloid') return 3300 / (currentBuild && currentBuild.width || 1);
    if (sv === 'a3')    return 3508 / (currentBuild && currentBuild.width || 1);
    if (sv === 'legal') return 2550 / (currentBuild && currentBuild.width || 1);
    if (sv === 'hd')    return 1920 / (currentBuild && currentBuild.width || 1);
    if (sv === 'fhd')   return 1920 / (currentBuild && currentBuild.width || 1);
    if (sv === 'qhd')   return 2560 / (currentBuild && currentBuild.width || 1);
    if (sv === 'uhd')   return 3840 / (currentBuild && currentBuild.width || 1);
    if (sv === 'mac14') return 3024 / (currentBuild && currentBuild.width || 1);
    if (sv === 'mac16') return 3456 / (currentBuild && currentBuild.width || 1);
    const n = parseFloat(sv);
    return isFinite(n) ? n : 1;
  }


  /* ============================================================================
   * EXPORT
   * ========================================================================== */
  function svgString() { if (!currentBuild) currentBuild = buildCalendar(); return currentBuild.svg; }

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
    // Ensure currentBuild exists (may be null if in HTML view mode)
    if (!currentBuild) currentBuild = buildCalendar();
    const fmt = $('#x-format').value;
    if (fmt === 'ics') {
      var ics = generateIcs();
      downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), safeName() + '.ics');
      toast('Downloaded ICS');
      return;
    }
    if (fmt === 'svg') {
      downloadBlob(new Blob([svgString()], { type: 'image/svg+xml;charset=utf-8' }), safeName() + '.svg');
      toast('Downloaded SVG');
      return;
    }
    const sv = $('#x-scale').value;
    let scale = scaleFor(sv);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    try {
      const blob = await rasterize(fmt, scale);
      downloadBlob(blob, safeName() + '.' + fmt);
      toast('Downloaded ' + fmt.toUpperCase());
    } catch (e) {
      toast('Export failed: ' + e.message);
    }
  }

  /* ---------- Print PDF ---------- */
  function printPdf() {
    flush();
    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) { toast('Popup blocked — allow popups for this site.'); return; }
    const build = currentBuild;
    win.document.write('<!DOCTYPE html><html><head><title>' + esc(safeName()) + '</title><style>' +
      'html,body{margin:0;padding:0;background:#fff;}' +
      '@media print{@page{margin:0.25in;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}' +
      '</style></head><body>' + build.svg + '</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }

  /* ---------- Share URL ---------- */
  function shareUrl() {
    flush();
    try {
      const json = JSON.stringify(state);
      const encoded = btoa(unescape(encodeURIComponent(json)));
      const url = location.origin + location.pathname + '#cfg=' + encoded;
      navigator.clipboard.writeText(url).then(() => {
        toast('Share link copied!');
      }).catch(() => {
        // Fallback: select and copy manually
        toast('Share link: ' + url.substring(0, 60) + '… (in clipboard if supported)');
      });
      // Also update the address bar
      history.replaceState(null, '', '#cfg=' + encoded);
    } catch (e) {
      toast('Could not encode — config too large?');
    }
  }

  /* ---------- Embed code generator ---------- */
  function copyEmbedCode() {
    flush();
    const params = new URLSearchParams();
    params.set('embed', '1');
    params.set('theme', state.theme);
    params.set('year', state.year);
    params.set('months', state.months);
    params.set('start', state.startMonth);
    if (state.title) params.set('title', state.title);
    if (state.subtitle) params.set('subtitle', state.subtitle);
    if (!state.showBorders) params.set('borders', '0');
    if (state.showWatermark) params.set('watermark', '1');
    if (state.fontScale !== 1) params.set('fontscale', state.fontScale);
    if (state.weekStart) params.set('weekstart', '1');
    if (state.dayAlign !== 'start') params.set('dayalign', state.dayAlign);

    // Encode events + categories as compact JSON in the URL hash
    const cfg = { categories: state.categories, events: state.events, notes: state.notes };
    const json = JSON.stringify(cfg);
    if (state.events.length > 0 || state.categories.length > 4 || (state.notes || '').trim()) {
      try {
        const encoded = btoa(unescape(encodeURIComponent(json)));
        params.set('cfg', encoded);
      } catch (e) { /* skip if too large */ }
    }

    const embedUrl = 'https://nagusamecs.github.io/Calendur/?' + params.toString();
    const iframeCode = '<iframe src="' + embedUrl + '" style="width:100%;height:600px;border:none;border-radius:8px;" title="Calendur calendar" loading="lazy" allowfullscreen></iframe>';

    navigator.clipboard.writeText(iframeCode).then(() => {
      toast('Embed code copied! Paste into your HTML.');
    }).catch(() => {
      prompt('Copy this embed code:', iframeCode);
    });
  }

  function loadFromHash() {
    try {
      const hash = location.hash;
      const m = hash.match(/^#cfg=(.+)/);
      if (!m) return;
      const json = decodeURIComponent(escape(atob(m[1])));
      const s = JSON.parse(json);
      if (!s || !Array.isArray(s.categories)) return;
      state = Object.assign(defaultState(), s);
      syncInputsFromState(); render(); toast('Loaded shared config');
      // Clean hash
      history.replaceState(null, '', location.pathname + location.search);
    } catch (e) { /* silently ignore bad hash */ }
  }

  /* ---------- Bulk CSV import ---------- */
  function togglePanel(id) {
    const el = $('#' + id);
    if (!el) return;
    ['csv-panel','json-panel','preset-panel','gh-panel'].forEach((pid) => {
      if (pid !== id) $('#' + pid)?.classList.add('hidden');
    });
    el.classList.toggle('hidden');
  }

  function importCsv() {
    const raw = $('#csv-text').value.trim();
    if (!raw) { toast('Paste some data first'); return; }
    const lines = raw.split(/\n/).filter((l) => l.trim());
    if (lines.length < 2) { toast('Need at least a header row + one data row'); return; }
    // Detect delimiter: tab or comma
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
    const nameCol = headers.findIndex((h) => h === 'name' || h === 'event' || h === 'title');
    const catCol  = headers.findIndex((h) => h === 'category' || h === 'cat' || h === 'type' || h === 'color');
    const startCol = headers.findIndex((h) => h === 'start' || h === 'from' || h === 'begin');
    const endCol   = headers.findIndex((h) => h === 'end' || h === 'to' || h === 'finish');
    if (nameCol === -1 || startCol === -1) { toast('Columns needed: Name, Start (and optionally Category, End)'); return; }
    let added = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map((c) => c.trim());
      const name = cols[nameCol] || '';
      let catId = state.categories[0] ? state.categories[0].id : null;
      if (catCol !== -1 && cols[catCol]) {
        const found = state.categories.find((c) => c.label.toLowerCase() === cols[catCol].toLowerCase());
        if (found) catId = found.id;
      }
      if (!catId) continue;
      const start = cols[startCol] || '';
      const end = (endCol !== -1 && cols[endCol]) ? cols[endCol] : start;
      if (!start) continue;
      state.events.push({ id: nextId(), name: name, categoryId: catId, start: start, end: end < start ? start : end });
      added++;
    }
    $('#csv-text').value = '';
    $('#csv-panel').classList.add('hidden');
    renderEvents(); render();
    toast('Imported ' + added + ' event' + (added !== 1 ? 's' : ''));
  }

  /* ---------- JSON paste import ---------- */
  function importJsonText() {
    const raw = ($('#json-text') ? $('#json-text').value.trim() : '');
    if (!raw) { toast('Paste some JSON first'); return; }
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) {
      toast('Invalid JSON — check syntax'); return;
    }
    if (parsed.categories && Array.isArray(parsed.categories)) {
      // Full Calendur config
      state = Object.assign(defaultState(), parsed);
      syncInputsFromState(); render(); toast('Imported full calendar config');
    } else if (Array.isArray(parsed)) {
      importEventArray(parsed);
    } else if (parsed.events && Array.isArray(parsed.events)) {
      importEventArray(parsed.events);
    } else {
      toast('Unrecognized JSON — needs "categories" and/or "events" arrays, or be an event array');
      return;
    }
    $('#json-text').value = '';
    $('#json-panel').classList.add('hidden');
  }

  /* ---------- GitHub import ---------- */
  async function importFromGitHub() {
    let url = $('#gh-url').value.trim();
    if (!url) { toast('Paste a GitHub raw URL'); return; }
    // Convert github.com blob URL to raw URL
    url = url.replace(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/(.+)/, 'https://raw.githubusercontent.com/$1/$2/$3');
    if (!url.startsWith('https://raw.githubusercontent.com/') && !url.startsWith('https://raw.')) {
      // Try to guess: if it's a repo URL without a file, can't proceed
      if (!url.includes('raw')) { toast('Use a raw.githubusercontent.com URL (or a github.com/blob/… URL)'); return; }
    }
    $('#btn-import-gh-go').textContent = 'Fetching…';
    $('#btn-import-gh-go').disabled = true;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const text = await resp.text();
      let parsed;
      // Try JSON first
      try {
        parsed = JSON.parse(text);
      } catch (e) { /* not JSON */ }
      if (parsed) {
        // Is it a full Calendur state?
        if (parsed.categories && Array.isArray(parsed.categories)) {
          state = Object.assign(defaultState(), parsed);
          syncInputsFromState(); render();
          toast('Imported full calendar config from GitHub');
        } else if (Array.isArray(parsed)) {
          // Array of events: [{name, category, start, end, description?}]
          importEventArray(parsed);
        } else if (parsed.events && Array.isArray(parsed.events)) {
          importEventArray(parsed.events);
        } else {
          toast('Unrecognized JSON format');
        }
      } else {
        // Treat as CSV
        $('#csv-text').value = text;
        importCsv();
      }
    } catch (e) {
      toast('Fetch failed: ' + e.message);
    }
    $('#btn-import-gh-go').textContent = 'Fetch & import';
    $('#btn-import-gh-go').disabled = false;
    $('#gh-panel').classList.add('hidden');
  }

  function importEventArray(arr) {
    let added = 0;
    arr.forEach((item) => {
      const name = item.name || item.title || '';
      let catId = state.categories[0] ? state.categories[0].id : null;
      const catLabel = item.category || item.cat || item.type || '';
      if (catLabel) {
        const found = state.categories.find((c) => c.label.toLowerCase() === catLabel.toLowerCase());
        if (found) catId = found.id;
      }
      if (!catId) return;
      const start = item.start || item.from || item.begin || '';
      const end = item.end || item.to || item.finish || start;
      if (!start) return;
      state.events.push({ id: nextId(), name: name, description: item.description || item.desc || '', categoryId: catId, start: start, end: end < start ? start : end });
      added++;
    });
    renderEvents(); render();
    toast('Imported ' + added + ' event' + (added !== 1 ? 's' : '') + ' from GitHub');
  }

  /* ---------- Quick-add presets ---------- */
  const PRESETS = [
    // Fixed dates: [month, day]
    { name: 'New Year\'s Day',  cat: 'Holiday', start: [0,1], end: [0,1] },
    // Nth weekday: [month, weekday(0=Sun..6=Sat), nth(1..5, -1=last)]
    { name: 'MLK Day',          cat: 'Holiday', start: [0,1,3], desc: '3rd Monday of Jan' },
    { name: 'Presidents\' Day', cat: 'Holiday', start: [1,1,3], desc: '3rd Monday of Feb' },
    { name: 'Memorial Day',     cat: 'Holiday', start: [4,1,-1], desc: 'last Monday of May' },
    { name: 'Labor Day',        cat: 'Holiday', start: [8,1,1], desc: '1st Monday of Sep' },
    { name: 'Thanksgiving',     cat: 'Holiday', start: [10,4,4], desc: '4th Thursday of Nov' },
    // Ranges: { start: [month, day], end: [month, day] } or with year-cross
    { name: 'Spring Break',     cat: 'Break',   start: [2,10], end: [2,20], desc: 'mid-March (approx)' },
    { name: 'Summer Break',     cat: 'Break',   start: [5,15], end: [7,15], desc: 'mid-Jun to mid-Aug' },
    { name: 'Fall Break',       cat: 'Break',   start: [9,10], end: [9,15], desc: 'mid-October (approx)' },
    { name: 'Winter Break',     cat: 'Break',   start: [11,20], end: [0,2], desc: 'late Dec to early Jan' },
  ];

  function buildPresets() {
    const grid = $('#preset-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const y = state.year;
    PRESETS.forEach((p) => {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.textContent = p.name + (p.desc ? ' (' + p.desc + ')' : '');
      btn.title = p.desc || p.name;
      btn.addEventListener('click', () => {
        const cat = state.categories.find((c) => c.label.toLowerCase() === p.cat.toLowerCase()) || state.categories[0];
        if (!cat) { toast('Add a colour code first'); return; }
        const s = resolvePresetDate(p.start, y);
        const e = p.end ? resolvePresetDate(p.end, y) : s;
        // Check for cross-year (e.g. Dec→Jan)
        const startStr = s.y + '-' + pad2(s.m + 1) + '-' + pad2(s.d);
        const endStr = e.y + '-' + pad2(e.m + 1) + '-' + pad2(e.d);
        state.events.push({ id: nextId(), name: p.name, categoryId: cat.id, start: startStr, end: endStr < startStr ? startStr : endStr });
        renderEvents(); render(); toast('Added: ' + p.name);
      });
      grid.appendChild(btn);
    });
  }

  function resolvePresetDate(arr, year) {
    // Format: [month, day] or [month, day, nthWeekday] where nthWeekday: 1=1st Mon, 2=2nd Tue, etc.
    let m = arr[0], d = arr[1], n = arr[2];
    let y = year;
    if (n != null) {
      // nth occurrence of weekday d in month m (where d is weekday index 0=Sun)
      // Actually our format: start[0]=month, start[1]=dayOfWeek, start[2]=nth
      // Let me reinterpret: [month, weekday(0-6), nth] like MLK Day: [0,15,3] meaning Jan, Monday?, 3rd
      // Actually let me correct: MLK Day = 3rd Monday of Jan. So [month=0, weekday=1(Mon), nth=3]
      // But my data has [0,15,3] — this is wrong. Let me fix the preset data format.
      // Better: [month, dayOfMonth] for fixed dates, [month, weekday, nth] for nth weekday
      // The current data: start: [1,1] = Jan 1. start: [0,15,3] = Jan, 15th day?, 3 — this is wrong
      // Let me reinterpret for now: if 3 values, [month, weekday, nth]
      const nth = arr[2]; // which occurrence (1st, 2nd, 3rd, 4th, last=-1)
      const wd = arr[1]; // weekday (0=Sun, 1=Mon...)
      const firstDay = new Date(Date.UTC(y, m, 1)).getUTCDay();
      let dayOfMonth = 1 + ((wd - firstDay + 7) % 7) + (nth - 1) * 7;
      if (nth === -1) {
        // Last occurrence
        const dim = daysInMonth(y, m);
        dayOfMonth = dim - ((dim - dayOfMonth + 7) % 7);
        while (dayOfMonth > dim) dayOfMonth -= 7;
        while (dayOfMonth + 7 <= dim) dayOfMonth += 7;
      }
      return { y: y, m: m, d: dayOfMonth };
    }
    // Fixed date
    return { y: y, m: m, d: d };
  }

  /* ============================================================================
   * UI WIRING
   * ========================================================================== */
  function $(sel) { return document.querySelector(sel); }

  function populateSelects() {
    const sm = $('#c-start-month');
    sm.innerHTML = localeMonths().map((m,i)=>'<option value="'+i+'">'+m+'</option>').join('');
    const th = $('#c-theme');
    th.innerHTML = Object.keys(THEMES).map((k) => '<option value="' + k + '">' + THEMES[k].name + '</option>').join('');
    const lg = $('#c-language');
    lg.innerHTML = Object.keys(LOCALES).map((k) => '<option value="' + k + '">' + LOCALES[k].name + '</option>').join('');
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
    $('#c-language').value = state.language || 'en';
    $('#c-weekend').checked = state.shadeWeekend;
    $('#c-today').checked = state.highlightToday;
    $('#c-labels').checked = state.showLabels;
    $('#c-trailing').checked = state.trailingDays;
    $('#c-weeknums').checked = !!state.showWeekNumbers;
    $('#c-terms').value = (state.termLabels || []).join('; ');
    $('#c-borders').checked = state.showBorders !== false;
    $('#c-watermark').checked = !!state.showWatermark;
    $('#c-interactive').checked = state.interactiveSvg !== false;
    $('#c-qr').checked = !!state.showQr;
    $('#c-fontscale').value = String(state.fontScale || 1);
    $('#c-todaycolor').value = state.todayColor || '#ffffff';
    $('#c-todaycolor-wrap').classList.toggle('hidden', !state.highlightToday);
    $('#c-dayalign').value = state.dayAlign || 'start';
    $('#e-filter').value = state.eventFilter || '';
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
      chip.textContent = localeWeekdays()[d];
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
    const filter = (state.eventFilter || '').trim().toLowerCase();
    if (!state.events.length) {
      list.innerHTML = '<div class="empty-note">No events yet. Add holidays, breaks or exam periods above.</div>';
      return;
    }
    let sorted = state.events.slice().sort((a, b) => a.start.localeCompare(b.start));
    if (filter) {
      sorted = sorted.filter((ev) => {
        const cat = categoryById(ev.categoryId);
        return (ev.name || '').toLowerCase().includes(filter) ||
               ev.start.includes(filter) ||
               (cat && cat.label.toLowerCase().includes(filter));
      });
    }
    list.innerHTML = '';
    if (!sorted.length) {
      list.innerHTML = '<div class="empty-note">No events match "' + esc(filter) + '".</div>';
      return;
    }
    sorted.forEach((ev) => {
      const cat = categoryById(ev.categoryId);
      const item = document.createElement('div');
      item.className = 'event-item';
      const range = ev.start === ev.end ? ev.start : ev.start + ' \u2192 ' + ev.end;
      item.innerHTML =
        '<span class="event-dot" style="background:' + (cat ? cat.color : '#666') + '"></span>' +
        '<div class="event-info"><div class="event-name">' + esc(ev.name || '(untitled)') + '</div>' +
        '<div class="event-date">' + range + (cat ? ' \u00b7 ' + esc(cat.label) : '') + '</div>' +
        (ev.description ? '<div class="event-desc">' + esc(ev.description) + '</div>' : '') +
        '</div>' +
        '<button class="event-dup" title="Duplicate" aria-label="Duplicate">+</button>' +
        '<button class="event-del" title="Remove" aria-label="Remove">\u00d7</button>';
      item.querySelector('.event-dup').addEventListener('click', (e) => {
        e.stopPropagation();
        state.events.push({ id: nextId(), name: ev.name + ' (copy)', description: ev.description || '', repeat: ev.repeat || 'none', categoryId: ev.categoryId, start: ev.start, end: ev.end });
        renderEvents(); render(); toast('Event duplicated');
      });
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
    on('#c-language', 'change', (v) => state.language = v);
    on('#c-language', 'change', (v) => state.language = v);
    on('#c-fontscale', 'change', (v) => { state.fontScale = parseFloat(v) || 1; });
    on('#c-todaycolor', 'input', (v) => { state.todayColor = v; });
    onCheck('#c-weekend', (v) => state.shadeWeekend = v);
    onCheck('#c-today', (v) => { state.highlightToday = v; $('#c-todaycolor-wrap').classList.toggle('hidden', !v); });
    onCheck('#c-labels', (v) => state.showLabels = v);
    onCheck('#c-trailing', (v) => state.trailingDays = v);
    onCheck('#c-weeknums', (v) => state.showWeekNumbers = v);
    $('#c-terms').addEventListener('input', function(e) { state.termLabels = e.target.value.split(';').map(function(s){return s.trim()}).filter(Boolean); render(); });
    onCheck('#c-borders', (v) => state.showBorders = v);
    onCheck('#c-watermark', (v) => state.showWatermark = v);
    onCheck('#c-interactive', (v) => state.interactiveSvg = v);
    onCheck('#c-qr', (v) => state.showQr = v);
    $('#btn-download-qr').addEventListener('click', downloadQr);

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
    ['#e-name', '#e-start', '#e-end', '#e-desc'].forEach((sel) => {
      $(sel).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addEvent(); } });
    });

    // Event filter
    on('#e-filter', 'input', (v) => { state.eventFilter = v; renderEvents(); });

    // Bulk CSV import toggle
    $('#btn-import-csv').addEventListener('click', () => {
      togglePanel('csv-panel');
    });
    $('#btn-import-csv-go').addEventListener('click', importCsv);

    // JSON import toggle
    $('#btn-import-json').addEventListener('click', () => {
      togglePanel('json-panel');
    });
    $('#btn-import-json-go').addEventListener('click', importJsonText);

    // GitHub import toggle
    $('#btn-import-gh').addEventListener('click', () => {
      togglePanel('gh-panel');
    });
    $('#btn-import-gh-go').addEventListener('click', importFromGitHub);

    // Quick-add presets toggle
    $('#btn-quick-add').addEventListener('click', () => {
      $('#preset-panel').classList.toggle('hidden');
      $('#csv-panel').classList.add('hidden');
      buildPresets();
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
    $('#btn-print').addEventListener('click', printPdf);
    $('#btn-share').addEventListener('click', shareUrl);
    $('#btn-embed').addEventListener('click', copyEmbedCode);

    // Day alignment
    $('#c-dayalign').addEventListener('change', (e) => { state.dayAlign = e.target.value; render(); });

    // Zoom + view mode
    $('#btn-view-mode').addEventListener('click', () => {
      state.interactiveView = !state.interactiveView;
      $('#btn-view-mode').textContent = state.interactiveView ? 'HTML' : 'SVG';
      $('#btn-view-mode').style.background = state.interactiveView ? 'var(--text-primary)' : '';
      $('#btn-view-mode').style.color = state.interactiveView ? 'var(--bg-primary)' : '';
      render();
    });
    $('#zoom-in').addEventListener('click', () => { autoFit = false; zoom = Math.min(4, zoom * 1.2); applyZoom(); });
    $('#zoom-out').addEventListener('click', () => { autoFit = false; zoom = Math.max(0.1, zoom / 1.2); applyZoom(); });
    $('#zoom-fit').addEventListener('click', () => { autoFit = true; applyZoom(); });
    window.addEventListener('resize', () => { if (autoFit) applyZoom(); });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 's') { e.preventDefault(); doExport(); }
      if (mod && e.key === 'p') { e.preventDefault(); printPdf(); }
      if (mod && e.key === 'e') { e.preventDefault(); $('#e-name').focus(); }
    });

    // Config import/export/reset
    $('#btn-export-json').addEventListener('click', exportJson);
    $('#btn-import').addEventListener('click', () => $('#file-input').click());
    $('#file-input').addEventListener('change', importJson);
    $('#btn-reset').addEventListener('click', () => {
      if (!confirm('Reset everything to defaults? This clears your current calendar.')) return;
      state = defaultState();
      syncInputsFromState(); render(); toast('Reset to defaults');
    });

    // Check URL hash on load for shared config
    loadFromHash();
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

  /** Add an event with validation (swaps start/end if needed, requires category).
   *  Calls renderNow() for immediate preview update. */
  function addEvent() {
    const name = $('#e-name').value.trim();
    const catId = $('#e-category').value;
    const desc = ($('#e-desc') ? $('#e-desc').value.trim() : '');
    const repeatVal = ($('#e-repeat') ? $('#e-repeat').value : 'none');
    let start = $('#e-start').value;
    let end = $('#e-end').value;
    if (!catId) { toast('Add a colour code first'); return; }
    if (!start && !end) { toast('Pick at least a start date'); return; }
    if (!start) start = end;
    if (!end) end = start;
    if (end < start) {
      const t = start; start = end; end = t;
      toast('Dates swapped — start must be before end');
    }
    state.events.push({ id: nextId(), name: name, description: desc, repeat: repeatVal, categoryId: catId, start: start, end: end });
    $('#e-name').value = '';
    if ($('#e-desc')) $('#e-desc').value = '';
    renderEvents();
    renderNow(); // immediate render, not coalesced — user just added an event
    toast('Event added');
  }

  // Date field linking: when start changes, enforce end ≥ start
  function linkDateFields() {
    const sEl = $('#e-start');
    const eEl = $('#e-end');
    if (!sEl || !eEl) return;
    sEl.addEventListener('change', () => {
      if (sEl.value) eEl.setAttribute('min', sEl.value);
      // If current end is before new start, clear it
      if (eEl.value && eEl.value < sEl.value) {
        eEl.value = sEl.value;
      }
    });
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

  /* ---------- Preview click-to-add / drag-to-range ---------- */
  var _dragStart = null, _dragCurrent = null, _dragging = false;
  var _persistStart = null, _persistEnd = null;

  function initPreviewClick() {
    var stage = $('#preview-stage');
    if (!stage) return;

    stage.addEventListener('mousedown', function(e) {
      var cell = e.target.closest('[data-date]');
      if (!cell) return;
      var date = cell.getAttribute('data-date');
      if (!date) return;

      if (e.shiftKey && _persistStart) {
        // Shift+click: extend existing persistent selection
        var a = _persistStart, b = date;
        if (b < a) { var t = a; a = b; b = t; }
        _persistEnd = b;
        _dragStart = a; _dragCurrent = b;
        fillFormDates(a, b);
        persistHighlight();
        _dragging = true;
      } else {
        // Normal click/drag: clear previous and start fresh
        clearPersistHighlight();
        _persistStart = null; _persistEnd = null;
        _dragStart = date; _dragCurrent = date; _dragging = true;
        highlightDragRange(date, date);
      }
      e.preventDefault();
    });

    stage.addEventListener('mousemove', function(e) {
      if (!_dragging) return;
      var cell = e.target.closest('[data-date]');
      if (!cell) return;
      var date = cell.getAttribute('data-date');
      if (!date || date === _dragCurrent) return;
      _dragCurrent = date;
      highlightDragRange(_dragStart, _dragCurrent);
    });

    stage.addEventListener('mouseup', function(e) {
      if (!_dragging) return;
      _dragging = false;
      clearDragHighlight();
      var s = _dragStart, e = _dragCurrent;
      if (!s) return;
      if (e && e < s) { var t = s; s = e; e = t; }
      _persistStart = s; _persistEnd = e || s;
      fillFormDates(s, e || s);
      persistHighlight();
      if (!e.shiftKey && $('#e-name')) $('#e-name').focus();
      _dragStart = null; _dragCurrent = null;
      // Watch form fields for manual date changes
      watchFormDates();
    });

    stage.addEventListener('mouseleave', function() {
      if (_dragging) { _dragging = false; clearDragHighlight(); _dragStart = null; }
    });

    // Initial persistent highlight if form has dates
    updatePersistFromForm();
  }

  function fillFormDates(s, e) {
    if ($('#e-start')) $('#e-start').value = s;
    if ($('#e-end')) $('#e-end').value = e || s;
  }

  function persistHighlight() {
    clearPersistHighlight();
    if (!_persistStart) return;
    var a = _persistStart, b = _persistEnd || _persistStart;
    if (b < a) { var t = a; a = b; b = t; }
    var cells = document.querySelectorAll('[data-date]');
    for (var i = 0; i < cells.length; i++) {
      var d = cells[i].getAttribute('data-date');
      if (d >= a && d <= b) cells[i].classList.add('selection-persist');
    }
  }

  function clearPersistHighlight() {
    var cells = document.querySelectorAll('.selection-persist');
    for (var i = 0; i < cells.length; i++) cells[i].classList.remove('selection-persist');
  }

  function updatePersistFromForm() {
    var s = $('#e-start') ? $('#e-start').value : '';
    var e = $('#e-end') ? $('#e-end').value : '';
    if (s) { _persistStart = s; _persistEnd = e || s; persistHighlight(); }
  }

  var _formWatcher = null;
  function watchFormDates() {
    if (_formWatcher) return;
    _formWatcher = function() {
      var s = $('#e-start') ? $('#e-start').value : '';
      var e = $('#e-end') ? $('#e-end').value : '';
      if (s && s !== _persistStart) {
        _persistStart = s; _persistEnd = e || s;
        persistHighlight();
      }
    };
    if ($('#e-start')) $('#e-start').addEventListener('change', _formWatcher);
    if ($('#e-end')) $('#e-end').addEventListener('change', _formWatcher);
  }

  function highlightDragRange(from, to) {
    if (!from || !to) return;
    var a = from, b = to;
    if (b < a) { var t = a; a = b; b = t; }
    clearDragHighlight();
    var cells = document.querySelectorAll('[data-date]');
    for (var i = 0; i < cells.length; i++) {
      var d = cells[i].getAttribute('data-date');
      if (d >= a && d <= b) cells[i].classList.add('drag-highlight');
    }
  }

  function clearDragHighlight() {
    var cells = document.querySelectorAll('.drag-highlight');
    for (var i = 0; i < cells.length; i++) cells[i].classList.remove('drag-highlight');
  }


  /* ---------- Init ---------- */
  function init() {
    populateSelects();
    // Apply URL query parameters (API-like endpoint)
    applyQueryParams();
    syncInputsFromState();
    bind();
    linkDateFields();
    // If view-only mode, hide controls
    if (isViewOnly()) enterViewOnly();
    // If embed mode, strip everything but the calendar
    if (getParam('embed') === '1') enterEmbedMode();
    initPreviewClick();
    renderNow();
    // Auto-download if ?auto=1 is set
    if (getParam('auto') === '1') {
      setTimeout(() => {
        try {
          // Validate critical params before proceeding
          state.year = clampInt(state.year, 1, 9999, new Date().getUTCFullYear());
          state.months = clampInt(state.months, 1, 36, 10);
          state.startMonth = clampInt(state.startMonth, 0, 11, 8);
          
          const fmt = getParam('format') || 'svg';
          if (fmt === 'json') {
            // Output raw config as JSON
            downloadBlob(
              new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }),
              safeName() + '.json'
            );
            return;
          }
          if (['svg','png','jpg','jpeg'].indexOf(fmt) === -1) {
            document.body.innerHTML = '<pre>Error: invalid format "' + esc(fmt) + '". Use svg, png, jpg, or json.</pre>';
            return;
          }
          $('#x-format').value = fmt;
          $('#x-format').dispatchEvent(new Event('change', { bubbles: true }));
          
          if (getParam('scale')) {
            const sv = getParam('scale');
            // Accept page presets or numeric values
            const validScales = ['1','2','3','4','a4','letter','tabloid','custom'];
            if (validScales.indexOf(sv) !== -1 || !isNaN(parseFloat(sv))) {
              $('#x-scale').value = sv;
              $('#x-scale').dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
          flush();
          doExport();
        } catch (e) {
          document.body.innerHTML = '<pre>Error generating calendar: ' + esc(e.message) + '</pre>';
        }
      }, 500);
    }
  }

  // Parse ?year=2026&months=10&title=... and apply to state
  function applyQueryParams() {
    const p = getParam;
    if (p('year'))       state.year = clampInt(p('year'), 1, 9999, state.year);
    if (p('months'))     state.months = clampInt(p('months'), 1, 36, state.months);
    if (p('start'))      state.startMonth = clampInt(p('start'), 0, 11, 0);
    if (p('title'))      state.title = decodeURIComponent(p('title'));
    if (p('subtitle'))   state.subtitle = decodeURIComponent(p('subtitle'));
    if (p('notes'))      state.notes = decodeURIComponent(p('notes'));
    if (p('language')) { const l=p('language'); if (LOCALES[l]) state.language = l; }
    if (p('theme'))      { const t = p('theme'); if (THEMES[t]) state.theme = t; }
    if (p('weekstart'))  state.weekStart = p('weekstart') === '1' ? 1 : 0;
    if (p('weekend'))    state.shadeWeekend = p('weekend') !== '0';
    if (p('columns'))    state.columns = p('columns');
    if (p('fontscale'))  { const fs = parseFloat(p('fontscale')); if (fs > 0 && fs <= 2) state.fontScale = fs; }
    if (p('borders'))    state.showBorders = p('borders') !== '0';
    if (p('watermark'))  state.showWatermark = p('watermark') === '1';
    if (p('weeknums')) state.showWeekNumbers = p('weeknums') === '1';
    if (p('terms')) state.termLabels = p('terms').split(';').map(function(s){return s.trim()}).filter(Boolean);
    if (p('today'))      state.highlightToday = p('today') === '1';
    if (p('labels'))     state.showLabels = p('labels') === '1';
    if (p('trailing'))   state.trailingDays = p('trailing') === '1';
    if (p('dayalign'))   { const a = p('dayalign'); if (['start','middle','end'].indexOf(a) !== -1) state.dayAlign = a; }
    if (p('view'))       {}
    if (p('cfg')) {
      try {
        const json = decodeURIComponent(escape(atob(p('cfg'))));
        const s = JSON.parse(json);
        if (s.categories && Array.isArray(s.categories)) state.categories = s.categories;
        if (s.events && Array.isArray(s.events)) state.events = s.events;
        if (s.notes != null) state.notes = s.notes;
      } catch (e) {}
    }
  }

  function validateConfig(s) {
    const errors = [];
    if (!s || typeof s !== 'object') { errors.push('config must be an object'); return errors; }
    if (s.year != null && (isNaN(s.year) || s.year < 1 || s.year > 9999)) errors.push('year must be 1-9999');
    if (s.months != null && (isNaN(s.months) || s.months < 1 || s.months > 36)) errors.push('months must be 1-36');
    if (s.startMonth != null && (isNaN(s.startMonth) || s.startMonth < 0 || s.startMonth > 11)) errors.push('start must be 0-11');
    if (s.theme && !THEMES[s.theme]) errors.push('unknown theme: ' + s.theme);
    if (s.fontScale != null && (isNaN(s.fontScale) || s.fontScale <= 0 || s.fontScale > 2)) errors.push('fontScale must be >0 and <=2');
    if (s.events && !Array.isArray(s.events)) errors.push('events must be an array');
    if (s.categories && !Array.isArray(s.categories)) errors.push('categories must be an array');
    return errors;
  }

  function getParam(name) {
    const url = new URL(location.href);
    return url.searchParams.get(name);
  }

  function isViewOnly() {
    return getParam('view') === '1';
  }

  function isEmbed() {
    return getParam('embed') === '1';
  }

  function enterEmbedMode() {
    // Hide everything except the calendar preview
    const panel = document.querySelector('.panel');
    const nav = document.querySelector('#navbar');
    const bar = document.querySelector('.preview-bar');
    if (panel) panel.style.display = 'none';
    if (nav) nav.style.display = 'none';
    if (bar) bar.style.display = 'none';
    // Full viewport
    const preview = document.querySelector('.preview');
    const stage = document.querySelector('.preview-stage');
    if (preview) { preview.style.height = '100vh'; preview.style.position = 'static'; }
    if (stage) stage.style.padding = '0';
    // Force interactive HTML view for embeds (richer UX)
    state.interactiveView = true;
    // Remove body margin/padding
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    // Remove the main grid layout
    const app = document.querySelector('.app');
    if (app) { app.style.display = 'block'; app.style.paddingTop = '0'; }
  }

  function enterViewOnly() {
    const panel = document.querySelector('.panel');
    const preview = document.querySelector('.preview');
    const nav = document.querySelector('#navbar');
    if (panel) panel.style.display = 'none';
    if (nav) nav.style.display = 'none';
    if (preview) preview.style.height = '100vh';
    // Show a small overlay button to exit
    const exitBtn = document.createElement('button');
    exitBtn.id = 'exit-view-btn';
    exitBtn.textContent = 'Edit';
    exitBtn.style.cssText = 'position:fixed;top:12px;right:16px;z-index:9999;background:var(--text-primary);color:var(--bg-primary);border:none;padding:6px 14px;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:var(--font);';
    exitBtn.addEventListener('click', () => {
      document.querySelector('.panel').style.display = '';
      document.querySelector('#navbar').style.display = '';
      document.querySelector('.preview').style.height = '';
      exitBtn.remove();
      // Clean URL
      const u = new URL(location.href);
      u.searchParams.delete('view');
      history.replaceState(null, '', u.toString());
    });
    document.body.appendChild(exitBtn);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
