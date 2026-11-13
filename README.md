# jarby.dev

Source of my portfolio at [jarby.dev](https://jarby.dev). Plain HTML and CSS with a few lines of JavaScript, no framework. English at `/`, Spanish at `/es/`.

## Animation

The pages are complete without JavaScript. Motion is added on top, after the page has loaded, and only where it is welcome: not with `prefers-reduced-motion`, and not on devices with little memory or two cores or fewer.

| File | What it does | Size (gzip) |
|---|---|---|
| `src/motion.js` | One entrance per section on every page, with the Web Animations API. No library. Entrances play in reading order and wait while a diagram is running. | 3 KB |
| `src/flows.js` | The animated diagrams of the story pages, drawn with [anime.js](https://animejs.com) 4.5.0 (MIT). Loaded on the story pages only. | 26 KB |

`assets/site.js` fetches both when the browser is idle. If they never arrive, the diagrams fall back to their CSS animation. anime.js is vendored in [`vendor/animejs`](vendor/animejs/README.md) and bundled at build time; nothing is loaded from another origin.

## Build and check

```bash
npm ci
npm run build   # minifies into _site/, bundles src/ and writes build-manifest.json
npm run check   # security and QA gate, then HTML validation
```

GitHub Actions runs the same steps, plus a secret scan and `npm audit`, and deploys to GitHub Pages only when all of them pass. See [SECURITY.md](SECURITY.md) for what is checked and why.
