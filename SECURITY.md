# Security

jarby.dev is a static personal site. There is no backend, no database, no login, no forms, no cookies and no analytics. Visitors send nothing to the site except the HTTP request for each file.

## Reporting a problem

Email jessidc95@gmail.com. The same contact is published in [`/.well-known/security.txt`](https://jarby.dev/.well-known/security.txt) (RFC 9116).

## Controls in place

| Area | What is done | Where to check it |
|---|---|---|
| Content Security Policy | Every page starts from `default-src 'none'` and allows only same-origin scripts, styles, fonts and images. No `unsafe-inline` or `unsafe-eval` on the main pages. The generated benchmark report allows inline styles only, and runs no scripts. | `<meta http-equiv="Content-Security-Policy">` in each page |
| No inline code | No inline `<script>`, no `on*=` handlers, no `style=` attributes on the main pages. The theme is applied by `assets/theme-init.js`. | `scripts/check.mjs` |
| Third parties | Nothing is loaded from another origin. Fonts are self-hosted. Outbound links go only to an allowlist (GitHub, LinkedIn, Tocaturno). | `scripts/check.mjs` |
| Transport | `.dev` is on the HSTS preload list at the top level, so browsers only reach the site over HTTPS. GitHub Pages enforces HTTPS and redirects `http` and `www`. | Browser devtools |
| Referrer | `strict-origin-when-cross-origin` | `<meta name="referrer">` |
| Personal data | No phone number on any public page or PDF. Contact is by email only. | `scripts/check.mjs` |
| Secrets | gitleaks scans the full history on every push and pull request. | `.github/workflows/deploy.yml` |
| Dependencies | Build tools are pinned in `package-lock.json`, `npm audit` runs in CI, and Dependabot proposes updates for npm and GitHub Actions weekly. | `.github/dependabot.yml` |
| Integrity | Each build writes `build-manifest.json` with the commit and a SHA-256 for every published file. | `https://jarby.dev/build-manifest.json` |
| Release gate | The site is deployed by GitHub Actions only after the secret scan, the audit, the build, the security checks and HTML validation pass. | Actions tab |

## Known limits

- GitHub Pages does not allow custom response headers. That rules out `frame-ancestors` and `X-Frame-Options`, which only work as headers. The pages have no actions a framing attack could trigger. If that changes, the plan is to put the site behind a proxy that sets headers.
- The served HTML, CSS and JS are minified, not obfuscated. The source is public in this repository, so obfuscation would add nothing; the controls above are what protect the site.
