# jarby.dev

Source of my portfolio at [jarby.dev](https://jarby.dev). Plain HTML and CSS with a few lines of JavaScript, no framework. English at `/`, Spanish at `/es/`.

## Build and check

```bash
npm ci
npm run build   # minifies into _site/ and writes build-manifest.json
npm run check   # security and QA gate, then HTML validation
```

GitHub Actions runs the same steps, plus a secret scan and `npm audit`, and deploys to GitHub Pages only when all of them pass. See [SECURITY.md](SECURITY.md) for what is checked and why.
