# Contora — VFX Tracker · **SANDBOX**

> ⚠️ This is the **sandbox** copy of [`cont-ra/_contora`](https://github.com/cont-ra/_contora) — deployed at [sandbox.contora.net](https://sandbox.contora.net) for risk-free experiments.
> Not production. Test new features here first; cherry-pick into the main repo when stable.

## Architecture

| Layer | Sandbox | Production (for reference) |
|---|---|---|
| Domain | `sandbox.contora.net` | `contora.net` |
| Frontend | GitHub Pages of this repo | GitHub Pages of `cont-ra/_contora` |
| API Worker | `contora-proxy-sandbox` | `contora-proxy` |
| Database | Supabase `hsvylpssqldbfxrddxwd` | Supabase `brpqatwlrqertxtggbbn` |
| R2 bucket | `kh-vfx-video-sandbox` | `kh-vfx-video` |
| Telegram bot | shared with prod | — |

## Workflow

```
feature → cont-ra/_contora-sandbox → sandbox.contora.net → test
                                               ↓ stable
                              cherry-pick / PR into cont-ra/_contora
                                               ↓
                                        contora.net
```

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

## Layout

```
.
├── index.html              ← frontend, served by GitHub Pages
├── api/
│   ├── src/
│   │   ├── index.js
│   │   ├── api.js
│   │   ├── compose.js
│   │   └── decomposer.js
│   └── wrangler.toml       ← Cloudflare Worker config (sandbox)
├── tools/
│   ├── server.py
│   └── bump-version.sh
├── wrangler.jsonc          ← legacy: unused Worker `traker` (no routes)
└── .assetsignore           ← legacy
```
