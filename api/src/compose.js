// src/compose.js
//
// Inverse of decomposer.js — takes project_entities rows for one project
// and reconstructs the equivalent `tracker_state.data` blob.  Used by:
//   - src/parity.js scheduled cron
//   - supa-migration/scripts/roundtrip_test.mjs
//
// The decomposer/composer pair must stay byte-for-byte symmetric for the
// parity diff to stay at zero.  Every branch here has a twin in decomposer.js.

export function composeEntitiesIntoState(rows, projectId) {
  if (projectId === "_registry") return composeRegistry(rows);
  return composeProject(rows);
}

// ---------------------------------------------------------------------------
// Project compose
// ---------------------------------------------------------------------------

function composeProject(rows) {
  const state = {};

  // Partition by shot (entity_type=shot) vs children (parent_id=shotId).
  const shotRows      = [];
  const childrenByShot = new Map();
  const registryLike = [];  // system entities at project-level

  for (const r of rows) {
    if (r.entity_type === "shot") {
      shotRows.push(r);
      if (!childrenByShot.has(r.entity_id)) childrenByShot.set(r.entity_id, []);
    } else if (r.parent_id) {
      if (!childrenByShot.has(r.parent_id)) childrenByShot.set(r.parent_id, []);
      childrenByShot.get(r.parent_id).push(r);
    } else {
      registryLike.push(r);
    }
  }

  // --- shots ---------------------------------------------------------------
  for (const shot of shotRows) {
    const shotId = shot.entity_id;
    const p = { ...(shot.payload || {}) };
    const kids = childrenByShot.get(shotId) || [];

    const artistNotes = [];
    const playerNotes = [];
    const versions    = [];
    const fileHistory = [];
    const drawings    = {};

    for (const c of kids) {
      if (c.entity_type === "chat_msg") {
        const pl = c.payload || {};
        const { type, _seq, ...rest } = pl;
        if (type === "artist") artistNotes.push({ ...rest, _seq });
        else if (type === "player") playerNotes.push({ ...rest, _seq });
      } else if (c.entity_type === "version") {
        versions.push({ ...(c.payload || {}) });
      } else if (c.entity_type === "file_log") {
        fileHistory.push({ ...(c.payload || {}) });
      } else if (c.entity_type === "drawing") {
        // entity_id convention: "drawing_<shotId>_<dkey>".
        const prefix = "drawing_" + shotId + "_";
        const dkey = c.entity_id.startsWith(prefix) ? c.entity_id.slice(prefix.length) : c.entity_id;
        drawings[dkey] = c.payload;
      }
    }

    // Sort by internal _seq (decomposer stored original array index), then strip it.
    const bySeq = (a, b) => (a._seq ?? 0) - (b._seq ?? 0);
    artistNotes.sort(bySeq);  stripSeq(artistNotes);
    playerNotes.sort(bySeq);  stripSeq(playerNotes);
    versions.sort(bySeq);     stripSeq(versions);
    fileHistory.sort(bySeq);  stripSeq(fileHistory);

    if (artistNotes.length) p.artistNotes = artistNotes;
    if (playerNotes.length) p.playerNotes = playerNotes;
    if (versions.length)    p.versions    = versions;
    if (fileHistory.length) p.fileHistory = fileHistory;
    if (Object.keys(drawings).length) p.drawings = drawings;

    state[shotId] = p;
  }

  // --- system / registry-like rows ----------------------------------------
  const artistBuf = [];  // ARRAY-shaped in source, rebuild via _seq sort
  for (const r of registryLike) {
    const t = r.entity_type;
    if (t === "task_order" && r.entity_id === "__singleton") {
      state.__tasks = r.payload;
    } else if (t === "artist") {
      const { _seq, ...rest } = r.payload || {};
      artistBuf.push({ id: r.entity_id, seq: _seq ?? 0, payload: rest });
    } else if (t === "category") {
      (state.__categories ||= {})[r.entity_id] = r.payload;
    } else if (t === "read_state") {
      (state.__readState ||= {})[r.entity_id] = r.payload;
    } else if (t === "download_share") {
      (state.__downloadShares ||= {})[r.entity_id] = r.payload;
    } else if (t === "download_track") {
      (state.__downloadTracking ||= {})[r.entity_id] = r.payload;
    } else if (t === "meta") {
      state[r.entity_id] = r.payload;   // __admin, __bot, __users, + unknown __foo preserved verbatim
    }
    // Unknown entity_types (e.g., added in a future phase) are dropped here —
    // round-trip test will flag them.
  }
  if (artistBuf.length) {
    artistBuf.sort((a, b) => a.seq - b.seq);
    state.__artists = artistBuf.map(x => ({ id: x.id, ...x.payload }));
  }

  return state;
}

function stripSeq(arr) {
  for (const x of arr) { if (x && typeof x === "object" && "_seq" in x) delete x._seq; }
}

// ---------------------------------------------------------------------------
// Registry compose (plan §4.4)
// ---------------------------------------------------------------------------

function composeRegistry(rows) {
  const state = { users: {}, artists: [], projects: [], userProjects: {}, mcpTokens: [] };

  // Buffers to preserve original array order via `_seq`.
  const userProjectLinks = {};

  for (const r of rows) {
    switch (r.entity_type) {
      case "user":
        state.users[r.entity_id] = r.payload;
        break;
      case "artist":
        state.artists.push({ id: r.entity_id, ...(r.payload || {}) });
        break;
      case "project":
        state.projects.push({ id: r.entity_id, ...(r.payload || {}) });
        break;
      case "user_project": {
        const uid = r.payload?.user_id ?? r.entity_id.split(":")[0];
        const pid = r.payload?.project_id ?? r.entity_id.split(":").slice(1).join(":");
        const seq = r.payload?._seq ?? 0;
        (userProjectLinks[uid] ||= []).push({ pid, seq });
        break;
      }
      case "mcp_token":
        state.mcpTokens.push({ token: r.entity_id, ...(r.payload || {}) });
        break;
      default:
        // Unexpected row type in registry — ignore, round-trip test flags it.
        break;
    }
  }

  // Finalize userProjects: sort by _seq then drop seq.
  for (const uid of Object.keys(userProjectLinks)) {
    userProjectLinks[uid].sort((a, b) => a.seq - b.seq);
    state.userProjects[uid] = userProjectLinks[uid].map(x => x.pid);
  }

  return state;
}
