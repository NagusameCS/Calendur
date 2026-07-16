# Calendur

A fast, fully client-side **calendar generator** for schools, teams and events.
Design colour-coded academic calendars in the browser and export them as
**SVG, PNG or JPG** at any resolution.

Built as a static site — no backend, no build step, no dependencies. Runs great
on **GitHub Pages**.

![Calendur](https://img.shields.io/badge/static-site-black) ![No deps](https://img.shields.io/badge/dependencies-0-black)

## Features

- **Any number of months** from any **start month** and **year** (1–36 months).
- **Grid layout** — choose 1–6 columns or let it auto-arrange.
- **Colour codes** — add unlimited categories (Holiday, Break, Exam, Field Trip…)
  each with its own colour and legend label.
- **Events & ranges** — mark single days or multi-day breaks; ranges fill every
  day in between with the category colour.
- **Colour schemes** — apply one-click palettes (Academic, Vivid, Pastel, Earth,
  Neon) or pick every colour by hand.
- **Themes** — Noir (dark), Paper, Mono Light, Slate, Blueprint, Cream. Perfect
  for both screen and print.
- **Export** — vector **SVG**, or raster **PNG/JPG** at 1×–4× or a custom pixel
  width for high-resolution printing.
- **Options** — week starts Sunday/Monday, weekend shading, "today" highlight,
  event labels, trailing days.
- **Save / load** your calendar configuration as JSON. Work is also auto-saved
  to your browser.

## Usage

Open `index.html` in any modern browser, or visit the deployed GitHub Pages site.
Configure the calendar in the left panel and watch the live preview update, then
click **Download**.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. In **Settings → Pages**, set the source to the `main` branch (root).
   The included workflow at `.github/workflows/deploy.yml` will also publish it
   automatically on each push.
3. Your calendar generator will be live at `https://<user>.github.io/<repo>/`.

## Tech

Pure HTML, CSS and vanilla JavaScript. Calendars are generated as SVG markup and
rasterised to PNG/JPG entirely in the browser via the Canvas API — nothing is
uploaded anywhere.

## Credits

System font stack — no web fonts, exports render consistently offline.

## License

[MIT](LICENSE)
