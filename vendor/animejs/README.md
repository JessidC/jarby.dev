# anime.js 4.5.0 (vendored)

The ES module build of [anime.js](https://animejs.com) by Julian Garnier, MIT License (see `LICENSE.md`). It draws the animated diagrams of the story pages. Nothing in this folder is published as is: `scripts/build.mjs` bundles the few modules that `src/flows.js` imports into `assets/flows.js`.

## Where it comes from

| | |
|---|---|
| Repository | https://github.com/juliangarnier/anime |
| Tag | `v4.5.0` |
| Commit | `2c9cf8ea00329f6768c7d7902252ed977d75ce42` |
| Files | every `.js` file under `dist/modules/` (69 files), unchanged. The `.cjs` and `.d.ts` files are left out. |
| Added here | this README and `package.json`. The second one only repeats the `sideEffects` hint of the upstream `package.json`, with the path adapted to this folder, so esbuild drops unused modules the same way it would with the npm package. |

## Check that nothing was changed

```bash
git clone --depth 1 --branch v4.5.0 https://github.com/juliangarnier/anime /tmp/anime
(cd /tmp/anime/dist/modules && find . -name '*.js' | sort | xargs sha256sum | sha256sum)
(cd vendor/animejs && find . -name '*.js' | sort | xargs sha256sum | sha256sum)
```

Both commands print `200406b2d71fa367aa74e6a57f913cbaea62e79f2642469966e0058df54259fc`.

## Updating

Dependabot does not watch this folder. To move to a newer release, replace the `.js` files with the ones from the new tag, then update the tag, commit and hash above, the version in the banner of `scripts/build.mjs`, and the row in `SECURITY.md`.

The other option is to drop this folder and take the library from npm, where the lockfile and Dependabot cover it: `npm install --save-dev --save-exact animejs@4.5.0`, then remove the `alias` line in `scripts/build.mjs` and copy the license from `node_modules/animejs/LICENSE.md` instead. The imports in `src/flows.js` stay the same.
