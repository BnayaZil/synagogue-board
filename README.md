# מחולל לוח מודעות לבית הכנסת · Synagogue Notice-Board Generator

A static web app (Hebrew / RTL) with two board generators. Fill in the form on
the right and the board on the left updates live; click **הורדת תמונה (PNG)** to
export a print-ready image. A switcher in the top bar moves between the two.

| Board | URL | Output |
|---|---|---|
| Synagogue notice board (landscape) | `/` | 3200×1800 PNG |
| Weekly-parsha lectures poster (portrait) | `/parsha/` | 2000×2880 PNG |

## Weekly-parsha lectures poster (`/parsha/`)

A portrait poster listing a rabbi's lectures for the week: gold headline, a navy
ribbon with the topic, then one or more **days**, each with a list of **lecture
cards** (icon tile · place + address · time tile), and a closing ribbon.

- **Automatic parsha & dates (Hebcal)** — pick a Shabbat (it auto-advances to the
  upcoming one). The topic ribbon becomes *הנושא: פרשת …* (switchable off), and
  every day linked to a weekday gets its title and date filled in, e.g.
  *יום שישי* / *כ״ח בתשרי תשפ״ז 9.10.26*, or *שבת פרשת בראשית* for Shabbat.
- **Days** — add / remove / reorder; heading style *כותרת + תאריך* or
  *כותרת בין קווים* (title between gold lines); or set a manual title.
- **Lectures** — add / remove / reorder; choose an icon (synagogue, candle, open
  book, Torah scroll, Star of David, none); multi-line place and time text.
- **Auto-fit** — the headline and ribbon texts shrink to one line, and the day /
  lecture area scales down so any number of lectures fits the poster.
- **Themes** — nine presets (navy & gold by default) plus a custom palette
  (background, main color, accent). The decorative background, ribbons, and
  icons are SVGs generated in the theme colors, so the PNG matches the preview.
- **Autosave** — kept in `localStorage` under its own key, separate from the
  notice board.

## Synagogue notice board (`/`)

## Features

- **Live preview** — every edit re-renders the board instantly.
- **Theme presets** — thirty ready-made looks: light + dark themes, six white-background
  accents, and twelve white-background *dark* accents. The chosen theme is saved and
  applied to the exported PNG. Themes are driven by CSS variables on the board, so adding
  a preset is one entry in `THEMES`.
- **Custom palette** — six color pickers (background, headings, sub-heading, text, lines,
  image-box background) let you build your own palette; editing any color creates a saved
  "מותאם אישית" theme (kept in `localStorage`) that also appears as a swatch.
- **Full structure of the reference layout:**
  - Main headline + sub-headline
  - Four boxes, each with a title and any number of *time + label* rows
    (a row with no time renders as a centred note, e.g. *"לא יתקיימו שיעורים השבוע"*)
  - Sidebar with an image, a title, and free text
- **Automatic parsha & Shabbat times (Hebcal)** — pick a Shabbat date (or press
  *השבת הקרובה*) and the weekly **parsha** (sub-headline) plus **candle-lighting**
  times for Jerusalem & Tel Aviv and **havdalah** are computed with
  [`@hebcal/core`](https://github.com/hebcal/hebcal-es6) and filled into the board.
  Every value stays editable by hand.
- **Fully-featured rich-text editor** (Quill) for the sidebar free text — bold,
  italic, underline, colour, lists, alignment, and RTL direction.
- **Sidebar text auto-fit** — text is scaled down automatically so it always
  fits inside the 900px canvas instead of being clipped.
- **Image upload** for the sidebar picture (stored locally in the browser).
- **PNG export** via `html2canvas` — the exact board you see, at 2× resolution.
- **Autosave** — all your content (title, sidebar, times, chosen date) is kept in
  the browser's `localStorage`, so it is exactly as you left it on the next visit.
  Hebcal only fills the parsha and the Shabbat-times box; your headline and sidebar
  are never overwritten by it.
- **Fully self-hosted** — Hebrew fonts (Heebo + Rubik), Quill, html2canvas, and
  Hebcal are all bundled; the page needs no external network requests to work.

## Usage

1. Open the site.
2. Edit the fields. The board on the left updates as you type.
3. Replace the sidebar image with your own (**בחר תמונה**).
4. Click **הורדת תמונה (PNG)** to download the finished board.

`טען דוגמה` reloads the example content; `נקה הכל` clears everything.

## Project structure

```
index.html          # notice board: form + live board
css/styles.css      # app chrome (shared) + the pixel-accurate 1600×900 board
js/app.js           # notice board: state model, live render, auto-fit, PNG export
parsha/index.html   # parsha-lectures poster page (served at /parsha/)
css/parsha.css      # the 1000×1440 portrait poster
js/parsha.js        # poster: state, Hebcal week dates, SVG artwork, auto-fit, PNG export
assets/fonts.css    # @font-face for the self-hosted fonts
assets/fonts/*.woff2 # Heebo + Rubik (Hebrew + Latin subsets)
assets/synagogue-render.jpg # default sidebar image (Kfar Ganim B synagogue render)
vendor/quill.*      # rich-text editor
vendor/html2canvas.min.js   # DOM → canvas for the PNG export
vendor/hebcal.bundle.min.js # @hebcal/core — parsha + Shabbat times (GPLv2)
```

## Licenses of bundled libraries

- **@hebcal/core** — GPLv2
- **Quill** — BSD-3-Clause
- **html2canvas** — MIT
- **Heebo / Rubik** fonts — SIL Open Font License 1.1

## Running locally

Any static file server works, e.g.:

```bash
python3 -m http.server 8000
# then open http://127.0.0.1:8000/  (lectures poster: http://127.0.0.1:8000/parsha/)
```

## Deployment

Hosted with **GitHub Pages** from the repository root (`.nojekyll` disables
Jekyll processing so all folders are served as-is).
