/* ============================================================
   Synagogue notice-board generator — app logic
   State model -> live board render -> PNG export (html2canvas)
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'synaboard.v2';

  // Position labels for the four boxes (visual placement in the main area)
  var BOX_POS = ['עליון · ימין', 'עליון · שמאל', 'תחתון · ימין', 'תחתון · שמאל'];

  /* ---------- Theme presets (each overrides the board's CSS variables) ---------- */
  var THEMES = [
    { id: 'classic',  name: 'קלאסי',       vars: { '--board-bg': '#eeecdd', '--teal': '#4f86a3', '--teal-soft': '#6d9cb2', '--board-ink': '#1c1c1c', '--board-line': '#a9c2bf', '--board-img-bg': '#dcdccf' } },
    { id: 'night',    name: 'לילה',        vars: { '--board-bg': '#1e2733', '--teal': '#7fb4c9', '--teal-soft': '#9fb8c4', '--board-ink': '#eef2f5', '--board-line': '#3c4a57', '--board-img-bg': '#2a3542' } },
    { id: 'gold',     name: 'זהב מלכותי',  vars: { '--board-bg': '#faf6ec', '--teal': '#b08d57', '--teal-soft': '#c2a06b', '--board-ink': '#2a2620', '--board-line': '#ddc9a0', '--board-img-bg': '#e6dcc4' } },
    { id: 'azure',    name: 'תכלת',        vars: { '--board-bg': '#f5f8fb', '--teal': '#2f6fb0', '--teal-soft': '#5c93cc', '--board-ink': '#1b2430', '--board-line': '#bcd2e8', '--board-img-bg': '#dce6f0' } },
    { id: 'olive',    name: 'זית',         vars: { '--board-bg': '#f0efe4', '--teal': '#4f7a4a', '--teal-soft': '#6f9a68', '--board-ink': '#23281f', '--board-line': '#b9c9ac', '--board-img-bg': '#d8dcc6' } },
    { id: 'burgundy', name: 'בורדו',       vars: { '--board-bg': '#f4efe9', '--teal': '#8f3b46', '--teal-soft': '#ab5f68', '--board-ink': '#2b201f', '--board-line': '#d8c2ba', '--board-img-bg': '#e6d6ce' } },
    { id: 'sand',     name: 'חול מדבר',    vars: { '--board-bg': '#f3e9dc', '--teal': '#b5623b', '--teal-soft': '#c78560', '--board-ink': '#2c2119', '--board-line': '#dec4a6', '--board-img-bg': '#e7d5bf' } },
    { id: 'charcoal', name: 'פחם וזהב',    vars: { '--board-bg': '#23252b', '--teal': '#c9a24a', '--teal-soft': '#d4b76e', '--board-ink': '#edeef0', '--board-line': '#3b3e46', '--board-img-bg': '#2e3138' } },
    { id: 'plum',     name: 'סגול מלכותי', vars: { '--board-bg': '#f4f1f7', '--teal': '#6b4a86', '--teal-soft': '#8a6ba3', '--board-ink': '#241f2b', '--board-line': '#d0c4dd', '--board-img-bg': '#e2d8ec' } },
    { id: 'emerald',  name: 'אזמרגד',      vars: { '--board-bg': '#16302e', '--teal': '#7fc3a8', '--teal-soft': '#9fceb8', '--board-ink': '#eaf3ee', '--board-line': '#2f4a45', '--board-img-bg': '#22403c' } },
    { id: 'rose',     name: 'ורוד עתיק',   vars: { '--board-bg': '#f7eeee', '--teal': '#a75c6a', '--teal-soft': '#c07f8a', '--board-ink': '#2c2122', '--board-line': '#e0c6ca', '--board-img-bg': '#edd8dc' } },
    { id: 'indigo',   name: 'אינדיגו',     vars: { '--board-bg': '#eef0f6', '--teal': '#3b4b8c', '--teal-soft': '#6570ab', '--board-ink': '#1e2130', '--board-line': '#c3c9de', '--board-img-bg': '#d9deec' } }
  ];
  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return THEMES[0];
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

  /* ---------- Hebcal (parsha + Shabbat times) ---------- */
  function hebcalAvailable() {
    return typeof window.hebcal !== 'undefined' && window.hebcal.HebrewCalendar;
  }
  // Returns { parsha, jerusalem, telaviv, havdalah } for the Shabbat on saturdayISO, or null.
  function computeShabbat(saturdayISO) {
    if (!hebcalAvailable()) return null;
    var H = window.hebcal;
    var sat = parseISO(saturdayISO);
    var fri = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() - 1);

    function cityTimes(name, mins) {
      var loc;
      try { loc = H.Location.lookup(name); } catch (e) { loc = null; }
      if (!loc) return {};
      loc.candleLightingMins = mins;
      var out = {};
      try {
        var evs = H.HebrewCalendar.calendar({ start: fri, end: sat, location: loc, candlelighting: true, il: true });
        evs.forEach(function (ev) {
          var d = ev.getDesc();
          if (d === 'Candle lighting') out.candle = ev.fmtTime;
          else if (d === 'Havdalah') out.havdalah = ev.fmtTime;
        });
      } catch (e) {}
      return out;
    }

    var jer = cityTimes('Jerusalem', 40);
    var tlv = cityTimes('Tel Aviv', 18);

    var parsha = null;
    try {
      var sed = H.HebrewCalendar.calendar({ start: sat, end: sat, sedrot: true, il: true });
      sed.forEach(function (ev) {
        if (ev.getFlags() & H.flags.PARSHA_HASHAVUA) parsha = ev.render('he-x-NoNikud');
      });
    } catch (e) {}

    return {
      parsha: parsha,
      jerusalem: jer.candle || '',
      telaviv: tlv.candle || '',
      havdalah: tlv.havdalah || jer.havdalah || ''
    };
  }

  /* ---------- Default example ---------- */
  function defaultState() {
    return {
      theme: 'classic',
      mainHeadline: 'בית כנסת כפר גנים ב',
      subHeadline: 'פרשת פנחס',
      shabbatDate: toISO(upcomingSaturday()),
      boxes: [
        {
          title: 'זמני הדלקת נרות שבת',
          rows: [
            { time: '19:10', label: 'כניסת שבת (ירושלים):' },
            { time: '19:30', label: 'כניסת שבת (תל אביב):' },
            { time: '20:33', label: 'צאת שבת:' }
          ]
        },
        {
          title: 'זמני תפילות שבת',
          rows: [
            { time: '19:40', label: 'מנחה וקבלת שבת:' },
            { time: '8:30', label: 'שחרית:' },
            { time: '19:30', label: 'מנחה (שבת):' },
            { time: '20:30', label: 'ערבית (מוצ״ש):' }
          ]
        },
        {
          title: 'זמני תפילות יום חול',
          rows: [
            { time: '7:00', label: 'שחרית (א‑ה):' },
            { time: '19:40', label: 'מנחה (א‑ה):' },
            { time: '20:15', label: 'ערבית (א‑ה):' }
          ]
        },
        {
          title: 'שיעורי הרב משיח',
          rows: [
            { time: '', label: 'לא יתקיימו שיעורים השבוע' }
          ]
        }
      ],
      sidebar: {
        image: 'assets/sample-building.jpg',
        title: 'הפטרות ימי בין המצרים',
        html:
          '<p>„תלתא דפורענותא”<br>שלוש הפטרות העוסקות בפורענות שקוראים בשבתות שבין שבעה עשר בתמוז ותשעה באב</p>' +
          '<p><strong>שנינו בפסיקתא: מפרשת בראשית עד י״ז בתמוז מפטירין לעניין הפרשיות דומה לדומה.</strong></p>' +
          '<p><strong>משם ואילך – הכל לפי הזמן ולפי המאורע”.</strong></p>' +
          '<p>כלומר עד לי״ז בתמוז היה עלינו לחפש קשר בין הפטרת השבוע לבין הפרשה. למצוא את הדומה לדומה. תוכן ההפטרה היה מקביל לתוכן הפרשה. מכאן ואילך קשורות ההפטרות אל לוח השנה ולאו דווקא אל פרשת השבוע.</p>' +
          '<p>ההפטרה הראשונה מ״תלתא דפורענותא” פותחת את נבואות החורבן של ירמיה: חזון מקל השקד מסמל שה׳ „שוקד” וממהר להביא את הפורענות, וחזון הסיר הנפוח מצפון מבשר שהחורבן יבוא מצפון כעונש על עבודת האלילים וחטאי העם. למרות האזהרות הקשות, ההפטרה מסתיימת בנחמה ובהבטחה שעם ישראל נותר קדוש לה׳, וה׳ זוכר את נאמנותו ואהבתו אליו מימי המדבר.</p>'
      }
    };
  }

  /* ---------- State ---------- */
  var loadedState = load();
  var freshLoad = !loadedState;
  var state = loadedState || defaultState();
  if (!state.shabbatDate) state.shabbatDate = toISO(upcomingSaturday()); // migrate older saved state
  if (!state.theme) state.theme = 'classic';
  var quill = null;
  var suppressQuill = false;

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setAutosave('השינויים נשמרים אוטומטית בדפדפן זה.');
      } catch (e) {
        // Likely quota exceeded (large image). Persist everything except the image.
        try {
          var clone = JSON.parse(JSON.stringify(state));
          if (clone.sidebar) clone.sidebar.image = null;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(clone));
        } catch (e2) {}
        setAutosave('התמונה גדולה מכדי להישמר בדפדפן — שאר השדות נשמרו.');
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
    main: $('mainHeadline'),
    sub: $('subHeadline'),
    boxes: $('boxes'),
    sideTitle: $('sideTitle'),
    sideImageInput: $('sideImageInput'),
    sideImagePreview: $('sideImagePreview'),
    sideImageRemove: $('sideImageRemove'),
    shabbatDate: $('shabbatDate'),
    shabbatStatus: $('shabbatStatus'),
    // board
    bMain: $('b-main'),
    bSub: $('b-sub'),
    bGrid: $('b-grid'),
    bSideImage: $('b-side-image'),
    bSideTitle: $('b-side-title'),
    bSideText: $('b-side-text'),
    board: $('board'),
    boardScale: $('boardScale'),
    boardSizer: $('boardSizer'),
    viewport: $('previewViewport')
  };

  /* ============================================================
     THEME
     ============================================================ */
  function applyTheme(id) {
    var t = themeById(id);
    var keys = Object.keys(t.vars);
    for (var i = 0; i < keys.length; i++) els.board.style.setProperty(keys[i], t.vars[keys[i]]);
  }
  function renderThemes() {
    els.themes.innerHTML = '';
    THEMES.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'theme-swatch' + (state.theme === t.id ? ' is-active' : '');
      b.title = t.name;
      b.innerHTML =
        '<div class="theme-swatch__preview" style="background:' + t.vars['--board-bg'] + '">' +
          '<div class="theme-swatch__stack">' +
            '<span class="theme-swatch__bar" style="background:' + t.vars['--teal'] + '"></span>' +
            '<span class="theme-swatch__bar theme-swatch__bar--sm" style="background:' + t.vars['--board-ink'] + '"></span>' +
          '</div>' +
        '</div>' +
        '<div class="theme-swatch__name">' + t.name + '</div>';
      b.addEventListener('click', function () {
        state.theme = t.id;
        applyTheme(t.id);
        renderThemes();
        save();
      });
      els.themes.appendChild(b);
    });
  }

  /* ============================================================
     BOARD RENDER
     ============================================================ */
  function renderBoard() {
    els.bMain.textContent = state.mainHeadline || '';
    els.bSub.textContent = state.subHeadline || '';

    // boxes
    els.bGrid.innerHTML = '';
    state.boxes.forEach(function (box) {
      var boxEl = document.createElement('div');
      boxEl.className = 'board__box';

      var title = document.createElement('h3');
      title.className = 'board__box-title';
      title.textContent = box.title || '';
      boxEl.appendChild(title);

      var rows = document.createElement('div');
      rows.className = 'board__rows';
      (box.rows || []).forEach(function (r) {
        var row = document.createElement('div');
        var hasTime = (r.time || '').trim() !== '';
        row.className = 'board__row' + (hasTime ? '' : ' board__row--note');

        var label = document.createElement('span');
        label.className = 'board__row-label';
        label.textContent = r.label || '';
        row.appendChild(label);

        if (hasTime) {
          var time = document.createElement('span');
          time.className = 'board__row-time';
          time.textContent = r.time;
          row.appendChild(time);
        }
        rows.appendChild(row);
      });
      boxEl.appendChild(rows);
      els.bGrid.appendChild(boxEl);
    });

    // sidebar
    els.bSideImage.innerHTML = '';
    if (state.sidebar.image) {
      var img = document.createElement('img');
      img.src = state.sidebar.image;
      img.alt = '';
      els.bSideImage.appendChild(img);
    } else {
      els.bSideImage.textContent = 'תמונה';
    }
    els.bSideTitle.textContent = state.sidebar.title || '';
    els.bSideText.innerHTML = state.sidebar.html || '';

    fitSidebarText();
  }

  /* Scale the sidebar free-text down until the whole sidebar column fits the
     900px canvas — keeps any amount of text inside the board instead of clipping. */
  var BOARD_PAD_V = 32;           // must match .board padding top/bottom
  function fitSidebarText() {
    var side = els.board.querySelector('.board__side');
    if (!side) return;
    var avail = 900 - 2 * BOARD_PAD_V;
    var el = els.bSideText;
    var chosen = 12;
    for (var fs = 20; fs >= 12; fs -= 0.5) {
      el.style.fontSize = fs + 'px';
      if (side.scrollHeight <= avail) { chosen = fs; break; }
    }
    el.style.fontSize = chosen + 'px';
  }

  /* ============================================================
     FORM RENDER + BINDING
     ============================================================ */
  function renderBoxesForm() {
    els.boxes.innerHTML = '';
    state.boxes.forEach(function (box, bi) {
      var wrap = document.createElement('div');
      wrap.className = 'box-editor';

      var head = document.createElement('div');
      head.className = 'box-editor__head';
      var pos = document.createElement('span');
      pos.className = 'box-editor__pos';
      pos.textContent = BOX_POS[bi] || '';
      var titleField = document.createElement('div');
      titleField.className = 'box-editor__title';
      var titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.value = box.title || '';
      titleInput.placeholder = 'כותרת התיבה';
      titleInput.addEventListener('input', function () {
        box.title = titleInput.value; renderBoard(); save();
      });
      titleField.appendChild(titleInput);
      head.appendChild(pos);
      head.appendChild(titleField);
      wrap.appendChild(head);

      var rowsWrap = document.createElement('div');
      rowsWrap.className = 'rows';
      box.rows.forEach(function (row, ri) {
        rowsWrap.appendChild(buildRowEditor(box, bi, ri));
      });
      wrap.appendChild(rowsWrap);

      var addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'row-add';
      addBtn.textContent = '＋ הוסף שורה';
      addBtn.addEventListener('click', function () {
        box.rows.push({ time: '', label: '' });
        renderBoxesForm(); renderBoard(); save();
      });
      wrap.appendChild(addBtn);

      els.boxes.appendChild(wrap);
    });
  }

  function buildRowEditor(box, bi, ri) {
    var row = box.rows[ri];
    var el = document.createElement('div');
    el.className = 'row-editor';

    var timeWrap = document.createElement('div');
    timeWrap.className = 'row-editor__time';
    var timeInput = document.createElement('input');
    timeInput.type = 'text';
    timeInput.value = row.time || '';
    timeInput.placeholder = 'שעה';
    timeInput.setAttribute('dir', 'ltr');
    timeInput.addEventListener('input', function () {
      row.time = timeInput.value; renderBoard(); save();
    });
    timeWrap.appendChild(timeInput);

    var labelWrap = document.createElement('div');
    labelWrap.className = 'row-editor__label';
    var labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = row.label || '';
    labelInput.placeholder = 'כותרת / טקסט';
    labelInput.addEventListener('input', function () {
      row.label = labelInput.value; renderBoard(); save();
    });
    labelWrap.appendChild(labelInput);

    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'row-remove';
    remove.title = 'הסר שורה';
    remove.textContent = '×';
    remove.addEventListener('click', function () {
      box.rows.splice(ri, 1);
      renderBoxesForm(); renderBoard(); save();
    });

    el.appendChild(timeWrap);
    el.appendChild(labelWrap);
    el.appendChild(remove);
    return el;
  }

  function renderSideImagePreview() {
    els.sideImagePreview.innerHTML = '';
    if (state.sidebar.image) {
      var img = document.createElement('img');
      img.src = state.sidebar.image;
      img.alt = '';
      els.sideImagePreview.appendChild(img);
    } else {
      var empty = document.createElement('span');
      empty.className = 'image-preview__empty';
      empty.textContent = 'אין תמונה';
      els.sideImagePreview.appendChild(empty);
    }
  }

  function syncFormFromState() {
    els.main.value = state.mainHeadline || '';
    els.sub.value = state.subHeadline || '';
    els.sideTitle.value = state.sidebar.title || '';
    if (els.shabbatDate) els.shabbatDate.value = state.shabbatDate || '';
    renderThemes();
    applyTheme(state.theme);
    renderBoxesForm();
    renderSideImagePreview();
    if (quill) {
      suppressQuill = true;
      quill.setContents([]);
      quill.clipboard.dangerouslyPasteHTML(0, state.sidebar.html || '');
      suppressQuill = false;
    }
  }

  /* ============================================================
     QUILL (fully-featured rich text for the free text)
     ============================================================ */
  function initQuill() {
    quill = new Quill('#sideTextEditor', {
      theme: 'snow',
      placeholder: 'הקלד/י כאן את הטקסט החופשי…',
      modules: {
        toolbar: [
          [{ size: ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline'],
          [{ color: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ align: [] }],
          [{ direction: 'rtl' }],
          ['clean']
        ]
      }
    });
    // Default writing direction: RTL
    quill.format('direction', 'rtl');
    quill.format('align', 'right');

    suppressQuill = true;
    quill.clipboard.dangerouslyPasteHTML(0, state.sidebar.html || '');
    suppressQuill = false;

    quill.on('text-change', function () {
      if (suppressQuill) return;
      state.sidebar.html = quill.root.innerHTML;
      renderBoard();
      save();
    });
  }

  /* ============================================================
     IMAGE UPLOAD
     ============================================================ */
  function handleImageFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      state.sidebar.image = e.target.result;
      renderSideImagePreview();
      renderBoard();
      save();
    };
    reader.readAsDataURL(file);
  }

  /* ============================================================
     SHABBAT (Hebcal) — fill parsha (sub-headline) + candle-lighting box
     ============================================================ */
  function applyShabbat() {
    var res = computeShabbat(state.shabbatDate);
    if (!res) {
      if (els.shabbatStatus) els.shabbatStatus.textContent =
        'ספריית Hebcal לא נטענה — ניתן להזין את הפרשה והזמנים ידנית.';
      return;
    }
    if (res.parsha) state.subHeadline = res.parsha;
    // The first box is the Shabbat candle-lighting box — fill it with computed times.
    state.boxes[0].rows = [
      { time: res.jerusalem, label: 'כניסת שבת (ירושלים):' },
      { time: res.telaviv, label: 'כניסת שבת (תל אביב):' },
      { time: res.havdalah, label: 'צאת שבת:' }
    ];
    syncFormFromState();
    renderBoard();
    save();
    if (els.shabbatStatus) {
      els.shabbatStatus.textContent = '✓ ' + (res.parsha || 'ללא פרשה קבועה') +
        ' · כניסת שבת: י‑ם ' + (res.jerusalem || '—') + ', ת״א ' + (res.telaviv || '—') +
        ' · צאת שבת ' + (res.havdalah || '—');
    }
  }

  /* ============================================================
     PREVIEW SCALING
     ============================================================ */
  function fitPreview() {
    var vp = els.viewport;
    var avail = vp.clientWidth - 48; // padding
    var s = Math.min(avail / 1600, 1);
    if (s <= 0) s = 0.1;
    // The scale goes on .board-scale; the sizer reserves the resulting footprint in the flow.
    els.boardScale.style.transform = 'scale(' + s + ')';
    els.boardSizer.style.width = (1600 * s) + 'px';
    els.boardSizer.style.height = (900 * s) + 'px';
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

    // Neutralize the preview scale so html2canvas captures the natural 1600×900.
    var prevTransform = els.boardScale.style.transform;
    var prevSizerW = els.boardSizer.style.width;
    var prevSizerH = els.boardSizer.style.height;
    els.boardScale.style.transform = 'none';
    els.boardSizer.style.width = '1600px';
    els.boardSizer.style.height = '900px';

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
        return html2canvas(els.board, {
          backgroundColor: themeById(state.theme).vars['--board-bg'],
          scale: 2,
          width: 1600,
          height: 900,
          windowWidth: 1600,
          windowHeight: 900,
          useCORS: true,
          logging: false
        });
      })
      .then(function (canvas) {
        canvas.toBlob(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          var name = (state.mainHeadline || 'לוח-בית-כנסת').replace(/\s+/g, '-');
          a.href = url;
          a.download = name + '.png';
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
    els.main.addEventListener('input', function () { state.mainHeadline = els.main.value; renderBoard(); save(); });
    els.sub.addEventListener('input', function () { state.subHeadline = els.sub.value; renderBoard(); save(); });
    els.sideTitle.addEventListener('input', function () { state.sidebar.title = els.sideTitle.value; renderBoard(); save(); });

    els.sideImageInput.addEventListener('change', function (e) {
      handleImageFile(e.target.files && e.target.files[0]);
      e.target.value = '';
    });
    els.sideImageRemove.addEventListener('click', function () {
      state.sidebar.image = null;
      renderSideImagePreview(); renderBoard(); save();
    });

    // Shabbat / Hebcal controls
    els.shabbatDate.addEventListener('change', function () {
      state.shabbatDate = els.shabbatDate.value || state.shabbatDate;
      applyShabbat();
    });
    $('btnUpcoming').addEventListener('click', function () {
      state.shabbatDate = toISO(upcomingSaturday());
      els.shabbatDate.value = state.shabbatDate;
      applyShabbat();
    });
    $('btnRecalc').addEventListener('click', applyShabbat);

    $('btn-download').addEventListener('click', download);
    $('btn-example').addEventListener('click', function () {
      if (!confirm('לטעון את תוכן הדוגמה? הפעולה תחליף את מה שממולא כעת.')) return;
      var keepTheme = state.theme;
      state = defaultState();
      state.theme = keepTheme;
      syncFormFromState(); renderBoard(); applyShabbat();
    });
    $('btn-clear').addEventListener('click', function () {
      if (!confirm('לנקות את כל השדות?')) return;
      state = {
        theme: state.theme,
        mainHeadline: '', subHeadline: '',
        shabbatDate: toISO(upcomingSaturday()),
        boxes: [
          { title: '', rows: [{ time: '', label: '' }] },
          { title: '', rows: [{ time: '', label: '' }] },
          { title: '', rows: [{ time: '', label: '' }] },
          { title: '', rows: [{ time: '', label: '' }] }
        ],
        sidebar: { image: null, title: '', html: '' }
      };
      syncFormFromState(); renderBoard(); save();
    });
  }

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    initQuill();
    bindStaticFields();
    syncFormFromState();
    renderBoard();
    fitPreview();
    window.addEventListener('resize', fitPreview);
    if (window.ResizeObserver) {
      new ResizeObserver(fitPreview).observe(els.viewport);
    }
    // Re-fit the sidebar text once the web fonts have actually loaded,
    // since final glyph metrics change the measured height.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitSidebarText);
    }

    // On a first visit (nothing saved yet), auto-fill parsha + Shabbat times.
    // Returning visitors keep exactly what they saved (their title & sidebar included).
    if (freshLoad) applyShabbat();
  });
})();
