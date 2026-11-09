/* Squadgavel app: PeerJS networking (host-authoritative), auction logic, and UI. */
(() => {
const PREFIX = 'squadgavel-';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const COLORS = ['#f5c451', '#22d3a0', '#ff5d73', '#6aa8ff', '#c084fc', '#fb923c', '#2dd4ee', '#a3e635', '#f472b6', '#94a3b8'];
const MAX_MEMBERS = 10;
const $app = document.getElementById('app');

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
let cid = store.get('sqgv-cid');
if (!cid) { cid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); store.set('sqgv-cid', cid); }

let S = null;               // shared game state (host-authoritative)
let isHost = false;
let peer = null, hostConn = null;
const conns = new Map();    // host side: cid -> DataConnection
let ui = { busy: false, error: '', viewing: null, status: '', showHow: false, tab: 'squad' };
let joinTimer = null, retryTimer = null, retries = 0, leaving = false, gen = 0;
let tickHandle = null;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const me = () => S && S.members.find(m => m.id === cid);
const memberById = id => S && S.members.find(m => m.id === id);
const genCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

let toastEl = null, toastT = null;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

/* =========================================================
   Host: state + auction logic
   ========================================================= */
function poolPids() {
  const sel = POOLS.filter(p => S.settings.pools.includes(p.id));
  const set = new Set();
  sel.forEach(pl => PLAYERS.forEach(p => { if (pl.f(p)) set.add(p.id); }));
  return [...set];
}
function lotCount(poolSize) {
  const need = S.settings.size * S.members.length;
  const mult = { quick: 1.7, standard: 2.6, full: 999 }[S.settings.lots] || 2.6;
  return Math.min(poolSize, Math.max(Math.ceil(need * mult), need + 4));
}

function commit() {
  if (isHost && S) {
    const a = S.auction;
    if (a && a.lot && !a.lot.paused && a.lot.state === 'bidding') a.lot.left = Math.max(0, a.lot.endsAt - Date.now());
    S._t = Date.now();
    store.set('sqgv-host', { S });
    conns.forEach(c => { if (c.open) { try { c.send({ t: 'state', s: S }); } catch {} } });
  }
  render();
}

const nextAmt = lot => lot.bid ? lot.bid + bidIncrement(lot.bid) : PLAYERS[lot.pid].base;
const bidCap = () => (S.settings.cap ? Math.round(S.settings.purse * S.settings.cap / 100) : Infinity);
const maxBid = m => Math.min(bidCap(), m.purse - Math.max(0, S.settings.size - m.squad.length - 1) * MIN_BASE);
const canBid = (m, amt) => m.squad.length < S.settings.size && amt <= maxBid(m);

function checkQuick() {
  const lot = S.auction && S.auction.lot;
  if (!lot || lot.state !== 'bidding' || lot.paused) return;
  const amt = nextAmt(lot);
  const elig = S.members.filter(m => m.connected && !lot.passes.includes(m.id) && m.id !== lot.bidder && canBid(m, amt));
  if (!elig.length) lot.endsAt = Math.min(lot.endsAt, Date.now() + 1600);
}

function startAuction() {
  if (S.members.length < 2) return toast('Wait for at least one friend to join');
  const pool = poolPids();
  const need = S.settings.size * S.members.length;
  if (pool.length < need) return toast(`Pool too small: need ${need} players, only ${pool.length}`);
  const picked = shuffle(pool.slice()).slice(0, lotCount(pool.length));
  picked.sort((a, b) => PLAYERS[b].ovr - PLAYERS[a].ovr);
  const order = [];
  for (let i = 0; i < picked.length; i += 6) order.push(...shuffle(picked.slice(i, i + 6)));
  S.members.forEach(m => { m.purse = S.settings.purse; m.squad = []; });
  S.phase = 'auction';
  S.auction = { order, idx: -1, lot: null, history: [] };
  startLot(0);
  commit();
}

function startLot(idx) {
  const a = S.auction;
  if (idx >= a.order.length || !S.members.some(m => canBid(m, MIN_BASE))) return endAuction();
  a.idx = idx;
  a.lot = { pid: a.order[idx], bid: 0, bidder: null, state: 'bidding', passes: [], paused: false, endsAt: Date.now() + S.settings.timer * 1000 + (idx === 0 ? 3000 : 0), left: 0, nextAt: 0 };
  ui.viewing = null;
  checkQuick();
}
function endAuction() { S.phase = 'results'; S.auction.lot = null; commit(); }

function resolveLot() {
  const a = S.auction, lot = a.lot, p = PLAYERS[lot.pid];
  if (lot.bidder) {
    const m = memberById(lot.bidder);
    m.purse -= lot.bid; m.squad.push({ pid: lot.pid, price: lot.bid });
    lot.state = 'sold';
    a.history.unshift({ pid: lot.pid, buyer: m.id, price: lot.bid });
  } else {
    lot.state = 'unsold';
    a.history.unshift({ pid: lot.pid, buyer: null, price: 0 });
  }
  lot.left = 0; lot.nextAt = Date.now() + 3200;
  commit();
}

function hostTick() {
  if (!isHost || !S || S.phase !== 'auction' || !S.auction.lot) return;
  const lot = S.auction.lot, now = Date.now();
  if (lot.state === 'bidding' && !lot.paused && now >= lot.endsAt) resolveLot();
  else if (lot.state !== 'bidding' && now >= lot.nextAt) { startLot(S.auction.idx + 1); if (S.phase === 'auction') commit(); }
}

function doBid(id, amt) {
  if (!S || S.phase !== 'auction') return;
  const lot = S.auction.lot, m = memberById(id);
  if (!lot || !m || lot.state !== 'bidding' || lot.paused) return;
  if (lot.bidder === id || lot.passes.includes(id) || amt !== nextAmt(lot) || !canBid(m, amt)) return;
  lot.bid = amt; lot.bidder = id;
  lot.endsAt = Date.now() + S.settings.timer * 1000;
  checkQuick(); commit();
}
function doPass(id) {
  const lot = S && S.auction && S.auction.lot;
  if (!lot || lot.state !== 'bidding' || lot.bidder === id || lot.passes.includes(id)) return;
  lot.passes.push(id); checkQuick(); commit();
}

/* ---- host connection handling ---- */
function onHostData(conn, d) {
  if (!d || !S) return;
  if (d.t === 'join') {
    let m = memberById(d.cid);
    if (!m) {
      if (S.phase !== 'lobby') { conn.send({ t: 'err', msg: 'This auction has already started.' }); setTimeout(() => conn.close(), 300); return; }
      if (S.members.length >= MAX_MEMBERS) { conn.send({ t: 'err', msg: 'Room is full.' }); setTimeout(() => conn.close(), 300); return; }
      let name = String(d.name || 'Player').trim().slice(0, 16) || 'Player', n = name, i = 2;
      while (S.members.some(x => x.name.toLowerCase() === n.toLowerCase())) n = name + ' ' + i++;
      const used = new Set(S.members.map(x => x.color));
      const color = COLORS.findIndex((_, k) => !used.has(k));
      m = { id: d.cid, name: n, connected: true, host: false, color: color < 0 ? S.members.length % COLORS.length : color, purse: 0, squad: [] };
      S.members.push(m);
    } else m.connected = true;
    const old = conns.get(d.cid);
    if (old && old !== conn) { old.__replaced = true; try { old.close(); } catch {} }
    conns.set(d.cid, conn); conn.cid = d.cid;
    commit(); checkQuick(); return;
  }
  if (!conn.cid) return;
  if (d.t === 'bid') doBid(conn.cid, d.amt);
  else if (d.t === 'pass') doPass(conn.cid);
}
function onHostClose(conn) {
  if (conn.__replaced || !conn.cid || conns.get(conn.cid) !== conn || !S) return;
  conns.delete(conn.cid);
  const m = memberById(conn.cid);
  if (!m) return;
  if (S.phase === 'lobby') S.members = S.members.filter(x => x.id !== conn.cid);
  else { m.connected = false; checkQuick(); }
  commit();
}

function openHostPeer(code, restored, attempt = 0) {
  setBusy('Opening room…');
  peer = new Peer(PREFIX + code);
  peer.on('open', () => {
    isHost = true;
    S = restored || newState(code);
    store.set('sqgv-session', { code, host: true });
    ui.busy = false; ui.error = '';
    startTick(); commit();
  });
  peer.on('connection', conn => {
    conn.on('data', d => onHostData(conn, d));
    conn.on('close', () => onHostClose(conn));
    conn.on('error', () => onHostClose(conn));
  });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch {} });
  peer.on('error', e => {
    if (e.type === 'unavailable-id') {
      peer.destroy();
      if (!restored) return openHostPeer(genCode(), null);
      if (attempt < 8) { setBusy('Reclaiming room…'); return void setTimeout(() => openHostPeer(code, restored, attempt + 1), 2500); }
      S = null; setError('Could not reclaim that room. It may still be active elsewhere.');
    } else if (e.type !== 'peer-unavailable') {
      console.warn('peer error', e);
      if (!S) setError('Network error: ' + e.type);
    }
  });
}
function newState(code) {
  return {
    code, phase: 'lobby', _t: Date.now(),
    settings: { pools: ['all'], purse: 10000, size: 13, timer: 12, lots: 'standard', format: 'all', cap: 25 },
    members: [{ id: cid, name: ui.name, connected: true, host: true, color: 0, purse: 0, squad: [] }],
    auction: null
  };
}

/* =========================================================
   Client connection
   ========================================================= */
function joinRoom(code, name) {
  code = code.toUpperCase();
  leaving = false;
  const g = ++gen;
  setBusy('Connecting…');
  if (peer) { try { peer.destroy(); } catch {} }
  clearTimeout(joinTimer);
  peer = new Peer();
  joinTimer = setTimeout(() => { if (!S) { teardown(); setError('Room not found. Check the code and try again.'); } }, 12000);
  peer.on('open', () => {
    const conn = peer.connect(PREFIX + code, { reliable: true });
    hostConn = conn;
    conn.on('open', () => {
      conn.send({ t: 'join', cid, name });
      store.set('sqgv-session', { code, host: false, name });
    });
    conn.on('data', d => {
      if (g !== gen) return;
      if (d.t === 'state') {
        clearTimeout(joinTimer); retries = 0;
        const first = !S;
        S = d.s; S._t = Date.now(); isHost = false; ui.busy = false; ui.error = ''; ui.status = '';
        if (first) startTick();
        render();
      } else if (d.t === 'err') {
        clearTimeout(joinTimer); leaving = true; teardown(); setError(d.msg);
      } else if (d.t === 'closed') {
        leaving = true; teardown(); store.del('sqgv-session'); setError('The host closed the room.');
      }
    });
    conn.on('close', () => { if (g === gen) handleClientDrop(code, name); });
    conn.on('error', () => { if (g === gen) handleClientDrop(code, name); });
  });
  peer.on('error', e => {
    if (g !== gen) return;
    if (e.type === 'peer-unavailable') {
      if (S) return handleClientDrop(code, name);
      clearTimeout(joinTimer); teardown(); setError('Room not found. Check the code and try again.');
    } else if (e.type === 'network' || e.type === 'disconnected' || e.type === 'server-error' || e.type === 'socket-error') {
      if (S) handleClientDrop(code, name); else { clearTimeout(joinTimer); teardown(); setError('Could not reach the matchmaking server.'); }
    }
  });
}
function handleClientDrop(code, name) {
  if (leaving || !S) return;
  if (retries++ > 40) { teardown(); setError('Lost connection to the host.'); return; }
  ui.status = 'Reconnecting…'; render();
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { if (!leaving) joinRoom(code, name); }, 2000);
  // keep S so the UI stays visible while we retry; joinRoom() resets busy flag
  ui.busy = false;
}

function send(msg) { if (hostConn && hostConn.open) hostConn.send(msg); }

function teardown() {
  clearInterval(tickHandle); tickHandle = null;
  clearTimeout(retryTimer); clearTimeout(joinTimer);
  if (peer) { try { peer.destroy(); } catch {} }
  peer = null; hostConn = null; conns.clear(); S = null; isHost = false; ui.busy = false; ui.status = '';
}
function setBusy(msg) { ui.busy = msg; ui.error = ''; render(); }
function setError(msg) { ui.busy = false; ui.error = msg; render(); }
function leave() {
  leaving = true;
  if (isHost) { conns.forEach(c => { try { c.send({ t: 'closed' }); } catch {} }); store.del('sqgv-host'); }
  store.del('sqgv-session');
  teardown(); ui.error = ''; render();
}

function startTick() {
  clearInterval(tickHandle);
  tickHandle = setInterval(() => { hostTick(); updateTimer(); }, 150);
}

/* =========================================================
   Actions
   ========================================================= */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function act(a, el) {
  const d = el ? el.dataset : {};
  switch (a) {
    case 'host': {
      const name = readName(); if (!name) return;
      ui.name = name; store.set('sqgv-name', name);
      store.del('sqgv-host'); openHostPeer(genCode(), null); break;
    }
    case 'join': {
      const name = readName(); if (!name) return;
      const code = (document.getElementById('code').value || '').trim().toUpperCase();
      if (code.length !== 4) return setError('Enter the 4-letter room code.');
      ui.name = name; store.set('sqgv-name', name); joinRoom(code, name); break;
    }
    case 'rejoin': { const s = store.get('sqgv-session'); if (s) joinRoom(s.code, s.name || ui.name); break; }
    case 'resume': {
      const h = store.get('sqgv-host'); if (!h) return;
      const saved = h.S;
      saved.members.forEach(m => { m.connected = m.id === cid; });
      const lot = saved.auction && saved.auction.lot;
      if (lot && lot.state === 'bidding') lot.paused = true;
      else if (lot) lot.nextAt = Date.now() + 2000;
      ui.name = (saved.members.find(m => m.id === cid) || {}).name || ui.name;
      openHostPeer(saved.code, saved);
      break;
    }
    case 'leave': if (confirm(isHost ? 'Close the room for everyone?' : 'Leave this room?')) leave(); break;
    case 'dismiss': ui.error = ''; render(); break;
    case 'how': ui.showHow = !ui.showHow; render(); break;
    case 'copy': copyText(d.v, d.m || 'Copied'); break;

    /* lobby settings (host) */
    case 'pool': {
      const ps = S.settings.pools, i = ps.indexOf(d.id);
      if (i >= 0) { if (ps.length > 1) ps.splice(i, 1); } else ps.push(d.id);
      commit(); break;
    }
    case 'purse': S.settings.purse = +d.v; commit(); break;
    case 'size': S.settings.size = clamp(S.settings.size + +d.d, 11, 16); commit(); break;
    case 'timer': S.settings.timer = +d.v; commit(); break;
    case 'lots': S.settings.lots = d.v; commit(); break;
    case 'cap': S.settings.cap = +d.v; commit(); break;
    case 'format': S.settings.format = d.v; commit(); break;
    case 'kick': {
      const c = conns.get(d.id); if (c) { c.send({ t: 'err', msg: 'You were removed by the host.' }); setTimeout(() => c.close(), 200); }
      S.members = S.members.filter(m => m.id !== d.id); conns.delete(d.id); commit(); break;
    }
    case 'start': startAuction(); break;

    /* auction */
    case 'bid': {
      const lot = S.auction.lot; if (!lot) return;
      const amt = nextAmt(lot);
      if (isHost) doBid(cid, amt); else send({ t: 'bid', amt });
      break;
    }
    case 'pass': if (isHost) doPass(cid); else send({ t: 'pass' }); break;
    case 'pause': {
      const lot = S.auction.lot; if (!lot || lot.state !== 'bidding') return;
      if (lot.paused) { lot.paused = false; lot.endsAt = Date.now() + lot.left; }
      else { lot.left = Math.max(0, lot.endsAt - Date.now()); lot.paused = true; }
      commit(); break;
    }
    case 'skip': {
      const lot = S.auction.lot; if (!lot || lot.state !== 'bidding') return;
      lot.bid = 0; lot.bidder = null; lot.paused = false; resolveLot(); break;
    }
    case 'end': if (confirm('End the auction now and go to results?')) endAuction(); break;
    case 'view': ui.viewing = ui.viewing === d.id ? null : d.id; render(); break;
    case 'tab': ui.tab = d.v; render(); break;
    case 'again': {
      S.phase = 'lobby'; S.auction = null;
      S.members = S.members.filter(m => m.host || m.connected);
      S.members.forEach(m => { m.squad = []; m.purse = 0; }); commit(); break;
    }
  }
}
function readName() {
  const el = document.getElementById('name'); const v = (el.value || '').trim().slice(0, 16);
  if (!v) { setError('Pick a name first.'); return null; }
  return v;
}
function copyText(text, msg) {
  const done = () => toast(msg);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => prompt('Copy this:', text));
  else prompt('Copy this:', text);
}
$app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled) act(el.dataset.act, el);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'code') act('join');
  else if (e.key === 'Enter' && e.target.id === 'name') act(document.getElementById('code').value ? 'join' : 'host');
});

/* =========================================================
   Rendering
   ========================================================= */
function lotLeft() {
  const lot = S && S.auction && S.auction.lot;
  if (!lot || lot.state !== 'bidding') return 0;
  if (lot.paused) return lot.left;
  return Math.max(0, lot.left - (Date.now() - S._t));
}
function updateTimer() {
  const f = document.getElementById('tfill'), t = document.getElementById('ttext');
  if (!f || !S || !S.auction || !S.auction.lot) return;
  const left = lotLeft(), total = S.settings.timer * 1000;
  f.style.width = clamp(left / total * 100, 0, 100) + '%';
  t.textContent = S.auction.lot.paused ? 'PAUSED' : Math.ceil(left / 1000) + 's';
  f.parentElement.classList.toggle('urgent', left < 4000 && !S.auction.lot.paused && S.auction.lot.state === 'bidding');
}

const avatar = (m, cls = '') => `<span class="av ${cls}" style="--c:${COLORS[m.color % COLORS.length]}">${esc(m.name.charAt(0).toUpperCase())}</span>`;
const logo = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><g transform="rotate(-35 32 32)"><rect x="14" y="10" width="30" height="16"/><path d="M29 26v30M35 26v30"/></g><path d="M10 58h44"/></svg>`;
const ctyTag = p => `<span class="tag cty" style="--h:${CTY[p.cty].hue}">${p.cty}</span>`;
const roleTag = p => `<span class="tag role r-${p.role}">${ROLE_NAME[p.role]}</span>`;

function render() {
  const fmt = (S && S.settings && S.settings.format) || 'all';
  if (fmt !== CUR_FORMAT) applyFormat(fmt);
  if (!S) $app.innerHTML = viewLanding();
  else if (S.phase === 'lobby') $app.innerHTML = viewLobby();
  else if (S.phase === 'auction') $app.innerHTML = viewAuction();
  else $app.innerHTML = viewResults();
  updateTimer();
}

function viewLanding() {
  const sess = store.get('sqgv-session'), hosted = store.get('sqgv-host');
  const qroom = (new URLSearchParams(location.search).get('room') || '').toUpperCase().slice(0, 4);
  const nameVal = ui.name || store.get('sqgv-name') || '';
  const busy = ui.busy;
  return `
  <main class="landing">
    <div class="hero">
      ${logo}
      <h1>Squad<span>gavel</span></h1>
      <p class="tag-line">Host a cricket auction. Bid against your friends. Build the best XI.</p>
    </div>
    <section class="card entry">
      ${ui.error ? `<div class="alert" data-act="dismiss">${esc(ui.error)}</div>` : ''}
      <label class="lbl" for="name">Your name</label>
      <input id="name" maxlength="16" autocomplete="off" placeholder="e.g. Chintu" value="${esc(nameVal)}" ${busy ? 'disabled' : ''}>
      <button class="btn primary big" data-act="host" ${busy ? 'disabled' : ''}>${busy || 'Host a room'}</button>
      <div class="or"><span>or join a friend</span></div>
      <div class="row">
        <input id="code" class="code-in" maxlength="4" autocomplete="off" placeholder="CODE" value="${esc(qroom)}" ${busy ? 'disabled' : ''} oninput="this.value=this.value.toUpperCase()">
        <button class="btn" data-act="join" ${busy ? 'disabled' : ''}>Join</button>
      </div>
      ${sess && !sess.host ? `<button class="btn ghost wide" data-act="rejoin">Rejoin room ${esc(sess.code)}</button>` : ''}
      ${hosted ? `<button class="btn ghost wide" data-act="resume">Resume your room ${esc(hosted.S.code)}</button>` : ''}
    </section>
    <button class="linkbtn" data-act="how">${ui.showHow ? 'Hide' : 'How it works'}</button>
    ${ui.showHow ? `
    <section class="card how">
      <ol>
        <li><b>Host</b> creates a room and shares the 4-letter code.</li>
        <li>Pick a <b>player pool</b> (India All-Time, SENA, World Greats…), purse and squad size.</li>
        <li>Players go under the hammer one by one. <b>Outbid</b> your friends, or <b>pass</b>.</li>
        <li>When the dust settles, our algorithm picks each squad's <b>Best XI</b> and crowns a champion.</li>
      </ol>
    </section>` : ''}
    <footer>Peer-to-peer · no accounts · no servers of ours</footer>
  </main>`;
}

function topbar() {
  const m = me();
  return `<header class="top">
    <div class="brand">${logo}<span>Squad<b>gavel</b></span></div>
    <div class="room" data-act="copy" data-v="${esc(S.code)}" data-m="Code copied" title="Copy room code">ROOM <b>${esc(S.code)}</b></div>
    <div class="who">${m ? avatar(m) : ''}<button class="btn ghost sm" data-act="leave">${isHost ? 'Close' : 'Leave'}</button></div>
  </header>${ui.status ? `<div class="banner">${esc(ui.status)}</div>` : ''}`;
}

function chips(items, cur, act, key = 'v') {
  return items.map(([v, label]) => `<button class="chip ${String(cur) === String(v) ? 'on' : ''}" data-act="${act}" data-${key}="${v}" ${isHost ? '' : 'disabled'}>${label}</button>`).join('');
}

function viewLobby() {
  const st = S.settings, pool = poolPids(), need = st.size * S.members.length;
  const ok = pool.length >= need && S.members.length >= 2;
  const link = location.origin + location.pathname + '?room=' + S.code;
  const top = pool.map(i => PLAYERS[i]).sort((a, b) => b.ovr - a.ovr).slice(0, 10);
  return `${topbar()}
  <main class="lobby">
    <section class="card share">
      <div class="lbl">Room code</div>
      <div class="bigcode" data-act="copy" data-v="${esc(S.code)}" data-m="Code copied">${esc(S.code)}</div>
      <div class="row center">
        <button class="btn sm" data-act="copy" data-v="${esc(link)}" data-m="Invite link copied">Copy invite link</button>
      </div>
      <h3>Players <small>${S.members.length}/${MAX_MEMBERS}</small></h3>
      <ul class="plist">
        ${S.members.map(m => `<li>${avatar(m)}<span class="nm">${esc(m.name)}${m.id === cid ? ' <em>(you)</em>' : ''}</span>${m.host ? '<span class="pill">HOST</span>' : (isHost ? `<button class="x" title="Remove" data-act="kick" data-id="${m.id}">✕</button>` : '')}</li>`).join('')}
      </ul>
      ${S.members.length < 2 ? '<p class="muted">Share the code with friends — they join from this page.</p>' : ''}
    </section>
    <section class="card setup">
      <h2>${isHost ? 'Auction setup' : 'Auction setup <small>(host controls this)</small>'}</h2>
      <div class="lbl">Format <small>(re-rates every player and changes how teams are scored)</small></div>
      <div class="chips">${chips(Object.entries(FORMATS).map(([k, v]) => [k, v.label]), st.format || 'all', 'format')}</div>
      <div class="muted fdesc">${FORMATS[st.format || 'all'].desc}</div>
      <div class="lbl">Player pool <small>(combine as many as you like)</small></div>
      <div class="pools">
        ${POOLS.map(pl => `<button class="pool ${st.pools.includes(pl.id) ? 'on' : ''}" data-act="pool" data-id="${pl.id}" ${isHost ? '' : 'disabled'}>
          <span class="pn">${pl.name}</span><span class="pc">${pl.count}</span><span class="pd">${pl.desc}</span></button>`).join('')}
      </div>
      <div class="poolinfo ${pool.length >= need ? '' : 'bad'}">
        <b>${pool.length}</b> players in pool · need at least <b>${need}</b> (${st.size} × ${S.members.length})
        <div class="top-names">${top.map(p => `<span title="${p.ovr} OVR">${esc(p.name)}</span>`).join('')}</div>
      </div>
      <div class="grid2">
        <div><div class="lbl">Purse per player</div><div class="chips">${chips([[5000, '₹50 Cr'], [7500, '₹75 Cr'], [10000, '₹100 Cr'], [15000, '₹150 Cr']], st.purse, 'purse')}</div></div>
        <div><div class="lbl">Squad size</div>
          <div class="stepper"><button data-act="size" data-d="-1" ${isHost ? '' : 'disabled'}>−</button><b>${st.size}</b><button data-act="size" data-d="1" ${isHost ? '' : 'disabled'}>+</button></div></div>
        <div><div class="lbl">Bid timer</div><div class="chips">${chips([[8, '8s'], [12, '12s'], [20, '20s'], [30, '30s']], st.timer, 'timer')}</div></div>
        <div><div class="lbl">Max bid per player</div><div class="chips">${chips([[0, 'No cap'], [10, '10%'], [25, '25%'], [50, '50%']], st.cap || 0, 'cap')}</div>
          <div class="muted fdesc">${st.cap ? 'Capped at ' + fmtMoney(Math.round(st.purse * st.cap / 100)) + ' of the purse' : 'Bids limited only by purse'}</div></div>
        <div><div class="lbl">Auction length</div><div class="chips">${chips([['quick', 'Quick'], ['standard', 'Standard'], ['full', 'Full pool']], st.lots, 'lots')}</div></div>
      </div>
      ${isHost
        ? `<button class="btn primary big" data-act="start" ${ok ? '' : 'disabled'}>${S.members.length < 2 ? 'Waiting for friends…' : pool.length < need ? 'Pool too small' : 'Start the auction'}</button>`
        : '<div class="waiting"><span class="dots"><i></i><i></i><i></i></span> Waiting for the host to start…</div>'}
    </section>
  </main>`;
}

function viewAuction() {
  const a = S.auction, lot = a.lot, p = PLAYERS[lot.pid], m = me();
  const leader = lot.bidder ? memberById(lot.bidder) : null;
  const amt = nextAmt(lot);
  let btnLabel = `Bid ${fmtMoney(amt)}`, can = true, why = '';
  if (!m) { can = false; why = 'Spectating'; }
  else if (lot.state !== 'bidding') { can = false; }
  else if (lot.paused) { can = false; why = 'Auction paused'; }
  else if (lot.bidder === cid) { can = false; why = "You're the highest bidder"; }
  else if (lot.passes.includes(cid)) { can = false; why = 'You passed on this player'; }
  else if (m.squad.length >= S.settings.size) { can = false; why = 'Your squad is full'; }
  else if (amt > maxBid(m)) { can = false; why = amt > bidCap() ? 'Bid cap reached' : 'Not enough purse (slots reserved)'; }
  const bar = (v, cls) => `<div class="stat"><span>${cls === 'bat' ? 'Batting' : 'Bowling'}</span><div class="meter ${cls}"><i style="width:${v}%"></i></div><b>${v}</b></div>`;
  const view = ui.viewing && memberById(ui.viewing);
  const side = view || m;
  return `${topbar()}
  <main class="auction">
    <section class="stage">
      <div class="lotmeta">Lot <b>${a.idx + 1}</b> / ${a.order.length} · ${FORMATS[S.settings.format || 'all'].label} · Squad size ${S.settings.size}</div>
      <div class="pcard">
        <div class="ovr" style="--v:${p.ovr}"><span>${p.ovr}</span><small>OVR</small></div>
        <div class="pinfo">
          <h2>${esc(p.name)}</h2>
          <div class="tags">${ctyTag(p)}${roleTag(p)}<span class="tag era">${p.era === 'L' ? 'Legend' : 'Active'}</span></div>
          <div class="stats">${bar(p.bat, 'bat')}${bar(p.bowl, 'bowl')}</div>
        </div>
        <div class="base"><small>Base price</small><b>${fmtMoney(p.base)}</b></div>
      </div>
      <div class="bidbox ${lot.state}">
        ${lot.state === 'sold' ? `<div class="stamp sold">SOLD<small>to ${esc(leader ? leader.name : '?')} for ${fmtMoney(lot.bid)}</small></div>`
          : lot.state === 'unsold' ? `<div class="stamp unsold">UNSOLD</div>`
          : `<div class="curbid"><small>${lot.bid ? 'Current bid' : 'Opening bid'}</small><b>${fmtMoney(lot.bid || p.base)}</b>
              <div class="leader">${leader ? `${avatar(leader, 'sm')} <span style="color:${COLORS[leader.color % COLORS.length]}">${esc(leader.name)}</span>` : '<span class="muted">No bids yet</span>'}</div></div>
            <div class="timer"><div id="tfill"></div><span id="ttext"></span></div>
            <div class="btns">
              <button class="btn primary big" data-act="bid" ${can ? '' : 'disabled'}>${can ? btnLabel : (why || btnLabel)}</button>
              <button class="btn" data-act="pass" ${m && !lot.paused && lot.bidder !== cid && !lot.passes.includes(cid) && m.squad.length < S.settings.size ? '' : 'disabled'}>Pass</button>
            </div>`}
      </div>
      ${isHost ? `<div class="hostbar">
        <button class="btn sm" data-act="pause">${lot.paused ? 'Resume' : 'Pause'}</button>
        <button class="btn sm" data-act="skip" ${lot.state === 'bidding' ? '' : 'disabled'}>Skip lot</button>
        <button class="btn sm danger" data-act="end">End auction</button></div>` : ''}
      <div class="history"><h3>Recent</h3>
        ${a.history.slice(0, 6).map(h => { const hp = PLAYERS[h.pid], b = h.buyer && memberById(h.buyer);
          return `<div class="hrow"><span>${esc(hp.name)}</span>${b ? `<span class="sold-to" style="color:${COLORS[b.color % COLORS.length]}">${esc(b.name)} · ${fmtMoney(h.price)}</span>` : '<span class="muted">Unsold</span>'}</div>`; }).join('') || '<div class="muted">Nothing sold yet</div>'}
      </div>
    </section>
    <aside class="side">
      <div class="card teams"><h3>Teams</h3>
        ${S.members.map(t => `<div class="trow ${t.id === (side && side.id) ? 'sel' : ''} ${t.connected ? '' : 'off'}" data-act="view" data-id="${t.id}">
          ${avatar(t)}<div class="tm"><b>${esc(t.name)}${t.id === cid ? ' (you)' : ''}</b>
          <div class="slots">${Array.from({ length: S.settings.size }, (_, i) => `<i class="${i < t.squad.length ? 'f' : ''}"></i>`).join('')}</div></div>
          <div class="pr"><b>${fmtMoney(t.purse)}</b><small>${t.squad.length}/${S.settings.size}${t.connected ? '' : ' · offline'}</small></div></div>`).join('')}
      </div>
      ${side ? `<div class="card squad"><h3>${side.id === cid ? 'Your squad' : esc(side.name) + "'s squad"}${side.id === cid ? `<small>Max bid ${fmtMoney(Math.max(0, maxBid(side)))}</small>` : ''}</h3>
        ${side.squad.length ? side.squad.map(s => { const sp = PLAYERS[s.pid]; return `<div class="srow">${ctyTag(sp)}<span class="sn">${esc(sp.name)}</span><span class="pill r-${sp.role}">${sp.role}</span><b>${fmtMoney(s.price)}</b></div>`; }).join('') : '<div class="muted">No players yet</div>'}
      </div>` : ''}
    </aside>
  </main>`;
}

function viewResults() {
  const rows = S.members.map(m => {
    const ev = evaluateSquad(m.squad.map(s => s.pid));
    return { m, ev, spent: m.squad.reduce((a, s) => a + s.price, 0) };
  }).sort((a, b) => b.ev.rating - a.ev.rating);
  const champ = rows[0] && rows[0].ev.rating > 0 ? rows[0] : null;
  const all = S.members.flatMap(m => m.squad.map(s => ({ ...s, m, p: PLAYERS[s.pid] })));
  const priciest = all.slice().sort((a, b) => b.price - a.price)[0];
  const steal = all.filter(x => x.p.ovr >= 80 && x !== priciest).sort((a, b) => (a.price / a.p.base) - (b.price / b.p.base) || b.p.ovr - a.p.ovr)[0];
  const medals = [];
  return `${topbar()}
  <main class="results">
    <section class="champ card">
            ${champ ? `<div class="lbl">Champion squad</div>
      <h1>${esc(champ.m.name)}</h1>
      <div class="crating">${champ.ev.rating.toFixed(1)}<small>team rating</small></div>`
      : `<div class="lbl">No champion</div><h1>No squads built</h1><p class="muted">The auction ended before anyone built a team.</p>`}
      <div class="awards">
        ${priciest ? `<div class="award"><small>Most expensive</small><b>${esc(priciest.p.name)}</b><span>${fmtMoney(priciest.price)} · ${esc(priciest.m.name)}</span></div>` : ''}
        ${steal ? `<div class="award"><small>Steal of the auction</small><b>${esc(steal.p.name)}</b><span>${fmtMoney(steal.price)} (base ${fmtMoney(steal.p.base)}) · ${esc(steal.m.name)}</span></div>` : ''}
      </div>
    </section>
    ${rows.map((r, i) => {
      const e = r.ev, c = COLORS[r.m.color % COLORS.length];
      const chance = i === 0 || !champ ? null : Math.round(winChance(e.rating, champ.ev.rating) * 100);
      const price = id => (r.m.squad.find(s => s.pid === id) || {}).price || 0;
      return `<section class="card team ${i === 0 ? 'gold' : ''}" style="--c:${c}">
        <div class="thead">
          <div class="rank">${medals[i] || (i + 1)}</div>
          ${avatar(r.m)}
          <div class="tn"><h2>${esc(r.m.name)}${r.m.id === cid ? ' <em>(you)</em>' : ''}</h2><small>Spent ${fmtMoney(r.spent)} · ${fmtMoney(r.m.purse)} left${chance !== null ? ` · ${chance}% to beat the champion` : ''}</small></div>
          <div class="rt">${e.rating.toFixed(1)}</div>
        </div>
        <div class="parts">
          <div><small>Batting</small><div class="meter bat"><i style="width:${e.bat}%"></i></div><b>${e.bat.toFixed(1)}</b></div>
          <div><small>Bowling</small><div class="meter bowl"><i style="width:${e.bowl}%"></i></div><b>${e.bowl.toFixed(1)}</b></div>
          <div><small>Synergy</small><b class="${e.bonus >= 0 ? 'pos' : 'neg'}">${e.bonus >= 0 ? '+' : ''}${e.bonus.toFixed(1)}</b></div>
        </div>
        <div class="xi">${e.xi.map((p, k) => `<div class="xrow"><span class="n">${k + 1}</span>${ctyTag(p)}<span class="sn">${esc(p.name)}${p.id === e.captain ? ' <i class="cap">C</i>' : ''}${p.role === 'WK' ? ' <i class="cap wk">WK</i>' : ''}</span><span class="pill r-${p.role}">${p.role}</span><b class="ov">${p.ovr}</b><span class="pp">${fmtMoney(price(p.id))}</span></div>`).join('') || '<div class="muted">Empty squad</div>'}</div>
        ${e.bench.length ? `<div class="bench"><small>Bench:</small> ${e.bench.map(p => esc(p.name)).join(', ')}</div>` : ''}
        ${e.notes.length ? `<ul class="notes">${e.notes.map(n => `<li class="${n.v === null ? 'neg' : n.v >= 0 ? 'pos' : 'neg'}">${esc(n.t)}${n.v === null ? '' : ` <b>${n.v > 0 ? '+' : ''}${n.v.toFixed(1)}</b>`}</li>`).join('')}</ul>` : ''}
      </section>`;
    }).join('')}
    <section class="card algo"><h3>How the rating works</h3>
      <p>For every squad we test <b>every possible XI</b> and keep the strongest. An XI blends <b>batting and bowling</b> (50/50; Tests lean 55% on bowling) in the chosen format, where the top order and front-line bowlers carry the most weight, then adjusts for balance: a specialist keeper, at least four real bowling options, all-rounders, and national-team chemistry. Spend doesn't matter — only the team you built.</p>
    </section>
    <div class="actions">
      ${isHost ? '<button class="btn primary" data-act="again">New auction · same room</button>' : '<div class="muted">Waiting for host to start a new auction…</div>'}
      <button class="btn ghost" data-act="leave">${isHost ? 'Close room' : 'Leave'}</button>
    </div>
  </main>`;
}

/* ---- boot ---- */
ui.name = store.get('sqgv-name') || '';
window.addEventListener('beforeunload', () => { if (isHost && S) store.set('sqgv-host', { S }); });
render();
})();
