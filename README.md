# מחולל לוח מודעות לבית הכנסת · Synagogue Notice-Board Generator

A static, single-page web app (Hebrew / RTL) for producing a synagogue notice
board. Fill in the form on the right and the board on the left updates live;
click **הורדת תמונה (PNG)** to export a print-ready 3200×1800 image.

## Features

- **Live preview** — every edit re-renders the board instantly.
- **Theme presets** — twelve ready-made looks (קלאסי / לילה / זהב מלכותי / תכלת / זית /
  בורדו / חול מדבר / פחם וזהב / סגול מלכותי / אזמרגד / ורוד עתיק / אינדיגו), a mix of
  light and dark. The chosen theme is saved and applied to the exported PNG as well.
  Themes are driven by CSS variables on the board, so adding a new preset is one entry
  in `THEMES`.
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
index.html          # markup: form + live board
css/styles.css      # app chrome + the pixel-accurate 1600×900 board
js/app.js           # state model, live render, auto-fit, PNG export
assets/fonts.css    # @font-face for the self-hosted fonts
assets/fonts/*.woff2 # Heebo + Rubik (Hebrew + Latin subsets)
assets/sample-building.jpg  # default placeholder image
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
# then open http://127.0.0.1:8000/
```

## Deployment

Hosted with **GitHub Pages** from the repository root (`.nojekyll` disables
Jekyll processing so all folders are served as-is).
