import apiWorker from "./api.js";

const UPSTREAM_ORIGIN = "https://cont-ra.github.io";
const UPSTREAM_PREFIX = "/_contora-sandbox";
const PUBLIC_PREFIX = "/vfx-tracker";

const API_PATHS = new Set([
  "/mcp",
  "/p",
  "/tg/push",
  "/tg/ping",
  "/tg/avatar",
  "/tg/track",
  "/tg/webhook",
  "/tg/setup-webhook",
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (API_PATHS.has(path) || path.startsWith("/r2/")) {
      return apiWorker.fetch(request, env, ctx);
    }

    if (path === PUBLIC_PREFIX || path.startsWith(PUBLIC_PREFIX + "/")) {
      return proxyToTracker(request, url);
    }

    return Response.redirect("https://sandbox.contora.net/vfx-tracker/main/", 302);
  },
};

const KNOWN_ASSET_ROOTS = new Set(["thumbs", "ffmpeg", "gif", "video", "assets", "static"]);

function resolveUpstreamPath(rest) {
  if (rest === "/" || rest === "") return "/";
  const hasExt = /\.[a-zA-Z0-9]{2,6}(?:$|\?|#)/.test(rest);
  if (!hasExt) return "/";
  const segs = rest.split("/").filter(Boolean);
  if (segs.length >= 2 && !KNOWN_ASSET_ROOTS.has(segs[0])) {
    return "/" + segs.slice(1).join("/");
  }
  return rest;
}

async function proxyToTracker(request, url) {
  const rest = url.pathname === PUBLIC_PREFIX ? "/" : url.pathname.slice(PUBLIC_PREFIX.length);
  const upstreamPath = resolveUpstreamPath(rest);
  const upstreamURL = new URL(UPSTREAM_ORIGIN + UPSTREAM_PREFIX + upstreamPath + url.search);

  const upstreamReq = new Request(upstreamURL.toString(), {
    method: request.method,
    headers: filterRequestHeaders(request.headers),
    body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
    redirect: "manual",
  });

  const resp = await fetch(upstreamReq);

  if ([301, 302, 307, 308].includes(resp.status)) {
    const loc = resp.headers.get("location");
    if (loc) {
      const target = new URL(loc, upstreamURL);
      if (target.origin === UPSTREAM_ORIGIN && target.pathname.startsWith(UPSTREAM_PREFIX)) {
        const localPath = PUBLIC_PREFIX + target.pathname.slice(UPSTREAM_PREFIX.length);
        const newHeaders = new Headers(resp.headers);
        newHeaders.set("location", localPath + target.search + target.hash);
        return new Response(null, { status: resp.status, headers: newHeaders });
      }
    }
  }

  const ct = resp.headers.get("content-type") || "";
  if (ct.includes("text/html") || ct.includes("text/css") || ct.includes("javascript") || ct.includes("application/json")) {
    let text = await resp.text();
    text = text
      .replaceAll(UPSTREAM_PREFIX + "/", PUBLIC_PREFIX + "/")
      .replaceAll(UPSTREAM_ORIGIN + PUBLIC_PREFIX, PUBLIC_PREFIX);

    const headers = new Headers(resp.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("content-security-policy");
    return new Response(text, { status: resp.status, statusText: resp.statusText, headers });
  }

  return resp;
}

function filterRequestHeaders(h) {
  const out = new Headers();
  for (const [k, v] of h.entries()) {
    const key = k.toLowerCase();
    if (key === "host" || key === "cf-connecting-ip" || key === "cf-ray" || key.startsWith("cf-")) continue;
    out.set(k, v);
  }
  out.set("host", "cont-ra.github.io");
  return out;
}
