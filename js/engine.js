/* Squadgavel engine: money formatting, bid increments, and the team-rating algorithm. */
const MIN_BASE = 20; // lakhs; the lowest base price in the game, used to reserve purse for unfilled slots

function fmtMoney(l) {
  if (l >= 100) return '₹' + (Math.round(l) / 100).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
  return '₹' + l + ' L';
}
function bidIncrement(cur) {
  if (cur < 500) return 25;
  if (cur < 1500) return 50;
  return 100;
}

/* ---- Team rating algorithm ----
   1. From the squad, find the Best XI by brute force (every 11-player combination is scored).
   2. XI score = batting/bowling blend (50/50; Tests weigh bowling 55%, T20 deeper batting) + synergy adjustments:
      - Batting: top 9 batting ratings in the XI, weighted by batting position (openers/top order count most).
      - Bowling: top 6 bowling ratings, weighted (five front-line bowlers matter most, 6th is depth).
      - No specialist wicketkeeper: -4
      - Fewer than 4 genuine bowling options (bowl >= 55): -3.5 per missing option
      - All-rounders add balance: +0.8 each (max 3)
      - Chemistry: 4+ players from the same country: +0.6 per extra player (max +3)
   3. Squads with < 11 players are padded with zero-rated slots, which hurts naturally.
*/

function* combos(arr, k, start = 0, cur = []) {
  if (cur.length === k) { yield cur.slice(); return; }
  for (let i = start; i <= arr.length - (k - cur.length); i++) {
    cur.push(arr[i]);
    yield* combos(arr, k, i + 1, cur);
    cur.pop();
  }
}

function weighted(vals, W) {
  const s = vals.slice().sort((a, b) => b - a);
  let sum = 0, tot = 0;
  W.forEach((w, i) => { sum += w * (s[i] || 0); tot += w; });
  return sum / tot;
}

function scoreXI(xi) {
  const cfg = FORMAT_CFG[CUR_FORMAT];
  const bat = weighted(xi.map(p => p.bat), cfg.BAT_W);
  const bowl = weighted(xi.map(p => p.bowl), cfg.BOWL_W);
  let bonus = 0;
  const notes = [];
  if (!xi.some(p => p.role === 'WK')) { bonus -= 4; notes.push({ t: 'No specialist keeper', v: -4 }); }
  const options = xi.filter(p => p.bowl >= 55).length;
  if (options < 4) { const v = -(4 - options) * 3.5; bonus += v; notes.push({ t: `Only ${options} genuine bowling option${options === 1 ? '' : 's'}`, v }); }
  const ars = xi.filter(p => p.role === 'AR').length;
  if (ars) { const v = Math.min(ars, 3) * 0.8; bonus += v; notes.push({ t: `${ars} all-rounder${ars > 1 ? 's' : ''} add balance`, v }); }
  const counts = {};
  xi.forEach(p => { counts[p.cty] = (counts[p.cty] || 0) + 1; });
  const [topC, topN] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  if (topN >= 4) { const v = Math.min(3, (topN - 3) * 0.6); bonus += v; notes.push({ t: `${topN} ${CTY[topC].name} players gel together`, v }); }
  return { rating: (1 - cfg.bw) * bat + cfg.bw * bowl + bonus, bat, bowl, bonus, notes };
}

function evaluateSquad(pids) {
  const ps = pids.map(id => PLAYERS[id]);
  if (!ps.length) return { rating: 0, bat: 0, bowl: 0, bonus: 0, notes: [], xi: [], bench: [], captain: null };
  let best = null, bestXI = ps;
  if (ps.length <= 11) { best = scoreXI(ps); }
  else {
    for (const xi of combos(ps, 11)) {
      const s = scoreXI(xi);
      if (!best || s.rating > best.rating) { best = s; bestXI = xi; }
    }
  }
  if (ps.length < 11) {
    const miss = 11 - ps.length;
    const bw = FORMAT_CFG[CUR_FORMAT].bw;
    best.rating = ((1 - bw) * best.bat + bw * best.bowl) * (ps.length / 11) + best.bonus;
    best.notes.push({ t: `${miss} empty slot${miss > 1 ? 's' : ''} in the XI`, v: null });
  }
  // batting order: by batting rating, genuine bowlers pushed to the tail
  const xi = bestXI.slice().sort((a, b) => (a.role === 'BOWL') - (b.role === 'BOWL') || b.bat - a.bat);
  best.rating = Math.max(0, best.rating);
  const captain = xi.slice().sort((a, b) => b.ovr - a.ovr)[0];
  const inXI = new Set(xi.map(p => p.id));
  return { ...best, xi, bench: ps.filter(p => !inXI.has(p.id)), captain: captain && captain.id };
}

function winChance(rA, rB) { return 1 / (1 + Math.pow(10, (rB - rA) / 10)); }
