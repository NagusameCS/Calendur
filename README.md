# Calendur

Client-side calendar generator. Design colour-coded school and event calendars,
export as SVG/PNG/JPG at any resolution.

Static site — no backend, no build step, no dependencies. Runs on GitHub Pages.

## Quick start

Open `index.html` in a browser, or visit the deployed site. Configure in the
left panel, preview on the right. Click **Download** to export.

## Features

- 1–36 months from any start month and year
- 1–6 column grid layout (or auto)
- Unlimited colour-coded categories with custom labels
- Single-day events or multi-day date ranges
- 6 built-in themes (Noir, Paper, Mono, Slate, Blueprint, Cream)
- 5 colour palettes (Academic, Vivid, Pastel, Earth, Neon)
- Export: SVG (vector), PNG, JPG at 1×–4×, page size presets (A4/Letter/Tabloid @ 300 dpi), or custom pixel width
- Custom weekend days, font size, day alignment, month borders
- Interactive HTML view with hover tooltips
- Interactive SVG exports with embedded `<title>` tooltips and CSS hover effects
- Freeform notes block rendered below the calendar
- Event descriptions shown in tooltips
- Print to PDF, share via URL, embed as iframe
- Import/export JSON config, bulk CSV import, GitHub URL import, quick-add date presets
- Event search/filter, duplication
- CLI for headless generation (`cli/calendur.js`)
- URL API endpoint (`?auto=1&year=2027&format=png`)
- Embedded view mode (`?embed=1`) and view-only mode (`?view=1`)
- Auto-save to localStorage with state migration

## Project structure

```
index.html              — single-page app (panel + preview)
assets/
  css/style.css         — stylesheet
  js/app.js             — all application logic
cli/
  calendur.js           — standalone Node.js CLI (zero deps for SVG)
.github/workflows/
  deploy.yml            — GitHub Pages deploy action
```

## JSON config format

The full calendar state is a single JSON object. Import/export uses this schema.

```jsonc
{
  "title": "2026–2027 Academic Year",
  "subtitle": "Springfield High School",
  "notes": "Winter Break: Dec 21 – Jan 2. No classes.",
  "year": 2026,
  "startMonth": 8,
  "months": 10,
  "columns": "auto",
  "weekStart": 0,
  "theme": "noir",
  "shadeWeekend": true,
  "highlightToday": false,
  "showLabels": false,
  "trailingDays": false,
  "showBorders": true,
  "showWatermark": false,
  "fontScale": 1,
  "weekendDays": [0, 6],
  "todayColor": "#ffffff",
  "dayAlign": "start",
  "categories": [
    { "id": "c1", "label": "Holiday", "color": "#c62828" },
    { "id": "c2", "label": "Break",   "color": "#1565c0" },
    { "id": "c3", "label": "Event",   "color": "#2e7d32" }
  ],
  "events": [
    {
      "id": "ev1",
      "name": "Winter Break",
      "description": "Campus closed.",
      "categoryId": "c2",
      "start": "2026-12-21",
      "end": "2027-01-02"
    }
  ]
}
```

### Schema notes

| Field | Type | Range/Values |
|---|---|---|
| `title`, `subtitle`, `notes` | string | Any |
| `year` | number | 1–9999 |
| `startMonth` | number | 0=Jan … 11=Dec |
| `months` | number | 1–36 |
| `columns` | string\|number | `"auto"` or 1–6 |
| `weekStart` | number | 0=Sun, 1=Mon |
| `theme` | string | `noir`, `paper`, `mono`, `slate`, `blueprint`, `cream` |
| `fontScale` | number | 0.5–2 (compact, normal, large) |
| `weekendDays` | number[] | Subset of [0..6] |
| `dayAlign` | string | `start`, `middle`, `end` |
| `categories[].color` | string | Hex colour |
| `events[].start`, `events[].end` | string | ISO date `YYYY-MM-DD` |

## CLI

```bash
# Basic
node cli/calendur.js -o calendar.svg

# Full control
node cli/calendur.js \
  --year 2027 --months 12 --start 0 \
  --theme paper --title "2027" --watermark \
  -o 2027.svg

# From config file
node cli/calendur.js --config calendar.json -o out.svg

# Pipe from stdin
cat config.json | node cli/calendur.js --stdin -o out.svg

# Help
node cli/calendur.js --help
```

Zero dependencies for SVG output. Install `sharp` for PNG/JPG rasterization.

## Embed

Click **Embed** in the Export section to copy an iframe snippet. Paste into any
HTML page.

Example embed URL:
```
https://nagusamecs.github.io/Calendur/?embed=1&theme=paper&year=2026&months=10&start=8
```

Use `?embed=1` to strip chrome. `?view=1` for view-only (shows an Edit button).

## URL API

Append query parameters to auto-generate and download:

```
https://nagusamecs.github.io/Calendur/?auto=1&year=2027&format=png&theme=paper
```

| Param | Example | Notes |
|---|---|---|
| `auto=1` | Required | Triggers download |
| `year` | `2027` | 1–9999 |
| `months` | `12` | 1–36 |
| `start` | `0` | 0=Jan … 11=Dec |
| `theme` | `paper` | One of the 6 themes |
| `title` | `My%20Calendar` | URL-encoded |
| `format` | `png` | svg, png, jpg |
| `scale` | `2` | 1–4 or page preset |
| `embed=1` | View mode | Hides chrome |
| `view=1` | View mode | Hides controls, adds Edit button |
| `cfg` | base64 JSON | Encoded config fragment |

## Deploy

Push to GitHub. Enable Pages in Settings → source `main` branch, root directory.
The included workflow at `.github/workflows/deploy.yml` handles deployment.

## Key functions (app.js)

| Function | Purpose |
|---|---|
| `buildCalendar()` | Builds SVG markup from state |
| `buildHtmlCalendar()` | Builds interactive HTML calendar |
| `buildEventIndex()` | Pre-computes date→events Map for O(1) cell lookups |
| `buildMonth()` | Builds one month block as SVG |
| `renderNow()` | Renders preview (SVG or HTML mode) |
| `addEvent()` | Adds an event with validation |
| `doExport()` | Triggers SVG/PNG/JPG download |
| `importCsv()` | Parses CSV/TSV into events |
| `importJsonText()` | Parses JSON into state |
| `shareUrl()` | Encodes state into shareable URL |
| `copyEmbedCode()` | Generates iframe embed snippet |

## License

[MIT](LICENSE)
