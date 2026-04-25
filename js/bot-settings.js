// Bot Settings panel rendering — extracted from index.html.
// Pure functions: caller passes everything via opts so the module never
// reaches into classic-script globals. Inline onclick="" handlers in the
// generated HTML still target classic-script functions (closeBotSettings,
// _saveBotSettings, _refreshBotStatus, _testBotPush) — those stay in
// index.html and resolve via window.

export function renderBotSettings(opts) {
  const { body, state, USERS, botPingData, cfg, cd, artists, esc } = opts;
  if (!body) return;
  let html = "";
  // ── STATUS ──
  html += `<div class="bot-section"><div class="bot-section-title">Status</div><div id="botStatusBox" class="bot-status">${renderBotStatusInner(botPingData, esc)}</div></div>`;
  // ── ARTISTS & TOPICS ──
  // Effective value: state override > worker hardcoded fallback (from /tg/ping)
  const workerThreads = botPingData?.threads || {};
  const hardcoded = botPingData?.hardcodedThreads || {};
  // Merge topic names: live worker discovery > cached state names
  const liveNames = (botPingData && botPingData !== "error" && botPingData.topicNames) || {};
  if (!cfg.topicNames) cfg.topicNames = {};
  // Persist any newly discovered names into state cache
  for (const k of Object.keys(liveNames)) {
    if (cfg.topicNames[k] !== liveNames[k]) cfg.topicNames[k] = liveNames[k];
  }
  // Build a sorted list of all known topics (live discovery + state cache + currently assigned)
  const allTopicIds = new Set([...Object.keys(liveNames), ...Object.keys(cfg.topicNames || {})]);
  artists.forEach(a => {
    const tid = cfg.artistThreads[a.id] || workerThreads[a.id] || hardcoded[a.id];
    if (tid) allTopicIds.add(String(tid));
  });
  const topicOptions = [...allTopicIds].map(tid => ({
    tid: parseInt(tid, 10),
    name: liveNames[tid] || cfg.topicNames[tid] || `Topic ${tid}`,
  })).sort((a, b) => a.name.localeCompare(b.name));
  // Build TG users dropdown options (live discovery + state cache)
  const liveTgUsers = (botPingData && botPingData !== "error" && botPingData.tgUsers) || [];
  const cachedTgUsers = cfg.tgUsers || [];
  const tgUserOptions = (() => {
    const byUsername = {};
    for (const u of cachedTgUsers) { if (u.username) byUsername[u.username.toLowerCase()] = u; }
    for (const u of liveTgUsers)   { if (u.username) byUsername[u.username.toLowerCase()] = u; }
    return Object.values(byUsername).sort((a, b) => (a.username || "").localeCompare(b.username || ""));
  })();
  html += `<div class="bot-section"><div class="bot-section-title">Artists &amp; Topics</div><div class="bot-section-hint">Pick the Telegram topic and the @username for each artist. Names are discovered from recent activity — if you don't see one, ask the person to send any message in the supergroup, then click <b>Refresh</b>.</div><table class="bot-artists-table"><thead><tr><th>Artist</th><th>Topic</th><th>@username</th><th></th></tr></thead><tbody>`;
  artists.forEach(a => {
    const stateTid = cfg.artistThreads[a.id];
    const effectiveTid = parseInt(stateTid || workerThreads[a.id] || hardcoded[a.id] || 0, 10);
    const isFallback = !stateTid && !!hardcoded[a.id];
    const fallbackHint = isFallback ? ` <span class="bot-artist-fallback">(default)</span>` : "";
    let optsHtml = `<option value="">— none —</option>`;
    topicOptions.forEach(o => {
      const sel = o.tid === effectiveTid ? " selected" : "";
      optsHtml += `<option value="${o.tid}"${sel}>${esc(o.name)}</option>`;
    });
    const tidLabel = effectiveTid ? `<span class="bot-thread-tag">id ${effectiveTid}</span>` : "";
    // Telegram username dropdown
    const currentTg = (state.__users?.[a.id]?.telegram || USERS[a.id]?.telegram || "").replace(/^@/, "").toLowerCase();
    let tgOpts = `<option value="">— none —</option>`;
    let foundCurrent = false;
    tgUserOptions.forEach(u => {
      const uname = u.username;
      const sel = uname.toLowerCase() === currentTg ? " selected" : "";
      if (sel) foundCurrent = true;
      const display = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || uname;
      tgOpts += `<option value="${esc(uname)}"${sel}>@${esc(uname)} — ${esc(display)}</option>`;
    });
    // If current TG isn't in the discovered list, add it as an "other" option so it stays selected
    if (currentTg && !foundCurrent) {
      tgOpts += `<option value="${esc(currentTg)}" selected>@${esc(currentTg)} (manual)</option>`;
    }
    html += `<tr><td>${esc(a.display)}<div class="bot-artist-id">${esc(a.id)}${fallbackHint}</div></td><td><select class="bot-topic-select" data-artist="${esc(a.id)}">${optsHtml}</select> ${tidLabel}</td><td><select class="bot-tguser-select" data-artist="${esc(a.id)}">${tgOpts}</select></td><td><button class="bot-test-btn" onclick="_testBotPush('${esc(a.id)}')">Test</button></td></tr>`;
  });
  html += `</tbody></table><div style="margin-top:8px;text-align:right"><button class="bot-test-btn" onclick="_refreshBotStatus()">↻ Refresh</button></div></div>`;
  // ── BOT CHATS / CHANNELS ──
  const botChats = botPingData && botPingData !== "error" ? (botPingData.tgChats || []) : [];
  if (botChats.length) {
    const activeChatId = botPingData?.chatId || "";
    const clientChats = new Set((cfg.clientChats || []).map(String));
    html += `<div class="bot-section"><div class="bot-section-title">Bot is in</div><div class="bot-section-hint">Mark a chat as <b>client</b> to enable the admin's "Push to client" button in the player.</div><div class="bot-discovered-list">`;
    botChats.forEach(c => {
      const cid = String(c.id);
      const isActive = cid === String(activeChatId);
      const isClient = clientChats.has(cid);
      const typeLabel = c.is_forum ? "forum" : (c.type || "");
      const tagColor = isActive ? "#3fb950" : "#484f58";
      const activeBadge = isActive ? ` <span style="color:#3fb950;font-size:9px;text-transform:uppercase;font-weight:600;margin-left:6px">● active</span>` : "";
      const clientBadge = isClient ? ` <span style="color:#d29922;font-size:9px;text-transform:uppercase;font-weight:600;margin-left:6px">★ client</span>` : "";
      const checkbox = isActive ? "" : `<label class="bot-chat-client-toggle" title="Mark as client chat"><input type="checkbox" class="bot-client-cb" data-chat="${esc(cid)}" ${isClient ? "checked" : ""}> client</label>`;
      html += `<div class="bot-discovered-item"><span class="m-name">${esc(c.title || c.first_name || "(no title)")}${activeBadge}${clientBadge}</span><span style="font-size:10px;color:${tagColor};text-transform:uppercase">${esc(typeLabel)}</span>${checkbox}<span class="m-at">${esc(cid)}</span></div>`;
    });
    html += `</div></div>`;
  }
  // ── DISCOVERED TELEGRAM USERS ──
  const discovered = botPingData && botPingData !== "error" ? (botPingData.tgUsers || []) : [];
  if (discovered.length) {
    html += `<div class="bot-section"><div class="bot-section-title">Discovered Telegram Users</div><div class="bot-section-hint">Pulled from recent activity. Use these handles in <b>Manage Users → Telegram</b> to enable @-mentions in pushes.</div><div class="bot-discovered-list">`;
    discovered.forEach(u => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.username || ("user " + u.id);
      const at = u.username ? `@${esc(u.username)}` : `<span style="color:#484f58">no username</span>`;
      html += `<div class="bot-discovered-item"><span class="m-name">${esc(name)}</span><span class="m-at">${at}</span></div>`;
    });
    html += `</div></div>`;
  }
  // ── COOLDOWNS ──
  html += `<div class="bot-section"><div class="bot-section-title">Cooldowns</div><div class="bot-section-hint">Time before the same person can push again.</div><div class="bot-cd-row"><label>Artist (no selection)</label><input type="number" id="cdArtist" value="${cd.artistMs / 1000}" min="0" step="1"><span>seconds</span></div><div class="bot-cd-row"><label>Admin (debounce)</label><input type="number" id="cdAdmin" value="${cd.adminMs / 1000}" min="0" step="0.1"><span>seconds</span></div></div>`;
  html += `<div class="bot-actions"><button class="bot-cancel-btn" onclick="closeBotSettings()">Cancel</button><button class="bot-save-btn" onclick="_saveBotSettings()">Save</button></div>`;
  body.innerHTML = html;
}

export function renderBotStatusInner(pingData, esc) {
  if (pingData === "error") return `<div><span class="bot-status-dot bot-status-fail"></span> Worker unreachable</div>`;
  if (!pingData) return `<span class="bot-status-dot bot-status-checking"></span> Checking worker…`;
  const d = pingData;
  const tokenOk = d.hasToken;
  const botName = d.bot ? `@${d.bot.username}` : "unknown";
  return `<div><span class="bot-status-dot bot-status-ok"></span> Worker reachable</div>` +
    `<div><span class="bot-status-dot ${tokenOk ? "bot-status-ok" : "bot-status-fail"}"></span> Token ${tokenOk ? "configured" : "missing"}</div>` +
    `<div><span class="bot-status-dot bot-status-ok"></span> Bot: ${esc(botName)} (id ${d.bot?.id || "?"})</div>` +
    `<div><span class="bot-status-dot bot-status-ok"></span> Chat: <code>${esc(d.chatId || "?")}</code></div>`;
}
