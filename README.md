# Contora — VFX Tracker

Monorepo for the Contora VFX tracker, deployed at [contora.net](https://contora.net).

## Architecture

| Layer | Where it lives | Where it deploys |
|---|---|---|
| Frontend (`index.html`) | repo root | **GitHub Pages** (auto-deploys on push to `main`), reverse-proxied via Cloudflare to `contora.net/vfx-tracker/` |
| API Worker | `api/` | **Cloudflare Worker** `contora-proxy` → API endpoints on `contora.net` |
| Local dev tools | `tools/` | not deployed |

## Deploy

```bash
# frontend (GitHub Pages) — automatic on push to main
git push

# api (Cloudflare Worker) — manual
cd api && wrangler deploy
```

## Local dev

```bash
python3 tools/server.py        # Range-aware HTTP server on :8000
```

## Version bump

`tools/bump-version.sh` auto-increments the build number in `index.html`
(format `vX.Y.ZZZZ`). Wired as `.git/hooks/pre-push` — runs on every
`git push` and bumps the version inside the last commit.

## Layout

```
.
├── index.html              ← frontend, served by GitHub Pages
├── api/
│   ├── src/
│   │   ├── index.js        ← Worker entry
│   │   ├── api.js          ← main API
│   │   ├── compose.js
│   │   └── decomposer.js
│   └── wrangler.toml       ← Cloudflare Worker config
├── tools/
│   ├── server.py
│   └── bump-version.sh
├── wrangler.jsonc          ← legacy: unused Worker `traker` (no routes)
└── .assetsignore           ← legacy: only relevant if frontend ever moves to a CF Worker
```
