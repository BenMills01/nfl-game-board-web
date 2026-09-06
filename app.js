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
async function game(gid) {
  let g;
  try { g = await getJSON(`data/game/${gid}.json`); } catch (e) { render(`<div class="wrap"><div class="empty">Game not found.</div></div>`); return; }
  const favA = g.spread < 0, favH = g.spread > 0;
  const hero = `<div class="hero" style="--ca:${g.away_col};--cb:${g.home_col}">
    <div class="eye">Week ${g.week} · Projected Final</div>
    <div class="score">
      <div class="tm ${favA ? "fav" : ""}"><div class="pt" style="color:${g.away_col}">${g.apts}</div><div class="ab" style="color:${g.away_col}">${esc(g.away)}</div></div>
      <div class="at">AT</div>
      <div class="tm ${favH ? "fav" : ""}"><div class="pt" style="color:${g.home_col}">${g.hpts}</div><div class="ab" style="color:${g.home_col}">${esc(g.home)}</div></div>
    </div>
    <div class="chips"><span class="chip">${esc(g.kickoff)}</span><span class="chip"><b>${esc(g.fav)}</b> −${Math.abs(g.spread).toFixed(1)}</span>
      <span class="chip">O/U <b>${g.total.toFixed(1)}</b></span>${g.roof ? `<span class="chip">${esc(g.roof)}</span>` : ""}</div></div>`;

  let proj = `<div class="seclabel">Projections vs the Book</div>`
    + `<p class="note" style="margin:-4px 0 14px">Row reads: <b>our mean</b> vs <b>book line</b> · two-way price · <b>%&#8593;</b> = our chance of going <b>over</b>. `
    + `The call follows that probability, not the mean — for skewed stats (rushing especially) the mean can sit at the line while most outcomes fall under it.</p>`;
  let tdboard = `<div class="seclabel">Anytime Touchdown — Fair vs Book</div><div class="tdgrid">`;
  for (const tb of g.teams) {
    proj += `<div class="teamhdr" style="--tc:${tb.col}">${esc(tb.team)}</div><div class="pcards">`;
    for (const p of tb.players) proj += playerCard(p);
    proj += `</div>`;
    for (const p of tb.players) if (p.td) tdboard += tdCard(p, tb.team);
  }
  tdboard += `</div>`;

  render(`${topbar()}<div class="wrap">
    <div class="back" onclick="go('')">← back to the slate</div>
    ${hero}
    <div class="seclabel">The Match Report</div>
    <div class="report">${g.report_html}</div>
    ${proj}
    ${tdboard}
    <p class="note">Book = live consensus line across books. Calls assume ≈ −110. TD props are noisy — treat as a lean and shop the longest price.</p>
  </div>`);
  window.scrollTo(0, 0);
}

function playerCard(p) {
  const mk = p.markets.map(m => {
    let nums, pill;
    if (m.book != null) {
      const price = (m.over_am || m.under_am)
        ? `<span class="odds">${esc(m.over_am || "")}/${esc(m.under_am || "")}</span>` : "";
      const pov = m.pover != null
        ? `<span class="pov" title="our modelled chance of going OVER the line — drives the call, not the mean">${m.pover}%&#8593;</span>` : "";
      nums = `<b>${m.proj}</b><span class="vs">vs</span><span class="bk">${m.book}</span>${price}${pov}`;
      const ev = m.ev != null && m.ev > 0 ? ` +${m.ev}%` : "";
      if (m.call === "OVER") pill = `<span class="pill over" title="EV at the posted over price">Over${ev}</span>`;
      else if (m.call === "UNDER") pill = `<span class="pill under" title="EV at the posted under price">Under${ev}</span>`;
      else pill = `<span class="pill none">fair</span>`;
    } else {
      nums = `<b>${m.proj}</b> <span class="noline">· no line</span>`;
      pill = `<span class="pill na">${m.over_th}–${m.under_th}</span>`;
    }
    return `<div class="mkt"><span class="lbl">${esc(m.label)}</span><span class="nums">${nums}</span>${pill}</div>`;
  }).join("");
  const td = p.td
    ? `<div class="tdbadge">TD <b>${p.td.pct}%</b><br>${p.td.book ? `${esc(p.td.book)} ${p.td.value ? '<span class="val">●</span>' : ""}` : `fair ${esc(p.td.fair)}`}</div>`
    : "";
  const mark = p.starter ? `<span class="star">★</span>` : `<span class="diamond">◆</span>`;
  return `<div class="pcard ${p.minor ? "minor" : ""}">
    <div class="ph"><span class="slot">${esc(p.pos)}</span><span class="pn">${esc(p.name)}</span>${mark}${td}</div>
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
route();
