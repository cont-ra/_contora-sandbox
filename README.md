# Contora — VFX Tracker

Monorepo for the Contora VFX tracker, deployed at [contora.net](https://contora.net).

## Layout

| Path | Cloudflare target | Description |
|---|---|---|
| `frontend/` | Worker `traker` (assets) | Single-page web app (`index.html`) |
| `api/` | Worker `contora-proxy` | API: auth, Telegram push, R2 proxy, MCP |
| `tools/` | — | Local dev: `server.py` (Range-aware HTTP), `bump-version.sh` |

## Deploy

```bash
# frontend
cd frontend && wrangler deploy

# api
cd api && wrangler deploy
```

## Local dev

```bash
cd frontend && python3 ../tools/server.py     # serves index.html on :8000
```

## Version bump

`tools/bump-version.sh` auto-increments `frontend/index.html`'s build number.
Wired as `.git/hooks/pre-push` — runs on every push to bump the version
inside the last commit.
