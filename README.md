# wizzed.github.io

🕹️ **Wizzed Arcade** — 54 free browser games & apps, plus the 11 original classics.

[▶ Play now](https://wizzed.github.io)

## Structure

- `index.html` — the arcade frontpage (synthwave/pixel theme, live screenshot previews, category filters, 3D hero)
- `games/*.html` — the 54 new games & apps, each a single standalone HTML file
- `games/old/*.html` — the original 11 classics, reachable via `old.html` (The Old Arcade)
- `shots/<slug>/1.jpg … 5.jpg` — five gameplay screenshots per game; the frontpage cycles through them on hover
- `lib/three.min.js` — three.js r160, used by the 3D games and the frontpage hero

## Notes

- Everything runs entirely in the browser — no build step, no backend, no ads.
- High scores and app data persist via `localStorage`.
- Screenshots are auto-captured with Playwright (800×500 viewport, 5 frames of simulated play per game).
