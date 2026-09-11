"use strict";
const app = document.getElementById("app");
const SHIELD = `<svg viewBox="0 0 100 128" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 3 C62 3 78 6 92 11 C93 42 89 80 50 124 C11 80 7 42 8 11 C22 6 38 3 50 3 Z" fill="#013369" stroke="#fff" stroke-width="4"/>
  <path d="M14 64 L86 64 C81 91 68 110 50 122 C32 110 19 91 14 64 Z" fill="#fff"/>
  <g transform="rotate(-32 50 31)"><ellipse cx="50" cy="31" rx="14.5" ry="8.2" fill="#fff"/>
    <line x1="42" y1="31" x2="58" y2="31" stroke="#013369" stroke-width="1.5"/>
    <line x1="46" y1="28.6" x2="46" y2="33.4" stroke="#013369" stroke-width="1.5"/>
    <line x1="50" y1="28.2" x2="50" y2="33.8" stroke="#013369" stroke-width="1.5"/>
    <line x1="54" y1="28.6" x2="54" y2="33.4" stroke="#013369" stroke-width="1.5"/></g>
  <text x="50" y="99" fill="#D50A0A" font-family="'Saira Condensed',Arial" font-weight="800" font-size="33" text-anchor="middle" letter-spacing="-1.5">NFL</text></svg>`;
let INDEX = null;
const cache = {};
const esc = s => (s == null ? "" : String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
const nz = v => (v == null || v === "" ? "—" : v);

async function getJSON(u) { if (cache[u]) return cache[u]; const r = await fetch(u); const j = await r.json(); cache[u] = j; return j; }

function topbar() {
  return `<div class="topbar"><div class="inner">
    <div class="brand" onclick="go('')"><div>${SHIELD}</div>
      <div><div class="t1">Game Board</div><div class="t2">2026 · Projections</div></div></div>
    <div class="spacer"></div>
    <div class="navbtn" onclick="go('')">Games</div>
    <div class="navbtn" onclick="go('teams')">Teams</div>
  </div></div>`;
}
function go(hash) { location.hash = hash ? "#/" + hash : "#/"; }
window.go = go;

/* ---------------- home / slate ---------------- */
let CURWEEK = null;
async function home() {
  if (!INDEX) INDEX = await getJSON("data/index.json");
  if (CURWEEK == null) CURWEEK = INDEX.weeks[0];
  render(slateView());
}
function slateView() {
  const wk = CURWEEK;
  const pills = INDEX.weeks.map(w =>
    `<div class="weekpill ${w === wk ? "on" : ""}" onclick="setWeek(${w})">Wk ${w}</div>`).join("");
  const games = INDEX.games[String(wk)] || [];
  let out = `<div class="pagehead"><h1>Week ${wk}</h1><span class="sub">${INDEX.season} · ${games.length} games</span></div>
    <div class="weekbar">${pills}</div>`;
  let day = null, body = "";
  for (const g of games) {
    if (g.gameday !== day) { day = g.gameday; body += `</div><div class="daylabel">${esc(day)}</div><div class="grid">`; }
    body += gameCard(g);
  }
  out += `<div class="grid" style="display:none"></div>` + body.replace(/^<\/div>/, "") + "</div>";
  return `<div class="wrap">${out}</div>`;
}
function setWeek(w) { CURWEEK = w; render(slateView()); window.scrollTo(0, 0); }
window.setWeek = setWeek;

function gameCard(g) {
  const favTag = `<span class="gchip"><b>${esc(g.fav)}</b> −${Math.abs(g.spread).toFixed(1)}</span>`;
  const teaser = g.headline
    ? `<div class="teaser"><span class="dot"></span>${esc(g.headline)}<span class="n">${g.n_edges} edge${g.n_edges === 1 ? "" : "s"}</span></div>`
    : "";
  return `<div class="gcard" style="--ca:${g.away_col};--cb:${g.home_col}" onclick="go('g/${g.gid}')">
    <div class="edge-strip"></div>
    <div class="body">
      <div class="kick">${esc(g.kickoff)}</div>
      <div class="matchup">
        <div class="tm"><div class="pt" style="color:${g.away_col}">${g.apts}</div><div class="ab" style="color:${g.away_col}">${esc(g.away)}</div></div>
        <div class="at">AT</div>
        <div class="tm"><div class="pt" style="color:${g.home_col}">${g.hpts}</div><div class="ab" style="color:${g.home_col}">${esc(g.home)}</div></div>
      </div>
      <div class="meta">${favTag}<span class="gchip">O/U ${g.total.toFixed(1)}</span>${g.roof ? `<span class="gchip">${esc(g.roof)}</span>` : ""}</div>
      ${teaser}
    </div></div>`;
}

/* ---------------- game view ---------------- */
/* ---------------- injury tool: client-side redistribute + recompute ---------------- */
const MK = {
  QB: [["Pass yards", "pass_yards"], ["Pass TDs", "pass_td"]],
  RB: [["Rush yards", "rush_yards"], ["Carries", "rush_att"], ["Rec yards", "rec_yards"], ["Receptions", "receptions"]],
  WR: [["Rec yards", "rec_yards"], ["Receptions", "receptions"], ["Targets", "targets"]],
  TE: [["Rec yards", "rec_yards"], ["Receptions", "receptions"], ["Targets", "targets"]],
};
const LV = [.10, .25, .50, .75, .90];
const escAttr = s => String(s).replace(/[&"'<>]/g, c => ({ "&": "&amp;", '"': "&quot;", "'": "&#39;", "<": "&lt;", ">": "&gt;" }[c]));
function interp(x, xs, ys) {
  const n = xs.length; if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
  for (let i = 1; i < n; i++) if (x <= xs[i]) { const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + t * (ys[i] - ys[i - 1]); }
  return ys[n - 1];
}
const qAt = (e, l) => e.q ? interp(l, LV, e.q) : e.m;
const pOver = e => (!e.q || e.line == null) ? null : Math.min(1, Math.max(0, 1 - interp(e.line, e.q, LV)));
const decToAm = d => (!d || d <= 1) ? null : (d >= 2 ? "+" + Math.round((d - 1) * 100) : "−" + Math.round(100 / (d - 1)));
function propVal(e) {
  const po = pOver(e); if (po == null) return { call: null, ev: null, po: null };
  const od = e.od || 1.909, ud = e.ud || 1.909, th = 0.04, eo = po * od - 1, eu = (1 - po) * ud - 1;
  if (eo >= th && eo >= eu) return { call: "OVER", ev: eo, po };
  if (eu >= th && eu > eo) return { call: "UNDER", ev: eu, po };
  return { call: "none", ev: Math.max(eo, eu), po };
}
const r1 = x => Math.round(x * 10) / 10;
function buildMkt(lbl, e) {
  const m = { label: lbl, proj: r1(e.m), book: e.line, over_th: r1(qAt(e, 0.45)), under_th: r1(qAt(e, 0.55)),
    over_am: null, under_am: null, pover: null, call: null, ev: null, skew: false };
  if (e.line != null) {
    const r = propVal(e); m.call = r.call; m.ev = r.ev != null ? r1(r.ev * 100) : null;
    m.pover = r.po != null ? Math.round(r.po * 100) : null; m.over_am = decToAm(e.od); m.under_am = decToAm(e.ud);
    const gap = e.m - e.line, dis = (m.call === "UNDER" && gap > 0) || (m.call === "OVER" && gap < 0), near = Math.abs(gap) <= 0.03 * e.line;
    m.skew = (m.call === "OVER" || m.call === "UNDER") && m.pover != null && (dis || (near && Math.abs(m.pover - 50) >= 5));
  }
  return m;
}
function redistribute(players, outSet) {
  for (const [pos, vol, deps] of [[["WR", "TE", "RB"], "targets", ["targets", "receptions", "rec_yards"]], [["RB"], "rush_att", ["rush_att", "rush_yards"]]]) {
    const pool = players.filter(p => pos.includes(p.pos));
    const vac = pool.filter(p => outSet.has(p.name)).reduce((s, p) => s + ((p.d[vol] && p.d[vol].m) || 0), 0);
    const avail = pool.filter(p => !outSet.has(p.name));
    const base = avail.reduce((s, p) => s + ((p.d[vol] && p.d[vol].m) || 0), 0);
    if (vac > 0 && base > 0) { const f = (base + vac) / base; for (const p of avail) for (const s of deps) { const e = p.d[s]; if (e) { e.m *= f; if (e.q) e.q = e.q.map(x => x * f); } } }
  }
  for (const p of players) if (outSet.has(p.name)) { for (const s in p.d) { p.d[s].m = 0; if (p.d[s].q) p.d[s].q = p.d[s].q.map(() => 0); } if (p.td) p.td.pct = 0; }
}
function computeTeams(g, outSet) {
  const teams = g.teams.map(tb => ({ team: tb.team, col: tb.col, players: tb.players.map(p => ({ name: p.name, pos: p.pos, starter: p.starter, minor: p.minor, td: p.td ? { ...p.td } : null, d: JSON.parse(JSON.stringify(p.d || {})) })) }));
  for (const tb of teams) redistribute(tb.players, outSet);
  for (const tb of teams) for (const p of tb.players) {
    p.markets = (MK[p.pos] || []).map(([l, s]) => (p.d[s] && p.d[s].m > 0.3) ? buildMkt(l, p.d[s]) : null).filter(Boolean);
    p.out = outSet.has(p.name);
  }
  return teams;
}
const getOut = gid => { try { return new Set(JSON.parse(localStorage.getItem("inj:" + gid) || "[]")); } catch (e) { return new Set(); } };
const saveOut = (gid, s) => { try { localStorage.setItem("inj:" + gid, JSON.stringify([...s])); } catch (e) {} };
let CUR = { gid: null, g: null };
async function game(gid) {
  let g;
  try { g = await getJSON(`data/game/${gid}.json`); } catch (e) { render(`<div class="wrap"><div class="empty">Game not found.</div></div>`); return; }
  CUR = { gid, g }; paintGame(true);
}
function toggleOut(name) { const s = getOut(CUR.gid); s.has(name) ? s.delete(name) : s.add(name); saveOut(CUR.gid, s); const y = window.scrollY; paintGame(false); window.scrollTo(0, y); }
window.clearOut = function () { saveOut(CUR.gid, new Set()); const y = window.scrollY; paintGame(false); window.scrollTo(0, y); };

function paintGame(scroll) {
  const g = CUR.g, outSet = getOut(CUR.gid), teams = computeTeams(g, outSet);
  const favA = g.spread < 0, favH = g.spread > 0;
  const hero = `<div class="hero" style="--ca:${g.away_col};--cb:${g.home_col}">
    <div class="eye">Week ${g.week} · Projected Final</div>
    <div class="score">
      <div class="tm ${favA ? "fav" : ""}"><div class="pt" style="color:${g.away_col}">${g.apts}</div><div class="ab" style="color:${g.away_col}">${esc(g.away)}</div></div>
      <div class="at">AT</div>
      <div class="tm ${favH ? "fav" : ""}"><div class="pt" style="color:${g.home_col}">${g.hpts}</div><div class="ab" style="color:${g.home_col}">${esc(g.home)}</div></div></div>
    <div class="chips"><span class="chip">${esc(g.kickoff)}</span><span class="chip"><b>${esc(g.fav)}</b> −${Math.abs(g.spread).toFixed(1)}</span>
      <span class="chip">O/U <b>${g.total.toFixed(1)}</b></span>${g.roof ? `<span class="chip">${esc(g.roof)}</span>` : ""}</div></div>`;
  const outArr = [...outSet];
  const injbar = `<div class="injbar">🩹 <b>Injury tool</b> — tick a player to mark him <b>OUT</b>; his targets/carries redistribute to teammates and every call recomputes live.`
    + (outArr.length ? ` <span class="injout">OUT: ${outArr.map(esc).join(", ")}</span> <span class="injclear" onclick="clearOut()">clear all</span>` : "") + `</div>`;
  let proj = `<div class="seclabel">Projections vs the Book</div>` + injbar
    + `<p class="note" style="margin:8px 0 14px">Row reads: <b>our mean</b> vs <b>book line</b> · price · <b>%&#8593;</b> = our chance of going <b>over</b> (drives the call, not the mean).</p>`;
  let tdboard = `<div class="seclabel">Anytime Touchdown — Fair vs Book</div><div class="tdgrid">`;
  for (const tb of teams) {
    proj += `<div class="teamhdr" style="--tc:${tb.col}">${esc(tb.team)}</div><div class="pcards">`;
    for (const p of tb.players) proj += playerCard(p);
    proj += `</div>`;
    for (const p of tb.players) if (p.td && !p.out && p.td.pct) tdboard += tdCard(p, tb.team);
  }
  tdboard += `</div>`;
  render(`${topbar()}<div class="wrap"><div class="back" onclick="go('')">← back to the slate</div>${hero}
    <div class="seclabel">The Match Report</div><div class="report">${g.report_html}</div>${proj}${tdboard}
    <p class="note">Book = live consensus line across books. Calls assume ≈ −110. TD props are noisy — treat as a lean.</p></div>`);
  if (scroll) window.scrollTo(0, 0);
}

function playerCard(p) {
  const box = `<span class="injbox ${p.out ? "on" : ""}" data-inj="${escAttr(p.name)}" title="mark OUT / back in">${p.out ? "✕" : ""}</span>`;
  const mark = p.starter ? `<span class="star">★</span>` : `<span class="diamond">◆</span>`;
  if (p.out) {
    return `<div class="pcard out"><div class="ph">${box}<span class="slot">${esc(p.pos)}</span><span class="pn">${esc(p.name)}</span><span class="outtag">OUT — redistributed</span></div></div>`;
  }
  const mk = p.markets.map(m => {
    let nums, pill;
    if (m.book != null) {
      const price = (m.over_am || m.under_am)
        ? `<span class="odds">${esc(m.over_am || "")}/${esc(m.under_am || "")}</span>` : "";
      const pov = m.pover != null
        ? `<span class="pov" title="our modelled chance of going OVER the line — drives the call, not the mean">${m.pover}%&#8593;</span>` : "";
      nums = `<b>${m.proj}</b><span class="vs">vs</span><span class="bk">${m.book}</span>${price}${pov}`;
      const ev = m.ev != null && m.ev > 0 ? ` +${m.ev}%` : "";
      const side = m.call === "OVER" ? "over" : "under";
      const skew = m.skew
        ? `<span class="skew" title="Skewed line: the mean sits at the line, but the distribution leans ${side} — the call follows the %&#8593; probability, not the mean.">skew</span>` : "";
      if (m.call === "OVER") pill = `${skew}<span class="pill over" title="EV at the posted over price">Over${ev}</span>`;
      else if (m.call === "UNDER") pill = `${skew}<span class="pill under" title="EV at the posted under price">Under${ev}</span>`;
      else pill = `<span class="pill none">fair</span>`;
    } else {
      nums = `<b>${m.proj}</b> <span class="noline">· no line</span>`;
      pill = `<span class="pill na">${m.over_th}–${m.under_th}</span>`;
    }
    return `<div class="mkt"><span class="lbl">${esc(m.label)}</span><span class="nums">${nums}</span>${pill}</div>`;
  }).join("");
  const td = p.td && p.td.pct
    ? `<div class="tdbadge">TD <b>${p.td.pct}%</b><br>${p.td.book ? `${esc(p.td.book)} ${p.td.value ? '<span class="val">●</span>' : ""}` : `fair ${esc(p.td.fair)}`}</div>`
    : "";
  return `<div class="pcard ${p.minor ? "minor" : ""}">
    <div class="ph">${box}<span class="slot">${esc(p.pos)}</span><span class="pn">${esc(p.name)}</span>${mark}${td}</div>
    ${mk}</div>`;
}
function tdCard(p, team) {
  const t = p.td;
  return `<div class="tdc ${t.value ? "value" : ""}">
    ${t.value ? `<span class="valbadge">Value</span>` : ""}
    <div class="tn">${esc(p.name)}</div><div class="tt">${esc(team)} · ${esc(p.pos)}</div>
    <div class="pctbar"><i style="width:${Math.min(100, t.pct * 2)}%"></i></div>
    <div class="trow"><div><span class="k">Model</span><span class="v">${t.pct}%</span></div>
      <div><span class="k">Fair</span><span class="v">${esc(t.fair)}</span></div>
      <div><span class="k">Book</span><span class="v">${t.book ? esc(t.book) : "—"}</span></div></div></div>`;
}

/* ---------------- teams index ---------------- */
async function teams() {
  if (!INDEX) INDEX = await getJSON("data/index.json");
  const cards = INDEX.teamlist.map(t => `<div class="gcard" style="--ca:${t.col};--cb:${t.col}" onclick="go('t/${t.abbr}')">
    <div class="edge-strip"></div><div class="body" style="text-align:center;padding:22px">
    <div class="matchup" style="margin:0"><div class="tm"><div class="ab" style="color:${t.col};font-size:34px">${t.abbr}</div></div></div>
    </div></div>`).join("");
  render(`${topbar()}<div class="wrap"><div class="pagehead"><h1>Team Dossiers</h1><span class="sub">32 teams</span></div>
    <div class="grid">${cards}</div></div>`);
  window.scrollTo(0, 0);
}

/* ---------------- team view ---------------- */
async function team(abbr) {
  let t;
  try { t = await getJSON(`data/team/${abbr}.json`); } catch (e) { render(`<div class="wrap"><div class="empty">Team not found.</div></div>`); return; }
  const tc = t.col;
  const hero = `<div class="hero dossier-hero" style="--ca:${tc};--cb:${tc}">
    <div class="eye">Team Dossier</div><div class="big" style="color:${tc}">${esc(t.team)}</div>
    <div class="chips"><span class="chip">OFF <b style="color:${tc}">${esc(t.identity)}</b></span>
      <span class="chip">DEF <b style="color:${tc}">${esc(t.funnel)}</b></span>
      <span class="chip">${Math.round(t.plays_pg)} plays/gm</span>
      <span class="chip">aDOT <b style="color:${tc}">${t.adot}</b></span></div></div>`;

  const POSNAME = { QB: "Quarterbacks", RB: "Running Backs", WR: "Wide Receivers", TE: "Tight Ends" };
  let depth = `<div class="seclabel team" style="--tc:${tc}">Depth Chart &amp; Player Props</div>`;
  for (const pos of ["QB", "RB", "WR", "TE"]) {
    const arr = t.depth[pos]; if (!arr) continue;
    depth += `<div class="teamhdr" style="--tc:${tc}">${POSNAME[pos]}</div><div class="pcards">`;
    for (const p of arr) {
      const stats = Object.entries(p.props).filter(([, v]) => v != null)
        .map(([k, v]) => `<span class="stat"><span class="k">${k}</span><span class="v">${v}</span></span>`).join("");
      const mark = p.starter ? `<span class="star">★</span>` : `<span class="diamond">◆</span>`;
      depth += `<div class="pcard"><div class="ph"><span class="slot">${esc(p.slot)}</span>
        <span class="pn">${esc(p.name)}</span>${mark}<div class="tdbadge">TD <b>${p.td}%</b></div></div>
        <div class="statline">${stats}</div></div>`;
    }
    depth += `</div>`;
  }

  let sched = `<div class="seclabel team" style="--tc:${tc}">2026 Schedule</div><div class="sched">`;
  for (const s of t.schedule) {
    const res = s.win == null ? "" : `<span class="res ${s.win ? "W" : "L"}">${s.win ? "W" : "L"}</span>`;
    const line = s.proj ? `${esc(s.spread)} · ${esc(s.proj)}` : `<span style="color:#4a5a6c">${esc(s.spread)}</span>`;
    sched += `<div class="scard" style="--oc:${s.opp_col}${s.gid ? "" : ";cursor:default"}"${s.gid ? ` onclick="go('g/${s.gid}')"` : ""}>
      <div class="w">Wk ${s.week}</div><div class="o"><span class="ha">${s.ha}</span> ${esc(s.opp)}${res}</div>
      <div class="pr">${line}</div></div>`;
  }
  sched += `</div>`;

  render(`${topbar()}<div class="wrap">
    <div class="back" onclick="go('teams')">← all teams</div>
    ${hero}
    <div class="seclabel team" style="--tc:${tc}">The Team Report</div>
    <div class="report" style="--tc:${tc}">${t.report_html}</div>
    ${depth}${sched}</div>`);
  window.scrollTo(0, 0);
}

/* ---------------- router ---------------- */
function render(html) { app.innerHTML = (html.startsWith("<div class=\"topbar") ? "" : topbar()) + html; }
async function route() {
  const h = location.hash.replace(/^#\/?/, "");
  const parts = h.split("/").filter(Boolean);
  if (parts[0] === "g" && parts[1]) return game(parts[1]);
  if (parts[0] === "t" && parts[1]) return team(parts[1]);
  if (parts[0] === "teams") return teams();
  return home();
}
window.addEventListener("hashchange", route);
// injury-tool checkboxes (delegated, survives re-renders)
app.addEventListener("click", e => { const el = e.target.closest(".injbox"); if (el) { e.stopPropagation(); toggleOut(el.getAttribute("data-inj")); } });
route();
