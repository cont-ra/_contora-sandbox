// src/decomposer.js
//
// Inverse of compose.js: take a tracker_state.data blob for one project
// and emit the per-entity rows that will populate public.project_entities.
//
// Pure function, no I/O.  Used by:
//   - supa-migration/scripts/roundtrip_test.mjs (Phase 0 Step 2)
//   - index.html inline _pushRemoteDualWrite (Phase 0 Step 3 — to be ported)
//
// Contract:
//   decomposeProjectState("_registry", data) -> registry rows
//   decomposeProjectState("<pid>", data)      -> project rows
//
// Every row has: { entity_type, entity_id, parent_type, parent_id, payload }
// parent_type+parent_id are paired: both null for root entities, both set for
// children (enforced by the parent_pair_check constraint on the DB side).
//
// ID strategy (REFACTOR_PLAN §5, confirmed by user at Phase 0 Step 2 spec):
//   - chat_msg : md5(shotId + "art_"+i+"_"+ts)  /  md5(shotId + "ply_"+i+"_"+ts)
//   - version  : md5(shotId + "_v_"+i+"_"+ts)
//   - file_log : md5(shotId + "_fh_"+i+"_"+ts+"_"+file)
//   - drawing  : "drawing_"+shotId+"_"+dictKey      (dictKey is the source-object key, e.g. "40")
//
// Sort-stability trick: child payloads carry an internal `_seq` = original
// array index.  Compose sorts by `_seq` then strips it.  Without this, ties
// in `ts` (especially fileHistory — minute resolution) break round-trip.

export const SHOT_SCALAR_KEYS = new Set([
  "status","desc","assignee","approvedVersion","adminNote",
  "priority","hidden","difficulty","cat",
]);

export const SHOT_INLINE_CONTAINER_KEYS = new Set([
  "files","shotInfo","playerPushed","clientPushed","userFolders",
]);

export const SHOT_EXTRACT_KEYS = new Set([
  "playerNotes","drawings","versions","fileHistory",
]);

// Kept as single-blob meta rows (entity_id == key).  Retains __users during
// Phase 0-3; Phase 4 migrates users into the registry and removes this.
export const META_BLOB_KEYS = new Set(["__bot","__users"]);

// Fan-out keys whose source shape is a DICT {subKey: payload}.
export const SYSTEM_FANOUT_DICT_KEYS = {
  __categories:       "category",
  __downloadShares:   "download_share",
  __downloadTracking: "download_track",
};

// __artists is an ARRAY of {id, display, ...} in both project-level and
// registry payloads — handled below like registry.artists, not like a dict.

// Dropped entirely — plan §4.3.  Parity diff also strips it.
export const DROP_KEYS = new Set(["__version"]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function decomposeProjectState(projectId, data) {
  if (projectId === "_registry") return decomposeRegistry(data);
  return decomposeProject(projectId, data);
}

// ---------------------------------------------------------------------------
// Project decomposition
// ---------------------------------------------------------------------------

function decomposeProject(projectId, data) {
  const rows = [];
  for (const key of Object.keys(data || {})) {
    const val = data[key];
    if (DROP_KEYS.has(key)) continue;

    // Legacy orphan key: `null` (JSON null serialized as string key "null")
    // is folded into a synthetic __orphan shot.  See plan §4.3.
    if (key === "null") {
      for (const r of decomposeShot("__orphan", val || {})) rows.push(r);
      continue;
    }

    if (key === "__tasks") {
      rows.push({ entity_type: "task_order", entity_id: "__singleton", parent_type: null, parent_id: null, payload: val });
      continue;
    }

    if (SYSTEM_FANOUT_DICT_KEYS[key]) {
      const entityType = SYSTEM_FANOUT_DICT_KEYS[key];
      for (const subKey of Object.keys(val || {})) {
        rows.push({ entity_type: entityType, entity_id: subKey, parent_type: null, parent_id: null, payload: val[subKey] });
      }
      continue;
    }

    // __artists: list of {id, display, ...}.  Same shape as __registry.artists.
    if (key === "__artists" && Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        const a = val[i] || {};
        const { id, ...rest } = a;
        rows.push({
          entity_type: "artist",
          entity_id:   id,
          parent_type: null, parent_id: null,
          payload:     { ...rest, _seq: i },
        });
      }
      continue;
    }

    if (META_BLOB_KEYS.has(key)) {
      rows.push({ entity_type: "meta", entity_id: key, parent_type: null, parent_id: null, payload: val });
      continue;
    }

    if (key.startsWith("__")) {
      // Unknown/unplanned system key — preserve verbatim so round-trip holds.
      rows.push({ entity_type: "meta", entity_id: key, parent_type: null, parent_id: null, payload: val });
      continue;
    }

    // Regular shot.
    for (const r of decomposeShot(key, val || {})) rows.push(r);
  }
  return rows;
}

function decomposeShot(shotId, shotData) {
  const rows = [];
  const payload = {};

  for (const key of Object.keys(shotData)) {
    const val = shotData[key];

    if (SHOT_EXTRACT_KEYS.has(key)) {
      if (key === "playerNotes" && Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          const note = val[i] ?? {};
          const ts = note.ts ?? 0;
          rows.push({
            entity_type: "chat_msg",
            entity_id:   md5(shotId + "ply_" + i + "_" + ts),
            parent_type: "shot", parent_id: shotId,
            payload:     { ...note, type: "player", _seq: i },
          });
        }
      } else if (key === "versions" && Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          const v = val[i] ?? {};
          const ts = v.ts ?? 0;
          rows.push({
            entity_type: "version",
            entity_id:   md5(shotId + "_v_" + i + "_" + ts),
            parent_type: "shot", parent_id: shotId,
            payload:     { ...v, _seq: i },
          });
        }
      } else if (key === "fileHistory" && Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          const e = val[i] ?? {};
          const ts = e.ts ?? "";
          const file = e.file ?? "";
          rows.push({
            entity_type: "file_log",
            entity_id:   md5(shotId + "_fh_" + i + "_" + ts + "_" + file),
            parent_type: "shot", parent_id: shotId,
            payload:     { ...e, _seq: i },
          });
        }
      } else if (key === "drawings" && val && typeof val === "object" && !Array.isArray(val)) {
        for (const dkey of Object.keys(val)) {
          rows.push({
            entity_type: "drawing",
            entity_id:   "drawing_" + shotId + "_" + dkey,
            parent_type: "shot", parent_id: shotId,
            payload:     val[dkey],
          });
        }
      }
      // Empty extractable (e.g., `drawings: {}` or `playerNotes: []`) emits
      // zero child rows.  Round-trip comparator normalises empty-vs-absent
      // on both sides so this is not drift.
      continue;
    }

    // Everything else (scalars + inline containers + unknown fields) goes
    // onto the shot's own payload verbatim.
    payload[key] = val;
  }

  rows.push({ entity_type: "shot", entity_id: shotId, parent_type: null, parent_id: null, payload });
  return rows;
}

// ---------------------------------------------------------------------------
// Registry decomposition (plan §4.4)
// ---------------------------------------------------------------------------

function decomposeRegistry(data) {
  const rows = [];
  data = data || {};

  // users is a dict {uid: {hash, display, role, ...}}.
  for (const uid of Object.keys(data.users || {})) {
    rows.push({ entity_type: "user", entity_id: uid, parent_type: null, parent_id: null, payload: data.users[uid] });
  }

  // artists is an array of {id, display, ...}; id becomes entity_id, the rest goes in payload.
  for (const a of (data.artists || [])) {
    const { id, ...rest } = a || {};
    rows.push({ entity_type: "artist", entity_id: id, parent_type: null, parent_id: null, payload: rest });
  }

  // projects: [{id, name, color, ...}]
  for (const p of (data.projects || [])) {
    const { id, ...rest } = p || {};
    rows.push({ entity_type: "project", entity_id: id, parent_type: null, parent_id: null, payload: rest });
  }

  // userProjects: {uid: [pid, ...]}  -> one (uid:pid) row per link.
  for (const uid of Object.keys(data.userProjects || {})) {
    const pids = data.userProjects[uid] || [];
    for (let i = 0; i < pids.length; i++) {
      rows.push({
        entity_type: "user_project",
        entity_id:   uid + ":" + pids[i],
        parent_type: null, parent_id: null,
        payload:     { user_id: uid, project_id: pids[i], _seq: i },
      });
    }
  }

  // mcpTokens: [{name, token, projects, ...}].  The token string is the id.
  for (const t of (data.mcpTokens || [])) {
    const { token, ...rest } = t || {};
    rows.push({ entity_type: "mcp_token", entity_id: token, parent_type: null, parent_id: null, payload: rest });
  }

  // __version dropped, nothing else in registry today.
  return rows;
}

// ---------------------------------------------------------------------------
// Pure-JS MD5 (Rivest RFC 1321).  Works in Node, Workers and browsers without
// any crypto imports.  32-char lowercase hex output.
// Validated against "abc" -> 900150983cd24fb0d6963f7d28e17f72 below.
// ---------------------------------------------------------------------------

export function md5(input) {
  const msg = unescape(encodeURIComponent(String(input)));
  const msgLen = msg.length;
  const nBlocks = ((msgLen + 8) >> 6) + 1;
  const buf = new Array(nBlocks * 16).fill(0);
  for (let i = 0; i < msgLen; i++) {
    buf[i >> 2] |= msg.charCodeAt(i) << ((i % 4) * 8);
  }
  buf[msgLen >> 2] |= 0x80 << ((msgLen % 4) * 8);
  buf[nBlocks * 16 - 2] = msgLen * 8;

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  const add = (x, y) => (x + y) & 0xffffffff;
  const rot = (x, n) => (x << n) | (x >>> (32 - n));
  const ff = (a, b, c, d, x, s, t) => add(rot(add(add(a, (b & c) | (~b & d)), add(x, t)), s), b);
  const gg = (a, b, c, d, x, s, t) => add(rot(add(add(a, (b & d) | (c & ~d)), add(x, t)), s), b);
  const hh = (a, b, c, d, x, s, t) => add(rot(add(add(a, b ^ c ^ d),         add(x, t)), s), b);
  const ii = (a, b, c, d, x, s, t) => add(rot(add(add(a, c ^ (b | ~d)),       add(x, t)), s), b);

  for (let i = 0; i < buf.length; i += 16) {
    const aa = a, bb = b, cc = c, dd = d;
    a = ff(a, b, c, d, buf[i+ 0], 7, 0xd76aa478);
    d = ff(d, a, b, c, buf[i+ 1],12, 0xe8c7b756);
    c = ff(c, d, a, b, buf[i+ 2],17, 0x242070db);
    b = ff(b, c, d, a, buf[i+ 3],22, 0xc1bdceee);
    a = ff(a, b, c, d, buf[i+ 4], 7, 0xf57c0faf);
    d = ff(d, a, b, c, buf[i+ 5],12, 0x4787c62a);
    c = ff(c, d, a, b, buf[i+ 6],17, 0xa8304613);
    b = ff(b, c, d, a, buf[i+ 7],22, 0xfd469501);
    a = ff(a, b, c, d, buf[i+ 8], 7, 0x698098d8);
    d = ff(d, a, b, c, buf[i+ 9],12, 0x8b44f7af);
    c = ff(c, d, a, b, buf[i+10],17, 0xffff5bb1);
    b = ff(b, c, d, a, buf[i+11],22, 0x895cd7be);
    a = ff(a, b, c, d, buf[i+12], 7, 0x6b901122);
    d = ff(d, a, b, c, buf[i+13],12, 0xfd987193);
    c = ff(c, d, a, b, buf[i+14],17, 0xa679438e);
    b = ff(b, c, d, a, buf[i+15],22, 0x49b40821);

    a = gg(a, b, c, d, buf[i+ 1], 5, 0xf61e2562);
    d = gg(d, a, b, c, buf[i+ 6], 9, 0xc040b340);
    c = gg(c, d, a, b, buf[i+11],14, 0x265e5a51);
    b = gg(b, c, d, a, buf[i+ 0],20, 0xe9b6c7aa);
    a = gg(a, b, c, d, buf[i+ 5], 5, 0xd62f105d);
    d = gg(d, a, b, c, buf[i+10], 9, 0x02441453);
    c = gg(c, d, a, b, buf[i+15],14, 0xd8a1e681);
    b = gg(b, c, d, a, buf[i+ 4],20, 0xe7d3fbc8);
    a = gg(a, b, c, d, buf[i+ 9], 5, 0x21e1cde6);
    d = gg(d, a, b, c, buf[i+14], 9, 0xc33707d6);
    c = gg(c, d, a, b, buf[i+ 3],14, 0xf4d50d87);
    b = gg(b, c, d, a, buf[i+ 8],20, 0x455a14ed);
    a = gg(a, b, c, d, buf[i+13], 5, 0xa9e3e905);
    d = gg(d, a, b, c, buf[i+ 2], 9, 0xfcefa3f8);
    c = gg(c, d, a, b, buf[i+ 7],14, 0x676f02d9);
    b = gg(b, c, d, a, buf[i+12],20, 0x8d2a4c8a);

    a = hh(a, b, c, d, buf[i+ 5], 4, 0xfffa3942);
    d = hh(d, a, b, c, buf[i+ 8],11, 0x8771f681);
    c = hh(c, d, a, b, buf[i+11],16, 0x6d9d6122);
    b = hh(b, c, d, a, buf[i+14],23, 0xfde5380c);
    a = hh(a, b, c, d, buf[i+ 1], 4, 0xa4beea44);
    d = hh(d, a, b, c, buf[i+ 4],11, 0x4bdecfa9);
    c = hh(c, d, a, b, buf[i+ 7],16, 0xf6bb4b60);
    b = hh(b, c, d, a, buf[i+10],23, 0xbebfbc70);
    a = hh(a, b, c, d, buf[i+13], 4, 0x289b7ec6);
    d = hh(d, a, b, c, buf[i+ 0],11, 0xeaa127fa);
    c = hh(c, d, a, b, buf[i+ 3],16, 0xd4ef3085);
    b = hh(b, c, d, a, buf[i+ 6],23, 0x04881d05);
    a = hh(a, b, c, d, buf[i+ 9], 4, 0xd9d4d039);
    d = hh(d, a, b, c, buf[i+12],11, 0xe6db99e5);
    c = hh(c, d, a, b, buf[i+15],16, 0x1fa27cf8);
    b = hh(b, c, d, a, buf[i+ 2],23, 0xc4ac5665);

    a = ii(a, b, c, d, buf[i+ 0], 6, 0xf4292244);
    d = ii(d, a, b, c, buf[i+ 7],10, 0x432aff97);
    c = ii(c, d, a, b, buf[i+14],15, 0xab9423a7);
    b = ii(b, c, d, a, buf[i+ 5],21, 0xfc93a039);
    a = ii(a, b, c, d, buf[i+12], 6, 0x655b59c3);
    d = ii(d, a, b, c, buf[i+ 3],10, 0x8f0ccc92);
    c = ii(c, d, a, b, buf[i+10],15, 0xffeff47d);
    b = ii(b, c, d, a, buf[i+ 1],21, 0x85845dd1);
    a = ii(a, b, c, d, buf[i+ 8], 6, 0x6fa87e4f);
    d = ii(d, a, b, c, buf[i+15],10, 0xfe2ce6e0);
    c = ii(c, d, a, b, buf[i+ 6],15, 0xa3014314);
    b = ii(b, c, d, a, buf[i+13],21, 0x4e0811a1);
    a = ii(a, b, c, d, buf[i+ 4], 6, 0xf7537e82);
    d = ii(d, a, b, c, buf[i+11],10, 0xbd3af235);
    c = ii(c, d, a, b, buf[i+ 2],15, 0x2ad7d2bb);
    b = ii(b, c, d, a, buf[i+ 9],21, 0xeb86d391);

    a = add(a, aa); b = add(b, bb); c = add(c, cc); d = add(d, dd);
  }

  const hex = x => {
    let s = "";
    for (let i = 0; i < 4; i++) {
      s += ("0" + (((x >> (i * 8)) & 0xff).toString(16))).slice(-2);
    }
    return s;
  };
  return hex(a) + hex(b) + hex(c) + hex(d);
}
