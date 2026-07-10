# wizzed.github.io

🕹️ **Wizzed Arcade** — 101 free browser games & 57 tools, plus the 11 original classics.

[▶ Play now](https://wizzed.github.io) · 📖 **[Full game & tool catalog → CATALOG.md](CATALOG.md)**

## Structure

- `index.html` — the arcade frontpage. A **sticky bar** at the top toggles between the **Games** and **Tools** views and holds the category-filter chips, search box, and a **light/dark theme toggle** (defaults to your system preference, saved in `localStorage`). Hover any card to preview 5 gameplay screenshots.
- `games/*.html` — the 101 games (arcade, action, puzzle, RPG, board, words, cards, and 13 in full 3D — including **Skyward** endless flight, **Wavefarer** sailing on a GPU Gerstner-wave ocean, and **Character Forge**, a full character creator that exports standard `.glb` model files)
- `tools/*.html` — the 57 tools (productivity, text/dev, numbers, design, audio & visual, data — including **Visualizer Studio**, which turns any song or MP4 into a music video with timed lyrics and multi-resolution export)
- `games/old/*.html` — the original 11 classics, reachable via `old.html` (The Old Arcade)
- `shots/<slug>/1.jpg … 5.jpg` — five gameplay screenshots per entry; the frontpage cycles through them on hover
- `lib/three.min.js` — three.js r160, used by the 3D games and the frontpage hero
- **[`CATALOG.md`](CATALOG.md)** — the complete, categorized reference to every game and tool

## Conventions

- Every game/tool is a single standalone HTML file: all CSS/JS inline, no external network resources (3D games load only the local `lib/three.min.js`).
- Dark neon aesthetic, a fixed **← Arcade** back link (top-left), and scores/settings/progress saved in `localStorage` under `wizzed-<slug>`.
- Everything runs entirely in the browser — no build step, no backend, no ads.

## Regenerating screenshots

Screenshots are captured with a headless-Chromium Playwright script that loads each page at an 800×500 viewport, simulates a few seconds of play, and saves five JPEGs to `shots/<slug>/`. To recapture:

1. Serve the repo root over HTTP (e.g. `python3 -m http.server 8347`).
2. Run the capture script against the slugs you want (one browser, five frames per page).

See `CATALOG.md` for the full list of slugs.
