/* ============================================================
   Weekly-parsha lectures poster — app logic
   State model -> live poster render -> PNG export (html2canvas)
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'parshaboard.v1';
  var W = 1000, H = 1440;          // natural poster size (must match css/parsha.css)

  var DAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

  var PALETTE_ROLES = [
    { key: '--p-bg', label: 'רקע' },
    { key: '--p-primary', label: 'צבע ראשי' },
    { key: '--p-accent', label: 'צבע הדגשה' }
  ];

  var THEMES = [
    { id: 'navy-gold',     name: 'כחול וזהב',     vars: { '--p-bg': '#fbf5e8', '--p-primary': '#14295a', '--p-accent': '#b8893a' } },
    { id: 'royal-gold',    name: 'כחול מלכותי',   vars: { '--p-bg': '#f4f6fb', '--p-primary': '#1f3f99', '--p-accent': '#c29a50' } },
    { id: 'burgundy-gold', name: 'בורדו וזהב',    vars: { '--p-bg': '#fbf3ea', '--p-primary': '#5e1a2c', '--p-accent': '#b8893a' } },
    { id: 'green-gold',    name: 'ירוק וזהב',     vars: { '--p-bg': '#f7f4e8', '--p-primary': '#173f30', '--p-accent': '#b38a3a' } },
    { id: 'black-gold',    name: 'שחור וזהב',     vars: { '--p-bg': '#faf6ee', '--p-primary': '#1e1e22', '--p-accent': '#b38b40' } },
    { id: 'purple-gold',   name: 'סגול וזהב',     vars: { '--p-bg': '#f8f3f6', '--p-primary': '#3b1f5e', '--p-accent': '#b8893a' } },
    { id: 'teal-copper',   name: 'טורקיז ונחושת', vars: { '--p-bg': '#f6f4ee', '--p-primary': '#0f4a52', '--p-accent': '#b06c3c' } },
    { id: 'blue-silver',   name: 'כחול וכסף',     vars: { '--p-bg': '#f5f7fa', '--p-primary': '#1b3a73', '--p-accent': '#7d8a9c' } },
    { id: 'white-navy',    name: 'לבן · כחול',    vars: { '--p-bg': '#ffffff', '--p-primary': '#14295a', '--p-accent': '#c09a52' } }
  ];
  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return THEMES[0];
  }

  var ICONS = [
    { id: 'synagogue', name: 'בית כנסת' },
    { id: 'candle', name: 'נר' },
    { id: 'book', name: 'ספר פתוח' },
    { id: 'scroll', name: 'ספר תורה' },
    { id: 'star', name: 'מגן דוד' },
    { id: 'none', name: 'ללא אייקון' }
  ];

  /* ---------- Color helpers ---------- */
  function hexToRgb(hex) {
    var h = (hex || '#000000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(c) {
    return '#' + c.map(function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length < 2 ? '0' + s : s;
    }).join('');
  }
  function mix(a, b, t) {
    var x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  }
  function luminance(hex) {
    var c = hexToRgb(hex).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  // Full palette used by the poster: the 3 editable roles + derived text colors.
  function paletteFor(vars) {
    var primary = vars['--p-primary'], accent = vars['--p-accent'];
    return {
      bg: vars['--p-bg'],
      primary: primary,
      accent: accent,
      onPrimary: luminance(primary) > 0.45 ? '#1c1c1c' : '#fffaf0',
      onAccent: luminance(accent) > 0.55 ? primary : '#ffffff'
    };
  }

  /* ---------- Date helpers ---------- */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toISO(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseISO(s) {
    var p = (s || '').split('-');
    return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);
  }
  function upcomingSaturday() {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7)); // days until the next Saturday (0 if today)
    return d;
  }

  /* ---------- Hebcal: parsha + the Hebrew/Gregorian date of each day of that week ---------- */
  function hebcalAvailable() {
    return typeof window.hebcal !== 'undefined' && window.hebcal.HebrewCalendar;
  }
  // Returns { parsha, days: [{ heb: 'כ״ח בתשרי תשפ״ז', greg: '9.10.26' }, … Sun..Sat] } or null.
  function computeWeek(saturdayISO) {
    if (!hebcalAvailable()) return null;
    var Hc = window.hebcal;
    var sat = parseISO(saturdayISO);

    var parsha = null;
    try {
      Hc.HebrewCalendar.calendar({ start: sat, end: sat, sedrot: true, il: true }).forEach(function (ev) {
        if (ev.getFlags() & Hc.flags.PARSHA_HASHAVUA) parsha = ev.render('he-x-NoNikud');
      });
    } catch (e) {}

    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() - (6 - i));
      var heb = '';
      try {
        var hd = new Hc.HDate(d);
        heb = Hc.gematriya(hd.getDate()) + ' ב' + Hc.Locale.gettext(hd.getMonthName(), 'he-x-NoNikud') +
          ' ' + Hc.gematriya(hd.getFullYear());
      } catch (e) {}
      days.push({ heb: heb, greg: d.getDate() + '.' + (d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(-2) });
    }
    return { parsha: parsha, days: days };
  }

  /* ---------- Default example ---------- */
  function defaultState() {
    return {
      theme: 'navy-gold',
      customTheme: null,
      shabbatDate: toISO(upcomingSaturday()),
      autoTopic: true,
      headline: 'הרצאות מאת הרב עמיהוד סלומון',
      topic: 'הנושא: פרשת בראשית',
      footer: 'ניתן להקדיש את השיעורים',
      sections: [
        {
          day: 5, style: 'stacked', title: 'יום שישי', date: 'כ״ח בתשרי תשפ״ז 9.10.26',
          events: [
            { icon: 'synagogue', title: 'בית כנסת ניגוני חיים', address: 'ויצמן 45 פתח תקווה', time: '9:00\nבבוקר' },
            { icon: 'candle', title: 'בית כנסת נצח שלמה', address: 'וולף 5 פתח תקווה', time: '10:00\nבבוקר' }
          ]
        },
        {
          day: 6, style: 'divider', title: 'שבת פרשת בראשית', date: '',
          events: [
            { icon: 'book', title: 'דרשה לאחר קריאת התורה\nבית כנסת המרכזי כפר גנים ב׳', address: 'הנשיאים 52 פינת העצמאות פ״ת', time: 'תפילת\nשחרית\n8:00' },
            { icon: 'candle', title: 'בית כנסת היכל גבריאל', address: 'יטקובסקי 34 פתח תקווה', time: '16:45' },
            { icon: 'synagogue', title: 'בית כנסת מונקאטש', address: 'הנשיאים 30 פתח תקווה', time: '18:10' }
          ]
        }
      ]
    };
  }
  function emptyEvent() { return { icon: 'synagogue', title: '', address: '', time: '' }; }

  /* ---------- State ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  var state = load() || defaultState();
  if (!Array.isArray(state.sections)) state.sections = defaultState().sections;
  state.sections.forEach(function (s) { if (!Array.isArray(s.events)) s.events = []; });
  if (state.theme === 'custom' && !state.customTheme) state.theme = 'navy-gold';
  // Auto-advance to the upcoming Shabbat; a manually-chosen FUTURE date is kept (preparing ahead).
  var upcomingISO = toISO(upcomingSaturday());
  if (!state.shabbatDate || state.shabbatDate < upcomingISO) state.shabbatDate = upcomingISO;

  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setAutosave('השינויים נשמרים אוטומטית בדפדפן זה.');
      } catch (e) {
        setAutosave('לא ניתן לשמור בדפדפן זה — השינויים לא יישמרו לביקור הבא.');
      }
    }, 250);
  }
  function setAutosave(msg) {
    var el = document.getElementById('autosaveNote');
    if (el) el.textContent = msg;
  }

  /* ---------- DOM refs ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var els = {
    themes: $('themes'),
    palette: $('paletteEditor'),
    headline: $('headline'),
    topic: $('topic'),
    autoTopic: $('autoTopic'),
    footer: $('footer'),
    sections: $('sections'),
    shabbatDate: $('shabbatDate'),
    shabbatStatus: $('shabbatStatus'),
    // poster
    poster: $('poster'),
    pBg: $('p-bg'),
    pHeadline: $('p-headline'),
    pTopicWrap: $('p-topic-wrap'),
    pTopicShape: $('p-topic-shape'),
    pTopic: $('p-topic'),
    pOrnTop: $('p-orn-top'),
    pOrnBottom: $('p-orn-bottom'),
    pContent: $('p-content'),
    pFooterWrap: $('p-footer-wrap'),
    pFooterShape: $('p-footer-shape'),
    pFooter: $('p-footer'),
    boardScale: $('boardScale'),
    boardSizer: $('boardSizer'),
    viewport: $('previewViewport')
  };

  /* ============================================================
     SVG ARTWORK (generated in the theme colors)
     ============================================================ */
  function svgUrl(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }

  function backgroundSvg(p) {
    var navyLight = mix(p.primary, '#ffffff', 0.16);
    var goldLight = mix(p.accent, '#ffffff', 0.45);
    var goldDark = mix(p.accent, '#000000', 0.18);
    // One corner sweep (top + left edge); the bottom-right is the same shape rotated 180°.
    var corner =
      '<path fill="url(#navy)" d="M0 0 H470 C320 18 190 62 118 130 C70 178 46 250 38 350 L28 1000 C24 1060 12 1110 0 1140 Z"/>' +
      '<path fill="' + navyLight + '" fill-opacity=".45" d="M0 0 H360 C240 24 140 76 86 140 C52 182 36 250 30 340 L20 900 L0 960 Z"/>' +
      '<path fill="none" stroke="url(#gold)" stroke-width="6" stroke-linecap="round" d="M510 0 C350 22 215 70 140 140 C88 190 62 262 52 360 L42 1000 C38 1065 26 1120 10 1160"/>' +
      '<path fill="none" stroke="url(#fade)" stroke-width="2" stroke-linecap="round" d="M560 0 C380 28 240 80 162 152 C108 202 80 272 70 372 L62 1000"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<defs>' +
        '<linearGradient id="navy" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="' + navyLight + '"/><stop offset=".6" stop-color="' + p.primary + '"/></linearGradient>' +
        '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="' + goldLight + '"/><stop offset=".5" stop-color="' + p.accent + '"/><stop offset="1" stop-color="' + goldDark + '"/></linearGradient>' +
        '<linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="1000">' +
          '<stop offset="0" stop-color="' + p.accent + '"/><stop offset="1" stop-color="' + p.accent + '" stop-opacity="0"/></linearGradient>' +
        '<radialGradient id="glow" cx=".5" cy=".42" r=".65">' +
          '<stop offset="0" stop-color="#ffffff" stop-opacity=".7"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>' +
        '<g id="corner">' + corner + '</g>' +
      '</defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="' + p.bg + '"/>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#glow)"/>' +
      '<rect x="16" y="16" width="968" height="1408" rx="12" fill="none" stroke="' + p.accent + '" stroke-opacity=".55" stroke-width="2"/>' +
      '<rect x="25" y="25" width="950" height="1390" rx="8" fill="none" stroke="' + p.accent + '" stroke-opacity=".3" stroke-width="1"/>' +
      '<use href="#corner"/>' +
      '<use href="#corner" transform="rotate(180 ' + (W / 2) + ' ' + (H / 2) + ')"/>' +
      '</svg>';
  }

  // Banner with pointed ends, gold outline and an inner gold hairline.
  function ribbonSvg(w, h, p) {
    var t = Math.round(h * 0.42);
    var outer = 'M' + t + ' 2 H' + (w - t) + ' L' + (w - 2) + ' ' + h / 2 + ' L' + (w - t) + ' ' + (h - 2) +
      ' H' + t + ' L2 ' + h / 2 + ' Z';
    var inner = 'M' + (t + 4) + ' 8 H' + (w - t - 4) + ' L' + (w - 11) + ' ' + h / 2 + ' L' + (w - t - 4) + ' ' + (h - 8) +
      ' H' + (t + 4) + ' L11 ' + h / 2 + ' Z';
    var shade = mix(p.primary, '#ffffff', 0.14);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<defs><linearGradient id="r" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + shade + '"/><stop offset="1" stop-color="' + p.primary + '"/></linearGradient></defs>' +
      '<path d="' + outer + '" fill="url(#r)" stroke="' + p.accent + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="' + inner + '" fill="none" stroke="' + p.accent + '" stroke-width="1.4" stroke-opacity=".85" stroke-linejoin="round"/>' +
      '<circle cx="' + (t * 0.62) + '" cy="' + h / 2 + '" r="3" fill="' + p.accent + '"/>' +
      '<circle cx="' + (w - t * 0.62) + '" cy="' + h / 2 + '" r="3" fill="' + p.accent + '"/>' +
      '</svg>';
  }

  // Thin gold flourish: fading lines, two loops and a center diamond.
  function ornamentSvg(p) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="28" viewBox="0 0 400 28">' +
      '<defs><linearGradient id="l" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="400" y2="0">' +
        '<stop offset="0" stop-color="' + p.accent + '" stop-opacity="0"/><stop offset=".3" stop-color="' + p.accent + '"/>' +
        '<stop offset=".7" stop-color="' + p.accent + '"/><stop offset="1" stop-color="' + p.accent + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="M10 14 H150 M250 14 H390" stroke="url(#l)" stroke-width="1.6"/>' +
      '<path d="M190 14 C178 3 162 3 156 14 C162 25 178 25 190 14 Z M210 14 C222 3 238 3 244 14 C238 25 222 25 210 14 Z" fill="none" stroke="' + p.accent + '" stroke-width="1.8"/>' +
      '<path d="M200 5 L209 14 L200 23 L191 14 Z" fill="' + p.accent + '"/>' +
      '<circle cx="150" cy="14" r="2.6" fill="' + p.accent + '"/><circle cx="250" cy="14" r="2.6" fill="' + p.accent + '"/>' +
      '</svg>';
  }

  // Line icons on a 64×64 grid, drawn in the given color.
  function iconSvg(id, color) {
    var body = {
      synagogue:
        '<path d="M8 54 H56"/>' +
        '<path d="M22 54 V24 L32 12 L42 24 V54"/><path d="M32 12 V7"/>' +
        '<path d="M32 23.5 L37.2 32.5 H26.8 Z M32 35.5 L26.8 26.5 H37.2 Z"/>' +
        '<path d="M28 54 V46 A4 4 0 0 1 36 46 V54"/>' +
        '<path d="M22 32 L12 37 V54 M42 32 L52 37 V54"/>' +
        '<path d="M15 50 V44 A2 2 0 0 1 19 44 V50 Z M45 50 V44 A2 2 0 0 1 49 44 V50 Z"/>',
      candle:
        '<path d="M32 8 C36 17 45 25 45 36 A13 13 0 0 1 19 36 C19 25 28 17 32 8 Z"/>' +
        '<path d="M32 27 C34 31 37.5 34 37.5 38 A5.5 5.5 0 0 1 26.5 38 C26.5 34 30 31 32 27 Z"/>' +
        '<path d="M15 54 Q32 62 49 54"/>',
      book:
        '<path d="M32 24 C26 20 17 19 8 21 V48 C17 46 26 47 32 51 Z"/>' +
        '<path d="M32 24 C38 20 47 19 56 21 V48 C47 46 38 47 32 51 Z"/>' +
        '<path d="M32 8 V14 M21 11 L24 16 M43 11 L40 16"/>',
      scroll:
        '<path d="M17 12 V52 M47 12 V52"/>' +
        '<path d="M14 12 H20 M14 52 H20 M44 12 H50 M44 52 H50"/>' +
        '<path d="M21 17 H43 V47 H21 Z"/>' +
        '<path d="M26 25 H38 M26 31 H38 M26 37 H34"/>',
      star:
        '<path d="M32 12 L50.2 43.5 H13.8 Z"/><path d="M32 54 L13.8 22.5 H50.2 Z"/>'
    }[id];
    if (!body) return null;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64" fill="none" stroke="' +
      color + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }

  /* ============================================================
     THEME
     ============================================================ */
  function effectiveVars(id) {
    if (id === 'custom' && state.customTheme) return state.customTheme;
    return themeById(id).vars;
  }
  var art = { icons: {} };          // theme-colored image URLs, rebuilt on theme change
  function applyTheme(id) {
    var p = paletteFor(effectiveVars(id));
    var s = els.poster.style;
    s.setProperty('--p-bg', p.bg);
    s.setProperty('--p-primary', p.primary);
    s.setProperty('--p-accent', p.accent);
    s.setProperty('--p-accent-0', 'rgba(' + hexToRgb(p.accent).join(',') + ',0)');
    s.setProperty('--p-on-primary', p.onPrimary);
    s.setProperty('--p-on-accent', p.onAccent);
    els.pBg.src = svgUrl(backgroundSvg(p));
    els.pTopicShape.src = svgUrl(ribbonSvg(840, 86, p));
    els.pFooterShape.src = svgUrl(ribbonSvg(660, 76, p));
    els.pOrnTop.src = els.pOrnBottom.src = svgUrl(ornamentSvg(p));
    art.icons = {};
    ICONS.forEach(function (ic) {
      var svg = iconSvg(ic.id, p.onPrimary);
      if (svg) art.icons[ic.id] = svgUrl(svg);
    });
  }
  function swatchButton(id, name, vars) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-swatch' + (state.theme === id ? ' is-active' : '');
    b.title = name;
    b.innerHTML =
      '<div class="theme-swatch__preview" style="background:' + vars['--p-bg'] + '">' +
        '<div class="theme-swatch__stack">' +
          '<span class="theme-swatch__bar" style="background:' + vars['--p-primary'] + ';border:2px solid ' + vars['--p-accent'] + '"></span>' +
          '<span class="theme-swatch__bar theme-swatch__bar--sm" style="background:' + vars['--p-accent'] + '"></span>' +
        '</div>' +
      '</div>' +
      '<div class="theme-swatch__name">' + name + '</div>';
    b.addEventListener('click', function () {
      state.theme = id;
      applyTheme(id);
      renderThemes();
      renderPalette();
      renderPoster();
      save();
    });
    return b;
  }
  function renderThemes() {
    els.themes.innerHTML = '';
    if (state.customTheme) els.themes.appendChild(swatchButton('custom', 'מותאם אישית', state.customTheme));
    THEMES.forEach(function (t) { els.themes.appendChild(swatchButton(t.id, t.name, t.vars)); });
  }
  function renderPalette() {
    var vars = effectiveVars(state.theme);
    els.palette.innerHTML = '';
    PALETTE_ROLES.forEach(function (role) {
      var wrap = document.createElement('label');
      wrap.className = 'palette-field';
      var span = document.createElement('span');
      span.textContent = role.label;
      var input = document.createElement('input');
      input.type = 'color';
      input.value = vars[role.key] || '#000000';
      input.addEventListener('input', function () {
        if (!state.customTheme) state.customTheme = JSON.parse(JSON.stringify(effectiveVars(state.theme)));
        state.customTheme[role.key] = input.value;
        state.theme = 'custom';
        applyTheme('custom');
        renderThemes();
        renderPoster();
        save();
      });
      wrap.appendChild(span);
      wrap.appendChild(input);
      els.palette.appendChild(wrap);
    });
  }

  /* ============================================================
     POSTER RENDER
     ============================================================ */
  // Text with "\n" line breaks as text nodes + <br> (more reliable in html2canvas than pre-line).
  function setLines(el, text) {
    el.innerHTML = '';
    String(text || '').split('\n').forEach(function (line, i) {
      if (i) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(line));
    });
  }
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function sectionHead(sec) {
    if (sec.style === 'divider') {
      // From the title outward on each side: hollow diamond, solid diamond, fading line.
      // Flex children run right-to-left here, so the right-hand line is built outer-first.
      var line = function (side) {
        var l = el('div', 'psec__line psec__line--' + side);
        var parts = [el('span', 'psec__diamond psec__diamond--hollow'), el('span', 'psec__diamond'), el('span', 'psec__line-bar')];
        if (side === 'right') parts.reverse();
        parts.forEach(function (p) { l.appendChild(p); });
        return l;
      };
      var head = el('div', 'psec__head psec__head--divider');
      var t = el('h2', 'psec__title');
      t.textContent = sec.title || '';
      head.appendChild(line('right'));
      head.appendChild(t);
      head.appendChild(line('left'));
      return head;
    }
    var stacked = el('div', 'psec__head psec__head--stacked');
    var title = el('h2', 'psec__title');
    title.textContent = sec.title || '';
    stacked.appendChild(title);
    if ((sec.date || '').trim()) {
      var date = el('p', 'psec__date');
      date.textContent = sec.date;
      stacked.appendChild(date);
    }
    return stacked;
  }

  function eventCard(ev) {
    var card = el('div', 'pcard');
    if (ev.icon && ev.icon !== 'none' && art.icons[ev.icon]) {
      var tile = el('div', 'pcard__icon');
      var img = el('img');
      img.alt = '';
      img.src = art.icons[ev.icon];
      tile.appendChild(img);
      card.appendChild(tile);
    }
    var body = el('div', 'pcard__body');
    var title = el('p', 'pcard__title');
    setLines(title, ev.title);
    body.appendChild(title);
    if ((ev.address || '').trim()) {
      var addr = el('p', 'pcard__addr');
      setLines(addr, ev.address);
      body.appendChild(addr);
    }
    card.appendChild(body);
    if ((ev.time || '').trim()) {
      var time = el('div', 'pcard__time');
      var tt = el('span', 'pcard__time-text');
      setLines(tt, ev.time.trim());
      time.appendChild(tt);
      card.appendChild(time);
    }
    return card;
  }

  function renderPoster() {
    els.pHeadline.textContent = state.headline || '';
    els.pTopic.textContent = state.topic || '';
    els.pTopicWrap.style.visibility = (state.topic || '').trim() ? '' : 'hidden';
    els.pFooter.textContent = state.footer || '';
    var hasFooter = (state.footer || '').trim() !== '';
    els.pFooterWrap.style.display = hasFooter ? '' : 'none';

    var stack = el('div', 'poster__stack');
    state.sections.forEach(function (sec) {
      var s = el('section', 'psec');
      if ((sec.title || '').trim() || (sec.date || '').trim()) s.appendChild(sectionHead(sec));
      (sec.events || []).forEach(function (ev) { s.appendChild(eventCard(ev)); });
      stack.appendChild(s);
    });
    els.pContent.innerHTML = '';
    els.pContent.appendChild(stack);

    fitLine(els.pHeadline, 650, 60, 30);
    fitLine(els.pTopic, 840 - 2 * 64, 44, 22);
    fitLine(els.pFooter, 660 - 2 * 58, 38, 20);
    fitContent();
  }

  /* Shrink a single-line element's font until it is no wider than maxWidth. */
  function fitLine(node, maxWidth, maxSize, minSize) {
    var size = maxSize;
    node.style.fontSize = size + 'px';
    while (size > minSize && node.scrollWidth > maxWidth) {
      size -= 1;
      node.style.fontSize = size + 'px';
    }
  }

  /* Lower --fit (all card/section sizes are em-based off it) until the stack fits the content area. */
  function fitContent() {
    var area = els.pContent;
    var stack = area.firstChild;
    if (!stack) return;
    var fit = 1;
    stack.style.setProperty('--fit', '1');
    while (fit > 0.45 && stack.offsetHeight > area.clientHeight) {
      fit -= 0.03;
      stack.style.setProperty('--fit', fit.toFixed(2));
    }
  }

  /* ============================================================
     FORM RENDER + BINDING
     ============================================================ */
  function select(options, value, onChange) {
    var s = el('select', 'mini-select');
    options.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      s.appendChild(opt);
    });
    s.value = value;
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }
  function iconButton(text, title, onClick, opts) {
    var b = el('button', 'icon-btn' + (opts && opts.danger ? ' icon-btn--danger' : ''));
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.textContent = text;
    if (opts && opts.disabled) b.disabled = true;
    b.addEventListener('click', onClick);
    return b;
  }
  function textInput(value, placeholder, onInput, multiline) {
    var i = el(multiline ? 'textarea' : 'input');
    if (!multiline) i.type = 'text';
    else i.rows = 2;
    i.value = value || '';
    i.placeholder = placeholder;
    i.addEventListener('input', function () { onInput(i.value); renderPoster(); save(); });
    return i;
  }
  function move(arr, from, to) {
    if (to < 0 || to >= arr.length) return;
    var item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
  }
  function structuralChange() { renderSectionsForm(); renderPoster(); save(); }

  var DAY_OPTIONS = [{ value: '', label: 'כותרת ידנית' }].concat(DAY_NAMES.map(function (n, i) {
    return { value: String(i), label: n + ' (אוטומטי)' };
  }));
  var STYLE_OPTIONS = [
    { value: 'stacked', label: 'כותרת + תאריך' },
    { value: 'divider', label: 'כותרת בין קווים' }
  ];

  function renderSectionsForm() {
    els.sections.innerHTML = '';
    state.sections.forEach(function (sec, si) {
      var wrap = el('div', 'sec-editor');

      var head = el('div', 'sec-editor__head');
      var pos = el('span', 'box-editor__pos');
      pos.textContent = 'יום ' + (si + 1);
      head.appendChild(pos);
      head.appendChild(select(DAY_OPTIONS, sec.day === '' || sec.day == null ? '' : String(sec.day), function (v) {
        sec.day = v === '' ? '' : +v;
        if (sec.day !== '') { applyShabbat(); return; }
        structuralChange();
      }));
      head.appendChild(select(STYLE_OPTIONS, sec.style || 'stacked', function (v) {
        sec.style = v; structuralChange();
      }));
      head.appendChild(iconButton('↑', 'הזז למעלה', function () { move(state.sections, si, si - 1); structuralChange(); }, { disabled: si === 0 }));
      head.appendChild(iconButton('↓', 'הזז למטה', function () { move(state.sections, si, si + 1); structuralChange(); }, { disabled: si === state.sections.length - 1 }));
      head.appendChild(iconButton('🗑', 'הסר יום', function () {
        if (!confirm('להסיר את "' + (sec.title || 'יום ללא כותרת') + '" ואת כל השיעורים בו?')) return;
        state.sections.splice(si, 1);
        structuralChange();
      }, { danger: true }));
      wrap.appendChild(head);

      var fields = el('div', 'sec-editor__fields');
      fields.appendChild(textInput(sec.title, 'כותרת היום (למשל: יום שישי)', function (v) { sec.title = v; }));
      if ((sec.style || 'stacked') === 'stacked') {
        fields.appendChild(textInput(sec.date, 'תאריך (למשל: כ״ח בתשרי תשפ״ז 9.10.26)', function (v) { sec.date = v; }));
      }
      if (sec.day !== '' && sec.day != null) {
        var note = el('p', 'sec-editor__auto-note');
        note.textContent = 'הכותרת' + ((sec.style || 'stacked') === 'stacked' ? ' והתאריך מתעדכנים' : ' מתעדכנת') +
          ' אוטומטית לפי השבת שנבחרה.';
        fields.appendChild(note);
      }
      wrap.appendChild(fields);

      var list = el('div', 'events');
      (sec.events || []).forEach(function (ev, ei) { list.appendChild(eventEditor(sec, ev, ei)); });
      wrap.appendChild(list);

      var add = el('button', 'row-add');
      add.type = 'button';
      add.textContent = '＋ הוסף שיעור';
      add.addEventListener('click', function () { sec.events.push(emptyEvent()); structuralChange(); });
      wrap.appendChild(add);

      els.sections.appendChild(wrap);
    });
  }

  function eventEditor(sec, ev, ei) {
    var box = el('div', 'event-editor');

    var bar = el('div', 'event-editor__bar');
    var pos = el('span', 'event-editor__pos');
    pos.textContent = 'שיעור ' + (ei + 1);
    bar.appendChild(pos);
    bar.appendChild(select(ICONS.map(function (ic) { return { value: ic.id, label: 'אייקון: ' + ic.name }; }), ev.icon || 'synagogue', function (v) {
      ev.icon = v; renderPoster(); save();
    }));
    bar.appendChild(iconButton('↑', 'הזז למעלה', function () { move(sec.events, ei, ei - 1); structuralChange(); }, { disabled: ei === 0 }));
    bar.appendChild(iconButton('↓', 'הזז למטה', function () { move(sec.events, ei, ei + 1); structuralChange(); }, { disabled: ei === sec.events.length - 1 }));
    bar.appendChild(iconButton('×', 'הסר שיעור', function () { sec.events.splice(ei, 1); structuralChange(); }, { danger: true }));
    box.appendChild(bar);

    var timeWrap = el('div', 'event-editor__time');
    timeWrap.appendChild(textInput(ev.time, 'שעה\n(למשל 9:00)', function (v) { ev.time = v; }, true));
    box.appendChild(timeWrap);

    var text = el('div', 'event-editor__text');
    text.appendChild(textInput(ev.title, 'מקום / נושא (Enter לשורה נוספת)', function (v) { ev.title = v; }, true));
    text.appendChild(textInput(ev.address, 'כתובת (בצבע ההדגשה)', function (v) { ev.address = v; }));
    box.appendChild(text);
    return box;
  }

  function syncFormFromState() {
    els.headline.value = state.headline || '';
    els.topic.value = state.topic || '';
    els.autoTopic.checked = state.autoTopic !== false;
    els.footer.value = state.footer || '';
    els.shabbatDate.value = state.shabbatDate || '';
    renderThemes();
    renderPalette();
    applyTheme(state.theme);
    renderSectionsForm();
  }

  /* ============================================================
     SHABBAT (Hebcal) — topic + auto day titles/dates
     ============================================================ */
  function applyShabbat() {
    var res = computeWeek(state.shabbatDate);
    if (!res) {
      els.shabbatStatus.textContent = 'ספריית Hebcal לא נטענה — ניתן להזין את הפרשה והתאריכים ידנית.';
      syncFormFromState(); renderPoster(); save();
      return;
    }
    if (res.parsha && state.autoTopic !== false) state.topic = 'הנושא: ' + res.parsha;
    state.sections.forEach(function (sec) {
      if (sec.day === '' || sec.day == null) return;
      var d = res.days[sec.day];
      sec.title = sec.day === 6 ? 'שבת ' + (res.parsha || 'קודש') : DAY_NAMES[sec.day];
      sec.date = (d.heb ? d.heb + ' ' : '') + d.greg;
    });
    syncFormFromState();
    renderPoster();
    save();
    els.shabbatStatus.textContent = '✓ ' + (res.parsha || 'ללא פרשה קבועה (שבת חג)') +
      ' · שבת ' + res.days[6].heb + ' (' + res.days[6].greg + ')';
  }

  /* ============================================================
     PREVIEW SCALING
     ============================================================ */
  function fitPreview() {
    var vp = els.viewport;
    var byWidth = (vp.clientWidth - 48) / W;
    var byHeight = (vp.clientHeight - 48) / H;
    // Fit the whole portrait poster on screen; on short (stacked mobile) viewports fall back to width.
    var s = Math.min(byWidth, vp.clientHeight > 320 ? byHeight : byWidth, 1);
    if (s <= 0) s = 0.1;
    els.boardScale.style.transform = 'scale(' + s + ')';
    els.boardSizer.style.width = (W * s) + 'px';
    els.boardSizer.style.height = (H * s) + 'px';
  }

  /* ============================================================
     EXPORT PNG
     ============================================================ */
  function download() {
    var btn = $('btn-download');
    var spinner = btn.querySelector('.btn__spinner');
    var label = btn.querySelector('.btn__label');
    btn.disabled = true;
    spinner.hidden = false;
    label.textContent = 'מייצר תמונה…';

    var prevTransform = els.boardScale.style.transform;
    var prevSizerW = els.boardSizer.style.width;
    var prevSizerH = els.boardSizer.style.height;
    els.boardScale.style.transform = 'none';
    els.boardSizer.style.width = W + 'px';
    els.boardSizer.style.height = H + 'px';

    var restore = function () {
      els.boardScale.style.transform = prevTransform;
      els.boardSizer.style.width = prevSizerW;
      els.boardSizer.style.height = prevSizerH;
      btn.disabled = false;
      spinner.hidden = true;
      label.textContent = '⬇ הורדת תמונה (PNG)';
    };

    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
      .then(function () {
        return html2canvas(els.poster, {
          backgroundColor: effectiveVars(state.theme)['--p-bg'],
          scale: 2,
          width: W,
          height: H,
          windowWidth: W,
          windowHeight: H,
          useCORS: true,
          logging: false
        });
      })
      .then(function (canvas) {
        canvas.toBlob(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          var name = (state.topic || state.headline || 'שיעורי-פרשה').replace(/^הנושא:\s*/, '').replace(/[\s:\/\\]+/g, '-');
          a.href = url;
          a.download = 'שיעורים-' + name + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          restore();
        }, 'image/png');
      })
      .catch(function (err) {
        console.error(err);
        alert('אירעה שגיאה בעת יצירת התמונה. נסו שוב.');
        restore();
      });
  }

  /* ============================================================
     WIRE UP
     ============================================================ */
  function bindStaticFields() {
    els.headline.addEventListener('input', function () { state.headline = els.headline.value; renderPoster(); save(); });
    els.topic.addEventListener('input', function () { state.topic = els.topic.value; renderPoster(); save(); });
    els.footer.addEventListener('input', function () { state.footer = els.footer.value; renderPoster(); save(); });
    els.autoTopic.addEventListener('change', function () {
      state.autoTopic = els.autoTopic.checked;
      if (state.autoTopic) applyShabbat(); else save();
    });

    els.shabbatDate.addEventListener('change', function () {
      state.shabbatDate = els.shabbatDate.value || state.shabbatDate;
      applyShabbat();
    });
    $('btnUpcoming').addEventListener('click', function () {
      state.shabbatDate = toISO(upcomingSaturday());
      applyShabbat();
    });
    $('btnRecalc').addEventListener('click', applyShabbat);

    $('btnAddSection').addEventListener('click', function () {
      state.sections.push({ day: '', style: 'divider', title: '', date: '', events: [emptyEvent()] });
      structuralChange();
    });

    $('btn-download').addEventListener('click', download);
    $('btn-example').addEventListener('click', function () {
      if (!confirm('לטעון את תוכן הדוגמה? הפעולה תחליף את מה שממולא כעת.')) return;
      var keepTheme = state.theme, keepCustom = state.customTheme;
      state = defaultState();
      state.theme = keepTheme;
      state.customTheme = keepCustom;
      applyShabbat();
    });
    $('btn-clear').addEventListener('click', function () {
      if (!confirm('לנקות את כל השדות?')) return;
      state = {
        theme: state.theme,
        customTheme: state.customTheme || null,
        shabbatDate: toISO(upcomingSaturday()),
        autoTopic: true,
        headline: '', topic: '', footer: '',
        sections: [{ day: '', style: 'stacked', title: '', date: '', events: [emptyEvent()] }]
      };
      syncFormFromState(); renderPoster(); save();
    });
  }

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    bindStaticFields();
    syncFormFromState();
    renderPoster();
    fitPreview();
    window.addEventListener('resize', fitPreview);
    if (window.ResizeObserver) new ResizeObserver(fitPreview).observe(els.viewport);
    // Final glyph metrics change measured sizes once the web fonts load.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderPoster);
    // Recompute the parsha + auto day titles/dates for the (auto-advanced) date on every open.
    applyShabbat();
  });
})();
