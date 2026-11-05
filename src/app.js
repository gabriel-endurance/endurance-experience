(() => {
"use strict";
/* =============================================================
   ENDURANCE — The Human Intelligence Experience · v1
   Vanilla JS, no dependencies. Canvas 2D field + SVG instruments.
   ============================================================= */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smooth = t => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  lset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};

const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const isSmall = window.matchMedia("(max-width: 760px)").matches;
const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
const lowPower = isSmall || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
const S = {
  reduced: store.lget("endr_reduced") ? store.lget("endr_reduced") === "1" : mqReduced.matches,
  name: "", scene: "act1", act: 1, mouse: { x: innerWidth / 2, y: innerHeight / 2, sx: innerWidth / 2, sy: innerHeight / 2 }
};
document.body.classList.toggle("reduced", S.reduced);
document.body.classList.add("show-ph");

/* ---------------- noise (3D value noise) ---------------- */
function hash(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c000 = hash(xi, yi, zi), c100 = hash(xi + 1, yi, zi), c010 = hash(xi, yi + 1, zi), c110 = hash(xi + 1, yi + 1, zi);
  const c001 = hash(xi, yi, zi + 1), c101 = hash(xi + 1, yi, zi + 1), c011 = hash(xi, yi + 1, zi + 1), c111 = hash(xi + 1, yi + 1, zi + 1);
  const x00 = lerp(c000, c100, u), x10 = lerp(c010, c110, u), x01 = lerp(c001, c101, u), x11 = lerp(c011, c111, u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 2 - 1;
}

/* ---------------- THE FIELD — "fingerprint of a feeling" ---------------- */
/* ENDURANCE NOVA ID — brand-sand, brand-navy, brand-orange, brand-rust */
const SAND = [201, 194, 177], INK = [44, 59, 78], ORANGE = [247, 175, 101], RUST = [163, 82, 58];
const BASE = { cx: .5, cy: .5, scale: 1, amp: .35, freq: 1.4, speed: .12, jitter: 0, ripple: 0, alpha: .42, q: 0, warm: 0, breath: 0, stretch: 1.18, twist: 0, cursor: 1, ink: 0, follow: 0 };

class Field {
  constructor(canvas, opt = {}) {
    this.c = canvas; this.ctx = canvas.getContext("2d");
    this.N = opt.N || 44; this.M = opt.M || 150;
    this.fixedColor = opt.color || null;
    this.P = { ...BASE, ...(opt.init || {}) }; this.T = { ...this.P };
    this.t = Math.random() * 100; this.useMouse = opt.mouse !== false;
    this.resize(); addEventListener("resize", () => this.resize());
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.6);
    const w = this.c.clientWidth || innerWidth, h = this.c.clientHeight || innerHeight;
    this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
    this.w = w; this.h = h; this.dpr = dpr;
  }
  set(o) { Object.assign(this.T, o); }
  preset(o) { this.T = { ...BASE, ...o }; }
  step(dt) {
    const k = 1 - Math.pow(1 - (S.reduced ? .25 : .035), dt * 60);
    for (const key in this.T) this.P[key] = lerp(this.P[key], this.T[key], k);
    if (!S.reduced) this.t += dt;
    this.pulse = (this.pulse || 0) * Math.pow(.955, dt * 60); this.pulseAge = (this.pulseAge || 0) + dt;
  }
  draw() {
    const { ctx, P, dpr } = this, w = this.w, h = this.h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (P.alpha < .005) return;
    const base = this.fixedColor || [lerp(SAND[0], INK[0], P.ink), lerp(SAND[1], INK[1], P.ink), lerp(SAND[2], INK[2], P.ink)];
    const col = base.map((c, i) => Math.round(lerp(c, ORANGE[i], P.warm)));
    const rgb = `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.strokeStyle = rgb; ctx.fillStyle = rgb; ctx.lineWidth = 1;
    const mx = S.mouse.sx, my = S.mouse.sy;
    let cx = P.cx * w, cy = P.cy * h;
    if (this.useMouse && P.follow > 0) { cx = lerp(cx, mx, P.follow * .35); cy = lerp(cy, my, P.follow * .35); }
    const t = this.t, N = this.N, M = this.M;
    const R = Math.hypot(w, h) * .5 * P.scale * (1 + Math.sin(t * 1.6) * P.breath);
    const lineA = P.alpha * clamp(1 - P.q * 1.6), dotA = P.alpha * clamp(P.q * 2) * 1.5;
    const snapT = smooth(clamp((P.q - .35) / .65));
    const rad = 220, useCursor = this.useMouse && P.cursor > .01;
    const xs = new Float32Array(M + 1), ys = new Float32Array(M + 1);
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const ri = R * (.035 + .965 * u);
      const fade = 1 - u * .6;
      for (let k = 0; k <= M; k++) {
        const a = (k / M) * TAU + P.twist * u * 3;
        const nx = Math.cos(a), ny = Math.sin(a);
        const n = noise3(nx * P.freq + 11, ny * P.freq + 7 + u * 1.7, t * P.speed + u * .6);
        let r = ri + n * P.amp * R * .22 * (.35 + u);
        if (P.ripple > .001) r += Math.sin(u * 42 - t * 3.4) * P.ripple * R * .009;
        if (this.pulse > .01) { const front = this.pulseAge * 1.1; r += Math.exp(-Math.pow((u - front) * 6, 2)) * this.pulse * R * .05; }
        if (P.jitter > .001) r += (Math.random() - .5) * P.jitter * R * .011;
        let x = cx + nx * r, y = cy + ny * r * P.stretch;
        if (useCursor) {
          const dx = x - mx, dy = y - my, d = Math.sqrt(dx * dx + dy * dy);
          if (d < rad && d > .01) { const f = (1 - d / rad); const push = f * f * 28 * P.cursor; x += dx / d * push; y += dy / d * push; }
        }
        xs[k] = x; ys[k] = y;
      }
      if (lineA > .004) {
        ctx.globalAlpha = lineA * fade;
        ctx.beginPath(); ctx.moveTo(xs[0], ys[0]);
        for (let k = 1; k <= M; k++) ctx.lineTo(xs[k], ys[k]);
        ctx.stroke();
      }
      if (dotA > .004) {
        ctx.globalAlpha = Math.min(1, dotA * fade);
        const steps = Math.max(12, Math.round(16 + u * 56));
        const stepA = TAU / steps;
        for (let k = 0; k < M; k += 3) {
          const a = (k / M) * TAU + P.twist * u * 3;
          const sa = Math.round(a / stepA) * stepA;
          const tx = cx + Math.cos(sa) * ri, ty = cy + Math.sin(sa) * ri * P.stretch;
          const x = lerp(xs[k], tx, snapT), y = lerp(ys[k], ty, snapT);
          ctx.fillRect(x - .8, y - .8, 1.6, 1.6);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}

const field = new Field($("#field"), { N: lowPower ? 30 : 44, M: lowPower ? 110 : 150, init: { scale: .45, alpha: .0 } });
const seal = new Field($("#sealCanvas"), { N: 24, M: 120, color: RUST, mouse: false, init: { scale: 1.05, amp: .5, alpha: .85, stretch: 1.25, speed: .16 } });

/* ---------------- FIELD PRESETS ---------------- */
const MOMENTS = [
  { name: "Um olhar", rhythm: "contido", p: { amp: .26, freq: 1.1, speed: .07, cursor: 2.6, follow: 1, alpha: .5 } },
  { name: "Uma expectativa", rhythm: "suspenso", p: { amp: .3, freq: 1.4, speed: .2, breath: .07, alpha: .5 } },
  { name: "Uma lembrança", rhythm: "lento", p: { amp: .55, freq: .8, speed: .045, twist: .35, alpha: .3, scale: 1.15 } },
  { name: "Um medo", rhythm: "acelerado", p: { amp: .2, freq: 3.2, speed: .55, jitter: 1, scale: .78, alpha: .5 } },
  { name: "Uma conquista", rhythm: "expansivo", p: { amp: .46, freq: 1.3, speed: .16, ripple: .45, warm: .85, scale: 1.25, alpha: .55 } },
  { name: "Um arrepio", rhythm: "elétrico", p: { amp: .3, freq: 2.4, speed: .3, ripple: 1.7, jitter: .25, alpha: .55 } }
];
const SCENES = {
  act1: { act: 1, theme: "night" },
  moments: { act: 1, theme: "night" },
  transition: { act: 2, theme: "night" },
  thesis: { act: 2, theme: "paper", field: { ink: 1, alpha: .26, q: 0, cx: .86, cy: .46, scale: .66, speed: .07, amp: .42, cursor: 1.6 } },
  principle: { act: 2, theme: "night", field: { alpha: 0, q: 0 } },
  thesisbody: { act: 2, theme: "paper", field: { ink: 1, alpha: .16, q: 1, cx: .9, cy: .72, scale: .72, speed: .04 } },
  engine: { act: 3, theme: "night", field: { alpha: .1, q: .75, cx: .32, scale: .7, speed: .05, cursor: .4 } },
  lab: { act: 3, theme: "night", field: { alpha: .08, q: 1, cx: .5, cy: .9, scale: .9, speed: .04 } },
  cases: { act: 4, theme: "night", field: { alpha: .22, q: .15, cx: .8, cy: .3, scale: .7, speed: .08 } },
  case: { act: 4, theme: "night", field: { alpha: .06, q: 0, scale: .6, speed: .06 } },
  loop: { act: 5, theme: "paper", field: { ink: 1, alpha: .1, q: .35, cx: .76, cy: .5, scale: .55, speed: .06, cursor: .5 } },
  loopout: { act: 5, theme: "paper", field: { ink: 1, alpha: .1, q: 1, cx: .1, cy: .8, scale: .7, speed: .04 } },
  build: { act: 6, theme: "night", field: { alpha: .42, q: 0, warm: .3, cx: .72, cy: .55, scale: .9, speed: .1, cursor: 2.2, amp: .38 } }
};
const ACTS = [
  { n: "I", id: "act-1", title: "Before everything" },
  { n: "II", id: "act-2", title: "Meet Endurance" },
  { n: "III", id: "act-3", title: "Human Intelligence Engine" },
  { n: "IV", id: "act-4", title: "What becomes possible" },
  { n: "V", id: "act-5", title: "How we build" },
  { n: "VI", id: "act-6", title: "What would you build?" }
];

/* ---------------- GATE (Act 00) ---------------- */
const gate = $("#gate");
const fmtDate = d => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
const validDate = fmtDate(new Date(Date.now() + 14 * 864e5));

$("#inviteNo").textContent = String(Math.floor(1000 + Math.random() * 8999));
let pendingCred = null;

/* ---------------- ACCESS TRACKING (server records start time and time on page) ---------------- */
const postJSON = (path, body) => fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });
let pingTimer = null;
function pingAccess(leaving) {
  const token = store.get("endr_token"); if (!token) return;
  if (leaving && navigator.sendBeacon) navigator.sendBeacon("api/access/ping", new Blob([JSON.stringify({ token })], { type: "application/json" }));
  else postJSON("api/access/ping", { token }).catch(() => {});
}
function startTracking() {
  clearInterval(pingTimer); pingAccess();
  pingTimer = setInterval(() => { if (document.visibilityState === "visible") pingAccess(); }, 30000);
}
function stopTracking() { pingAccess(true); clearInterval(pingTimer); pingTimer = null; store.set("endr_token", ""); }
document.addEventListener("visibilitychange", () => pingAccess(document.visibilityState === "hidden"));
addEventListener("pagehide", () => pingAccess(true));

function enterExperience(name, instant) {
  S.name = (name || "").trim();
  $("#footName").textContent = S.name || "convidado";
  renderBuildQ();
  document.body.classList.remove("locked");
  window.scrollTo(0, 0);
  if (instant) { gate.classList.add("gone"); }
  else {
    gate.classList.add("closing");
    setTimeout(() => gate.classList.add("gone"), 1650);
  }
  field.set({ alpha: .38, scale: .38 });
}
$("#gateForm").addEventListener("submit", async e => {
  e.preventDefault();
  const code = $("#gCode").value.trim().toUpperCase(), key = $("#gKey").value.trim();
  const err = $("#gateErr"), btn = $("#gateForm button[type=submit]");
  if (!code || !key) { err.textContent = "Informe o código do convite e a chave de acesso."; return; }
  btn.disabled = true; err.textContent = "";
  try {
    const res = await postJSON("api/access/check", { code, key });
    if (!res.ok) { err.textContent = res.status === 429 ? "Muitas tentativas. Aguarde um minuto e tente novamente." : "Credenciais não reconhecidas. Confira o código do convite e a chave de acesso."; return; }
  } catch (e) { err.textContent = "Não foi possível validar o acesso agora. Verifique sua conexão."; return; }
  finally { btn.disabled = false; }
  pendingCred = { code, key };
  $("#inviteNo").textContent = code.replace("ENDR-", "");
  openConsent($("#gName").value.trim());
});

/* ---------------- CONSENT (confidentiality term) ---------------- */
const consent = $("#consent"), cName = $("#cName"), cA = $("#cAgree"), cB = $("#cAware"), cSign = $("#cSign");
function openConsent(name) {
  cName.value = name || ""; cA.checked = false; cB.checked = false; $("#cErr").textContent = "";
  $("#cInvite").textContent = $("#inviteNo").textContent;
  const d = new Date(); $("#cDate").textContent = `${fmtDate(d)} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  updateSig(); consent.classList.add("open"); consent.setAttribute("aria-hidden", "false");
  setTimeout(() => (name ? cA : cName).focus({ preventScroll: true }), 350);
}
function updateSig() {
  const v = cName.value.trim();
  $("#cSigPreview").textContent = v || "Sua assinatura";
  $("#cSigPreview").classList.toggle("empty", !v);
  cSign.disabled = !(v.length >= 3 && cA.checked && cB.checked);
}
[cName, cA, cB].forEach(el => el.addEventListener("input", updateSig));
[cA, cB].forEach(el => el.addEventListener("change", updateSig));
$("#cDecline").addEventListener("click", () => {
  consent.classList.remove("open"); consent.setAttribute("aria-hidden", "true");
  $("#gKey").value = ""; $("#gateErr").textContent = "Para acessar a experiência, é necessário aceitar o termo de confidencialidade.";
});
cSign.addEventListener("click", () => {
  const name = cName.value.trim();
  if (cSign.disabled) return;
  store.set("endr_consent", JSON.stringify({ name, at: new Date().toISOString(), invite: $("#inviteNo").textContent }));
  store.set("endr_in", "1"); store.set("endr_name", name);
  startClock(Date.now() + ACCESS_MS);
  // not awaited: the intro must start inside this click (fullscreen + sound need the user gesture)
  if (pendingCred) postJSON("api/access/start", { ...pendingCred, name }).then(r => r.ok ? r.json() : null)
    .then(d => { if (d && d.token) { store.set("endr_token", d.token); store.set("endr_access", d.id); startTracking(); } }).catch(() => {});
  pendingCred = null;
  consent.classList.remove("open"); consent.setAttribute("aria-hidden", "true");
  if (Sound.enabled) { Sound.unlock(); Sound.duck(true); }
  openIntro(name);                       // runs inside the click: fullscreen + sound are allowed
});

/* ---------------- INTRO VIDEO (fullscreen, minimal controls) ---------------- */
const intro = $("#intro"), vid = $("#introVideo"), vPlay = $("#vPlay"), vMute = $("#vMute"), vBar = $("#vBar"), vFill = $("#vFill"), vTime = $("#vTime");
let introName = "", hideT = null;
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
function openIntro(name) {
  introName = name;
  intro.classList.add("open"); intro.setAttribute("aria-hidden", "false");
  try { const r = intro.requestFullscreen ? intro.requestFullscreen() : (intro.webkitRequestFullscreen && intro.webkitRequestFullscreen()); r && r.catch && r.catch(() => {}); } catch (e) {}
  vid.currentTime = 0; vid.muted = false;
  const p = vid.play(); if (p && p.catch) p.catch(() => { intro.classList.add("paused"); });
  wake();
}
function closeIntro() {
  if (!intro.classList.contains("open")) return;
  vid.pause();
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (document.webkitFullscreenElement) document.webkitExitFullscreen(); } catch (e) {}
  intro.classList.add("leaving");
  Sound.duck(false);
  enterExperience(introName);
  setTimeout(() => { intro.classList.remove("open", "leaving", "paused"); intro.setAttribute("aria-hidden", "true"); }, 900);
}
function togglePlay() { if (vid.paused) { vid.play().catch(() => {}); } else vid.pause(); }
function wake() { intro.classList.add("ui"); clearTimeout(hideT); hideT = setTimeout(() => { if (!vid.paused) intro.classList.remove("ui"); }, 2600); }
vid.addEventListener("play", () => { intro.classList.remove("paused"); vPlay.setAttribute("aria-label", "Pausar"); wake(); });
vid.addEventListener("pause", () => { intro.classList.add("paused", "ui"); vPlay.setAttribute("aria-label", "Reproduzir"); });
vid.addEventListener("timeupdate", () => { const d = vid.duration || 1; vFill.style.width = (vid.currentTime / d * 100) + "%"; vTime.textContent = `${fmtT(vid.currentTime)} / ${fmtT(vid.duration || 0)}`; });
vid.addEventListener("ended", closeIntro);
vid.addEventListener("click", togglePlay);
vPlay.addEventListener("click", togglePlay);
$("#vBig").addEventListener("click", togglePlay);
vMute.addEventListener("click", () => { vid.muted = !vid.muted; intro.classList.toggle("muted", vid.muted); vMute.setAttribute("aria-label", vid.muted ? "Ativar som" : "Silenciar"); });
$("#vFwd").addEventListener("click", () => { vid.currentTime = Math.min((vid.duration || 0) - .2, vid.currentTime + 10); wake(); });
$("#vSkip").addEventListener("click", closeIntro);
vBar.addEventListener("click", e => { const r = vBar.getBoundingClientRect(); vid.currentTime = clamp((e.clientX - r.left) / r.width) * (vid.duration || 0); wake(); });
intro.addEventListener("pointermove", wake);
addEventListener("keydown", e => {
  if (!intro.classList.contains("open")) return;
  if (e.key === " " || e.key === "k") { e.preventDefault(); togglePlay(); }
  if (e.key === "ArrowRight") { vid.currentTime = Math.min((vid.duration || 0) - .2, vid.currentTime + 10); wake(); }
});
if (store.get("endr_in") === "1") enterExperience(store.get("endr_name") || "", true);
else { document.body.classList.add("locked"); setTimeout(() => $("#gName").focus({ preventScroll: true }), 400); }


/* ---------------- ACCESS CLOCK (08h from signature) ---------------- */
const ACCESS_MS = 8 * 3600 * 1000;           // 08 horas — altere aqui se o prazo mudar
const clockEl = $("#clock"), clockTime = $("#clockTime"), clockArc = $("#clockArc");
let clockDeadline = 0, clockTimer = null;
const CIRC_C = 2 * Math.PI * 15.5;
clockArc.style.strokeDasharray = `${CIRC_C} ${CIRC_C}`;
function fmtHMS(ms) { const t = Math.max(0, Math.ceil(ms / 1000)); return [Math.floor(t / 3600), Math.floor(t % 3600 / 60), t % 60].map(n => String(n).padStart(2, "0")).join(":"); }
function tickClock() {
  const left = clockDeadline - Date.now();
  clockTime.textContent = fmtHMS(left);
  clockArc.style.strokeDashoffset = (CIRC_C * (1 - clamp(left / ACCESS_MS))).toFixed(2);
  clockEl.classList.toggle("warn", left <= 15 * 60 * 1000);
  if (left <= 0) {
    stopClock(); clockEl.classList.remove("on"); stopTracking();
    const ex = $("#expired"); ex.classList.add("open"); ex.setAttribute("aria-hidden", "false"); document.body.classList.add("locked");
  }
}
function startClock(deadline) {
  clockDeadline = deadline; store.set("endr_deadline", String(deadline));
  const d = new Date(deadline); $("#footValid").textContent = `${fmtDate(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  clockEl.classList.add("on"); clearInterval(clockTimer); tickClock(); clockTimer = setInterval(tickClock, 1000);
}
function stopClock() { clearInterval(clockTimer); clockTimer = null; clockEl.classList.remove("on"); }
$("#expBack").addEventListener("click", () => returnToGate());
{ const dl = +store.get("endr_deadline"); if (store.get("endr_in") === "1") { startClock(dl > 0 ? dl : Date.now() + ACCESS_MS); if (store.get("endr_token")) startTracking(); } }

/* ---------------- NAV / MENU ---------------- */
const ticks = $("#ticks"), menuList = $("#menuList");
{ // 00 — back to the access screen
  const li = document.createElement("li");
  li.innerHTML = `<button id="backToGate"><span class="cap sm">00</span>Tela de acesso <span class="cap sm" style="margin-left:6px;opacity:.6">↺ sair</span></button>`;
  li.firstChild.addEventListener("click", () => { closeOverlay($("#menu")); returnToGate(); });
  menuList.appendChild(li);
}
function returnToGate() {
  store.set("endr_in", ""); store.set("endr_name", ""); store.set("endr_consent", ""); store.set("endr_deadline", "");
  stopTracking(); stopClock(); $("#expired").classList.remove("open"); $("#expired").setAttribute("aria-hidden", "true");
  if (comp.classList.contains("open")) toggleCompanion(false);
  $("#gateForm").reset(); $("#gateErr").textContent = "";
  gate.classList.remove("gone");
  void gate.offsetWidth;            // reflow so the iris re-opens
  gate.classList.remove("closing");
  document.body.classList.add("locked");
  setTimeout(() => { window.scrollTo(0, 0); $("#gName").focus({ preventScroll: true }); }, 900);
}
ACTS.forEach((a, i) => {
  const b = document.createElement("button");
  b.innerHTML = `<span>${a.n}</span>`; b.setAttribute("aria-label", `Ato ${a.n} — ${a.title}`); b.title = `Ato ${a.n} — ${a.title}`;
  b.addEventListener("click", () => goTo(a.id)); ticks.appendChild(b);
  const li = document.createElement("li");
  li.innerHTML = `<button><span class="cap sm">${a.n}</span>${a.title}</button>`;
  li.firstChild.addEventListener("click", () => { closeOverlay($("#menu")); goTo(a.id); });
  menuList.appendChild(li);
});
$$("[data-goto]").forEach(b => b.addEventListener("click", () => goTo(b.dataset.goto)));
function goTo(id, offset = 0) {
  const el = document.getElementById(id); if (!el) return;
  const top = el.getBoundingClientRect().top + scrollY + offset;
  window.scrollTo({ top, behavior: S.reduced ? "auto" : "smooth" });
}
let lastFocus = null;
function openOverlay(el) { lastFocus = document.activeElement; el.classList.add("open"); document.body.style.overflow = "hidden"; const f = el.querySelector("button, input, textarea"); f && f.focus({ preventScroll: true }); }
function closeOverlay(el) { el.classList.remove("open"); document.body.style.overflow = ""; lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true }); }
$("#menuBtn").addEventListener("click", () => openOverlay($("#menu")));
$("#menuClose").addEventListener("click", () => closeOverlay($("#menu")));
addEventListener("keydown", e => {
  if (e.key !== "Escape" || $("#intro").classList.contains("open")) return;
  if ($("#menu").classList.contains("open")) closeOverlay($("#menu"));
  else if ($("#dossier").classList.contains("open")) closeOverlay($("#dossier"));
  else if (comp.classList.contains("open")) toggleCompanion(false);
});
const tReduced = $("#tReduced"); tReduced.checked = S.reduced;
tReduced.addEventListener("change", () => { S.reduced = tReduced.checked; document.body.classList.toggle("reduced", S.reduced); store.lset("endr_reduced", S.reduced ? "1" : "0"); });
$("#tPh").addEventListener("change", e => document.body.classList.toggle("show-ph", e.target.checked));

addEventListener("pointermove", e => { S.mouse.x = e.clientX; S.mouse.y = e.clientY; Sound.cursor(e.clientX / innerWidth, e.clientY / innerHeight); }, { passive: true });

/* ---------------- REVEALS ---------------- */
const io = new IntersectionObserver(entries => entries.forEach(en => {
  if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
}), { threshold: .18 });
$$("[data-reveal]").forEach(el => io.observe(el));

const ioStrike = new IntersectionObserver(entries => entries.forEach(en => {
  if (!en.isIntersecting) return;
  const el = en.target;
  if (el.id === "thesisH") setTimeout(() => el.querySelector(".strike").style.setProperty("--s", 1), 600);
  if (el.id === "notList") $$("li", el).forEach((li, i) => setTimeout(() => li.style.setProperty("--s", 1), 300 + i * 260));
  if (el.id === "phaseLine") $$(".ph", el).forEach((p, i) => setTimeout(() => p.classList.add("in"), 200 + i * 220));
  ioStrike.unobserve(el);
}), { threshold: .4 });
["#phaseLine"].forEach(s => ioStrike.observe($(s)));
new IntersectionObserver((es, o) => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); o.unobserve(en.target); } }), { threshold: .3 }).observe($("#identityH"));


/* ---------------- SOUND — generative, reacts to Act I (Web Audio, no files) ---------------- */
const Sound = (() => {
  let ctx = null, master, drone, droneF, droneG, pan, noiseF, noiseG, rev, revG, lfo, trem, tremG, oscs = [];
  let enabled = store.lget("endr_sound") !== "0", ready = false, lastPhrase = -1, brandDone = false, lastStage = -1, zone = "off";
  const PENTA = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];   // A minor — darker, cinematic
  function impulse(sec = 5.8) {
    const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2); }
    return b;
  }
  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0; master.connect(comp);
    rev = ctx.createConvolver(); rev.buffer = impulse(); revG = ctx.createGain(); revG.gain.value = .75; rev.connect(revG); revG.connect(master);
    pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); pan.connect(master);
    // drone: three voices through a moving low-pass
    droneF = ctx.createBiquadFilter(); droneF.type = "lowpass"; droneF.frequency.value = 280; droneF.Q.value = .7;
    trem = ctx.createGain(); trem.gain.value = 1;
    droneG = ctx.createGain(); droneG.gain.value = 0;
    droneF.connect(trem); trem.connect(droneG); droneG.connect(pan); droneG.connect(rev);
    [[55, "sine", .55], [55.25, "sawtooth", .1], [82.41, "sawtooth", .08], [110, "triangle", .16], [130.81, "sine", .12]].forEach(([f, type, g]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f; og.gain.value = g; o.connect(og); og.connect(droneF); o.start(); oscs.push(o);
    });
    lfo = ctx.createOscillator(); lfo.frequency.value = .08; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(droneF.frequency); lfo.start();
    // tremolo (used for fear / anticipation)
    const tl = ctx.createOscillator(); tl.frequency.value = 6; tremG = ctx.createGain(); tremG.gain.value = 0; tl.connect(tremG); tremG.connect(trem.gain); tl.start();
    // filtered noise (wind / chills)
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    noiseF = ctx.createBiquadFilter(); noiseF.type = "bandpass"; noiseF.frequency.value = 1200; noiseF.Q.value = 1.2;
    noiseG = ctx.createGain(); noiseG.gain.value = 0; ns.connect(noiseF); noiseF.connect(noiseG); noiseG.connect(pan); noiseG.connect(rev); ns.start();
    ready = true;
  }
  const T = () => ctx.currentTime;
  const ramp = (param, v, tc = .6) => { if (ready) param.setTargetAtTime(v, T(), tc); };
  function chime(f, dur = 3.2, g = .14, when = 0) {
    if (!ready || !enabled) return;
    const t0 = T() + when, out = ctx.createGain(); out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(g, t0 + .015); out.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    out.connect(pan); out.connect(rev);
    [[1, 1], [2.01, .35], [3.98, .12]].forEach(([m, a]) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "sine"; o.frequency.value = f * m; og.gain.value = a; o.connect(og); og.connect(out); o.start(t0); o.stop(t0 + dur + .1); });
  }
  function thump(g = .5) {
    if (!ready || !enabled) return;
    const o = ctx.createOscillator(), og = ctx.createGain(), t0 = T(); o.type = "sine";
    o.frequency.setValueAtTime(90, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + .25);
    og.gain.setValueAtTime(0, t0); og.gain.linearRampToValueAtTime(g, t0 + .01); og.gain.exponentialRampToValueAtTime(.0001, t0 + .45);
    o.connect(og); og.connect(master); o.start(t0); o.stop(t0 + .5);
  }
  function chord(notes, g = .1, spread = .09) { notes.forEach((f, i) => chime(f, 4.5, g, i * spread)); }

  // cinematic "braam": detuned saws through a sweeping low-pass
  function impact(g = .22, dur = 3.4) {
    if (!ready || !enabled) return;
    const t0 = T(), f = ctx.createBiquadFilter(), out = ctx.createGain();
    f.type = "lowpass"; f.Q.value = 3; f.frequency.setValueAtTime(140, t0); f.frequency.exponentialRampToValueAtTime(1500, t0 + .35); f.frequency.exponentialRampToValueAtTime(220, t0 + dur);
    out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(g, t0 + .06); out.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    f.connect(out); out.connect(master); out.connect(rev);
    [55, 55.4, 82.41, 110.2].forEach(fr => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = fr; o.connect(f); o.start(t0); o.stop(t0 + dur + .1); });
    thump(g * 1.8);
  }
  // string-like swell (slow attack, long release)
  function swell(notes, g = .07, att = 1.4, dur = 6) {
    if (!ready || !enabled) return;
    const t0 = T(), f = ctx.createBiquadFilter(), out = ctx.createGain();
    f.type = "lowpass"; f.frequency.value = 1400; f.Q.value = .6;
    out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(g, t0 + att); out.gain.setTargetAtTime(0, t0 + att + 1, dur / 4);
    f.connect(out); out.connect(pan); out.connect(rev);
    notes.forEach(fr => [0, 7].forEach(cents => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = fr; o.detune.value = cents; o.connect(f); o.start(t0); o.stop(t0 + att + dur + 1); }));
  }
  // tension riser
  function riser(dur = 2.2, g = .12) {
    if (!ready || !enabled) return;
    whoosh(g * .8, dur);
    const t0 = T(), o = ctx.createOscillator(), og = ctx.createGain(); o.type = "sawtooth";
    o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(440, t0 + dur);
    og.gain.setValueAtTime(0, t0); og.gain.linearRampToValueAtTime(g * .35, t0 + dur * .9); og.gain.linearRampToValueAtTime(0, t0 + dur + .05);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; o.connect(f); f.connect(og); og.connect(rev); og.connect(master); o.start(t0); o.stop(t0 + dur + .1);
  }
  function whoosh(g = .18, dur = 1.6) {
    if (!ready || !enabled) return;
    const t0 = T(); noiseF.frequency.cancelScheduledValues(t0); noiseF.frequency.setValueAtTime(300, t0); noiseF.frequency.exponentialRampToValueAtTime(4200, t0 + dur);
    noiseG.gain.cancelScheduledValues(t0); noiseG.gain.setValueAtTime(noiseG.gain.value, t0); noiseG.gain.linearRampToValueAtTime(g, t0 + dur * .4); noiseG.gain.linearRampToValueAtTime(0, t0 + dur);
  }
  let beatT = null;
  function heartbeat(on, bpm = 66) { clearInterval(beatT); beatT = null; if (on) beatT = setInterval(() => { thump(.32); setTimeout(() => thump(.18), 230); }, 60000 / bpm); }
  const MOODS = [
    { cut: 900, g: .16, trem: 0, noise: 0, pitch: 1, note: [440, 554.37, 659.25] },      // olhar
    { cut: 620, g: .18, trem: .25, noise: .0, pitch: 1, beat: 72, note: [329.63, 493.88] }, // expectativa
    { cut: 420, g: .2, trem: 0, noise: .02, pitch: .5, note: [220, 277.18, 329.63] },    // lembrança
    { cut: 360, g: .2, trem: .55, noise: .05, pitch: .94, beat: 104, note: [233.08, 246.94] }, // medo
    { cut: 2200, g: .2, trem: 0, noise: 0, pitch: 1.5, note: [440, 554.37, 659.25, 880] },   // conquista
    { cut: 1500, g: .14, trem: .1, noise: .09, pitch: 1.12, note: [739.99, 987.77] }          // arrepio
  ];
  return {
    get enabled() { return enabled; }, get ready() { return ready; },
    unlock() { if (!enabled) return; init(); if (ctx && ctx.state === "suspended") ctx.resume(); if (ready) ramp(master.gain, .8, .8); },
    toggle() {
      enabled = !enabled; store.lset("endr_sound", enabled ? "1" : "0");
      if (enabled) { this.unlock(); this.zone(zone, true); } else if (ready) { ramp(master.gain, 0, .3); heartbeat(false); }
      return enabled;
    },
    zone(z, force) {   // act1 · moments · transition · quiet
      if (z === zone && !force) return; zone = z;
      if (!ready || !enabled) return;
      if (z !== "moments") { heartbeat(false); ramp(tremG.gain, 0, .4); }
      if (z === "quiet") { ramp(droneG.gain, .025, 1.6); ramp(droneF.frequency, 260, 1.2); ramp(noiseG.gain, 0, .5); }
    },
    act1(p) {
      if (!ready || !enabled) return; this.zone("act1");
      ramp(droneG.gain, .1 + p * .14, .5); ramp(droneF.frequency, 240 + p * 1300, .5);
      const idx = p < .04 ? -1 : p < .2 ? 0 : p < .36 ? 1 : p < .52 ? 2 : p < .7 ? 3 : p < .86 ? 4 : 5;
      if (idx !== lastPhrase) {
        if (idx > lastPhrase && idx >= 0) {
          if (idx <= 2) { impact(.14 + idx * .04, 3); swell([[110, 130.81], [98, 116.54], [87.31, 110]][idx], .05, .8, 4); }   // "before the…"
          else if (idx === 3) { riser(1.6, .1); setTimeout(() => { impact(.24); swell([220, 261.63, 329.63], .07); }, 1500); }   // "something human"
          else if (idx === 4) { impact(.28, 4); swell([174.61, 220, 261.63, 349.23], .08, 1.8, 7); }                           // "something we feel"
          else { swell([110, 220, 261.63, 329.63, 392], .07, 2.4, 8); chord([440, 523.25, 659.25], .05, .22); }                 // "that's where we begin"
        }
        lastPhrase = idx;
      }
    },
    moment(i) {
      if (!ready || !enabled) return; this.zone("moments"); const m = MOODS[i];
      ramp(droneF.frequency, m.cut, .8); ramp(droneG.gain, m.g, .8); ramp(tremG.gain, m.trem, .6); ramp(noiseG.gain, m.noise, .8);
      oscs.forEach((o, k) => ramp(o.frequency, [55, 55.25, 82.41, 110, 130.81][k] * m.pitch, 1.2));
      heartbeat(!!m.beat, m.beat || 66);
      if (i === 5) { riser(1.4, .1); }
      if (i === 3) { impact(.16, 2.6); swell([116.54, 123.47, 174.61], .06, .6, 4); }
      else if (i === 4) { impact(.26, 4); swell([146.83, 185, 220, 293.66], .08, 1.2, 6); }
      else swell(m.note.map(f => f / 2), .055, 1.2, 5);
      chord(m.note, .045, i === 2 ? .4 : .14);
    },
    transition(p) {
      if (!ready || !enabled) return; this.zone("transition");
      oscs.forEach((o, k) => ramp(o.frequency, [55, 55.25, 82.41, 110, 130.81][k], 1));
      ramp(droneG.gain, .16 - p * .08, .6); ramp(droneF.frequency, 500 + p * 1800, .6);
      const st = p < .3 ? 0 : p < .56 ? 1 : 2;
      if (st !== lastStage) { if (st > lastStage) { const base = [261.63, 329.63, 440][st]; [0, 1, 2, 3].forEach(k => chime(base * [1, 1.25, 1.5, 2][k], 1.4, .06, k * .07)); } lastStage = st; }
      if (p > .78 && !brandDone) { brandDone = true; impact(.3, 4.5); swell([110, 164.81, 220, 261.63, 329.63], .08, 1.6, 8); }
      if (p < .6) brandDone = false;
    },
    cursor(nx, ny) { if (!ready || !enabled) return; if (pan.pan) ramp(pan.pan, (nx - .5) * .7, .3); if (zone === "moments" || zone === "act1") ramp(noiseF.frequency, 600 + (1 - ny) * 2400, .4); },
    ping(nx) { if (!ready || !enabled) return; chime(PENTA[Math.min(PENTA.length - 1, Math.floor(nx * PENTA.length))], 2.6, .13); thump(.15); },
    duck(on) { if (ready) ramp(master.gain, on || !enabled ? 0 : .8, .4); }
  };
})();
// unlock on the first gesture (browsers only allow audio after one)
["pointerdown", "keydown"].forEach(ev => addEventListener(ev, () => { if (Sound.enabled && !$("#intro").classList.contains("open")) Sound.unlock(); }, { passive: true }));
function renderSoundBtn() { const b = $("#soundBtn"); b.classList.toggle("on", Sound.enabled); b.setAttribute("aria-pressed", Sound.enabled); $("#soundLbl").textContent = Sound.enabled ? "Som" : "Som off"; }
$("#soundBtn").addEventListener("click", () => { Sound.toggle(); renderSoundBtn(); });
renderSoundBtn();
// click / tap on the field: visual wave + sound
addEventListener("click", e => {
  if (!["act1", "moments", "transition"].includes(S.scene) || e.target.closest("button, a, input, textarea, .nav, .moment-list")) return;
  field.pulse = 1; field.pulseAge = 0; Sound.ping(e.clientX / innerWidth);
});

/* ---------------- ACT I — phrases ---------------- */
const act1 = $("#act-1");
const phrases = $$(".phrase", act1).map(el => ({ el, r: el.dataset.r.split(",").map(Number), words: $$(".w", el) }));
function updateAct1(p) {
  phrases.forEach((ph, idx) => {
    const [a, b] = ph.r; const l = (p - a) / (b - a);
    if (l < -0.05 || l > 1.05) { ph.el.style.opacity = 0; return; }
    const last = idx === phrases.length - 1;
    const fin = clamp(l / .28), fout = last ? 0 : clamp((l - .74) / .26);
    ph.el.style.opacity = (ease(fin) * (1 - ease(fout))).toFixed(3);
    ph.el.style.transform = `translateY(${((1 - ease(fin)) * 30 - ease(fout) * 40).toFixed(1)}px) scale(${(1 + l * .04).toFixed(4)})`;
    ph.words.forEach((w, j) => {
      const wl = ease(clamp((l - j * .05) / .26));
      w.style.opacity = wl.toFixed(3);
      w.style.transform = `translateY(${((1 - wl) * 0.35).toFixed(3)}em)`;
    });
  });
  const secs = p * 14;
  $("#scrollHint").style.opacity = p > .02 ? 0 : 1;
  // field: from an intimate trace to a full fingerprint
  Sound.act1(p);
  const warm = p > .52 && p < .70 ? .3 : (p >= .70 && p < .86 ? .75 : (p >= .86 ? .25 : 0));
  field.set({ scale: lerp(.38, 1.12, ease(clamp(p / .9))), amp: lerp(.22, .42, p), alpha: lerp(.36, .5, p), warm, speed: .12, q: 0, cx: .5, cy: .5, cursor: 1.2, jitter: 0, ripple: 0, breath: 0, follow: 0, twist: 0, freq: 1.4, ink: 0, stretch: 1.18 });
}

/* ---------------- MOMENTS ---------------- */
const momentWord = $$("#momentWord span"), momentList = $("#momentList"); let momentIdx = -1;
MOMENTS.forEach((m, i) => {
  const li = document.createElement("li");
  li.innerHTML = `<button><span class="t">${m.name}</span><span class="cap sm n">0${i + 1}</span></button>`;
  li.firstChild.addEventListener("click", () => {
    const sec = $("#moments"); const h = sec.offsetHeight - innerHeight;
    window.scrollTo({ top: sec.getBoundingClientRect().top + scrollY + h * ((i + .5) / 6), behavior: S.reduced ? "auto" : "smooth" });
  });
  momentList.appendChild(li);
});
function setMoment(i) {
  if (i === momentIdx) return; momentIdx = i; Sound.moment(i);
  momentWord.forEach((s, j) => s.classList.toggle("on", j === i));
  $$("button", momentList).forEach((b, j) => b.classList.toggle("on", j === i));
  $("#momentCount").textContent = `0${i + 1} / 06`;
  field.preset({ ...MOMENTS[i].p, scale: MOMENTS[i].p.scale || 1 });
  $("#roR").textContent = MOMENTS[i].rhythm;
}
function updateMoments(p) { setMoment(Math.min(5, Math.floor(clamp(p, 0, .9999) * 6))); }

/* ---------------- TRANSITION ---------------- */
const stages = $$("#stages .stage"), transCopy = $("#transCopy"), revealBrand = $("#revealBrand");
const TRANS_TXT = ["Todo sentimento deixa uma marca. <em>Única, como uma digital.</em>", "Sinais e evidências tornam essa marca <em>observável.</em>", "A inteligência a transforma em <em>estrutura.</em>"];
let transIdx = -1;
function updateTransition(p) {
  Sound.transition(p);
  const i = p < .3 ? 0 : p < .56 ? 1 : 2;
  if (i !== transIdx) { transIdx = i; stages.forEach((s, j) => s.classList.toggle("on", j <= i)); transCopy.innerHTML = TRANS_TXT[i]; }
  const brand = ease(clamp((p - .7) / .18));
  transCopy.style.opacity = (1 - clamp((p - .62) / .1)).toFixed(3);
  revealBrand.style.opacity = brand.toFixed(3);
  revealBrand.style.transform = `scale(${(1.06 - brand * .06).toFixed(4)})`;
  field.set({ q: smooth(clamp((p - .18) / .48)), alpha: lerp(.5, .2, brand), scale: lerp(1, .82, p), cx: .5, cy: .5, warm: 0, speed: lerp(.12, .03, p), amp: .36, jitter: 0, ripple: 0, breath: 0, follow: 0, twist: 0, cursor: lerp(1, .3, p), ink: 0 });
}

/* ---------------- ENGINE ---------------- */
/* Taxonomy from the Endurance HIE reference: 8 fundamental feelings, each with
   5 emotional states → 5 behaviours → 5 business impacts (radially aligned).
   Values (intensity / probability / impact) are FICTITIOUS demo data.
   `p` = index of the highlighted path (Felicidade → Satisfação → Permanecer → Retenção is the official example). */
const FEELINGS = [
  { name: "Confiança", desc: "Acreditar que algo ou alguém é seguro, confiável e cumprirá o que promete.",
    st: ["Segurança", "Credibilidade", "Tranquilidade", "Pertencimento", "Lealdade"],
    beh: ["Permanecer", "Contratar", "Compartilhar", "Participar", "Defender"],
    imp: ["Retenção", "Conversão", "Personalização", "Engajamento", "Fidelização"], p: 1 },
  { name: "Medo", desc: "Antecipação de perda, erro ou ameaça.",
    st: ["Ansiedade", "Insegurança", "Receio", "Preocupação", "Desconfiança"],
    beh: ["Hesitar", "Comparar", "Evitar", "Buscar ajuda", "Cancelar"],
    imp: ["Queda na conversão", "Aumento do ciclo", "Abandono", "Aumento do suporte", "Churn"], p: 0 },
  { name: "Raiva", desc: "Reação a algo percebido como injusto, desrespeitoso ou frustrante.",
    st: ["Irritação", "Frustração", "Indignação", "Impaciência", "Revolta"],
    beh: ["Criticar", "Reclamar", "Expor publicamente", "Abandonar", "Processar"],
    imp: ["Dano à reputação", "Insatisfação", "Impacto na marca", "Churn", "Risco jurídico"], p: 1 },
  { name: "Tristeza", desc: "Sensação de perda, decepção ou distância do que se esperava.",
    st: ["Decepção", "Desânimo", "Solidão", "Arrependimento", "Desmotivação"],
    beh: ["Reduzir uso", "Desistir", "Isolar-se", "Trocar fornecedor", "Ignorar"],
    imp: ["Queda de engajamento", "Churn", "Baixa retenção", "Perda de receita", "Baixa adoção"], p: 0 },
  { name: "Nojo", desc: "Rejeição a algo percebido como inaceitável ou contrário aos próprios valores.",
    st: ["Repulsa", "Desprezo", "Desaprovação", "Aversão", "Rejeição"],
    beh: ["Rejeitar", "Evitar", "Denunciar", "Bloquear", "Desinstalar"],
    imp: ["Perda de clientes", "Rejeição do mercado", "Risco reputacional", "Queda de adoção", "Churn"], p: 2 },
  { name: "Surpresa", desc: "Reação ao inesperado, que abre espaço para atenção e descoberta.",
    st: ["Curiosidade", "Espanto", "Admiração", "Confusão", "Fascínio"],
    beh: ["Explorar", "Compartilhar", "Recomendar", "Experimentar", "Pesquisar"],
    imp: ["Adoção", "Alcance orgânico", "Boca a boca", "Experimentação", "Conversão"], p: 4 },
  { name: "Antecipação", desc: "Expectativa em relação ao que ainda vai acontecer.",
    st: ["Expectativa", "Esperança", "Interesse", "Curiosidade", "Otimismo"],
    beh: ["Acompanhar", "Planejar", "Pesquisar", "Testar", "Engajar"],
    imp: ["Retenção", "Intenção de compra", "Geração de leads", "Experimentação", "Conversão"], p: 1 },
  { name: "Felicidade", desc: "Bem-estar e satisfação diante de algo que atende ou supera expectativas.",
    st: ["Realização", "Gratidão", "Entusiasmo", "Encantamento", "Satisfação"],
    beh: ["Recomprar", "Defender", "Explorar", "Recomendar", "Permanecer"],
    imp: ["Receita", "Fidelização", "Engajamento", "Aquisição", "Retenção"], p: 4 }
];
// deterministic fictitious values; the highlighted path gets the strongest values
FEELINGS.forEach((f, i) => {
  const v = (j, k, lo, hi) => +(lo + hash(i * 7 + 3, j * 13 + 5, k) * (hi - lo)).toFixed(2);
  f.sv = f.st.map((_, j) => j === f.p ? v(j, 1, .74, .86) : v(j, 1, .32, .68));
  f.bv = f.beh.map((_, j) => j === f.p ? v(j, 2, .62, .74) : v(j, 2, .18, .55));
  f.iv = f.imp.map((_, j) => j === f.p ? v(j, 3, .46, .58) : v(j, 3, .12, .42));
});
const RINGS = { core: 64, r1: 158, r2: 250, r3: 345, r4: 438, ticks: 484 };
const C = 500, NS = "http://www.w3.org/2000/svg";
const SECT = TAU / 8, STEP = SECT / 5.6;               // sector width; spacing between the 5 aligned items
const BASE_A = i => i * SECT - Math.PI * .625;          // Confiança starts top-left, clockwise like the reference
const COL = { state: "#f7af65", beh: "#c9c2b1", imp: "#ece8dd", night: "#131c28" };
const E = { sel: 7, rot: 0, rotT: 0, visible: false, auto: true, lastSwitch: 0, grow: 0 };
const svgEl = (tag, attrs = {}, parent) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); parent && parent.appendChild(el); return el; };
const polar = (r, a) => [C + Math.cos(a) * r, C + Math.sin(a) * r];
const inst = $("#instrument");
const svg = svgEl("svg", { viewBox: "0 0 1000 1000", role: "img", "aria-label": "Human Intelligence Engine: sentimento fundamental, estado emocional, comportamento e impacto no negócio" }, inst);
// phones: zoom into the selected sector (always rotated to face right) so its labels stay legible
const mqChart = window.matchMedia("(max-width: 760px)");
const fitChart = () => svg.setAttribute("viewBox", mqChart.matches ? "500 265 600 470" : "0 0 1000 1000");
fitChart(); mqChart.addEventListener("change", fitChart);
const gTicks = svgEl("g", {}, svg);
for (let i = 0; i < 180; i++) {
  const a = i / 180 * TAU, long = i % 15 === 0;
  const [x1, y1] = polar(RINGS.ticks, a), [x2, y2] = polar(RINGS.ticks + (long ? 14 : 6), a);
  svgEl("line", { x1, y1, x2, y2, stroke: "#c9c2b1", "stroke-opacity": long ? .5 : .2 }, gTicks);
}
const wedge = svgEl("path", { fill: "#f7af65", "fill-opacity": .045, stroke: "none" }, svg);
const ringEls = {};
["r1", "r2", "r3", "r4"].forEach(k => { ringEls[k] = svgEl("circle", { cx: C, cy: C, r: RINGS[k], class: "ring", "stroke-dasharray": k === "r1" ? "" : "2 5" }, svg); });
const gSpokes = svgEl("g", {}, svg);                    // faint radial spokes for every item
const gLayers = svgEl("g", { fill: "none" }, svg);       // multilayer organic contours
const blobState = svgEl("path", { stroke: COL.state, "stroke-width": 2, "stroke-opacity": .75 }, gLayers);
const blobBeh = svgEl("path", { stroke: COL.beh, "stroke-width": 1.6, "stroke-opacity": .6 }, gLayers);
const blobImp = svgEl("path", { stroke: COL.imp, "stroke-width": 1.4, "stroke-opacity": .55, "stroke-dasharray": "6 6" }, gLayers);
const gLinks = svgEl("g", { fill: "none", "stroke-linecap": "round" }, svg);
const gNodes = svgEl("g", {}, svg);
const gLabels = svgEl("g", {}, svg);
const core = svgEl("circle", { cx: C, cy: C, r: RINGS.core, fill: COL.night, stroke: "#f7af65", "stroke-width": 1.6 }, svg);
const coreTxt = svgEl("text", { x: C, y: C + 6, "text-anchor": "middle", class: "core-label" }, svg); coreTxt.textContent = "Usuário";
// sector items (8 × 5 per layer)
const items = FEELINGS.map(() => ({
  spoke: svgEl("line", { stroke: "#c9c2b1", "stroke-opacity": .1 }, gSpokes),
  s: [0, 1, 2, 3, 4].map(() => svgEl("circle", { r: 4, fill: COL.night, stroke: COL.state, "stroke-width": 1.2 }, gNodes)),
  b: [0, 1, 2, 3, 4].map(() => svgEl("circle", { r: 4, fill: COL.night, stroke: COL.beh, "stroke-width": 1.2 }, gNodes)),
  m: [0, 1, 2, 3, 4].map(() => svgEl("rect", { width: 8, height: 8, fill: COL.night, stroke: COL.imp, "stroke-width": 1.2 }, gNodes))
}));
// labels for the selected sector only (radial pills, like the reference)
const lab = { s: [], b: [], m: [] };
["s", "b", "m"].forEach(k => { for (let j = 0; j < 5; j++) lab[k].push(svgEl("text", { class: "item-label" }, gLabels)); });
const linkEls = Array.from({ length: 5 * 3 + 1 }, () => svgEl("path", {}, gLinks));
// feeling nodes on ring 1 (name inside the circle)
const feelNodes = FEELINGS.map((f, i) => {
  const g = svgEl("g", { class: "feel-node", tabindex: 0, role: "button", "aria-label": `Selecionar ${f.name}` }, svg);
  const c = svgEl("circle", { r: 40, fill: COL.night, stroke: "#c9c2b1", "stroke-width": 1.2 }, g);
  const label = svgEl("text", { class: "feel-label", "text-anchor": "middle" }, g); label.textContent = f.name;
  const pick = () => { E.auto = false; selectFeeling(i); };
  g.addEventListener("click", pick); g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
  return { g, c, label };
});

const feelSelect = $("#feelSelect"), layers = $("#layers");
FEELINGS.forEach((f, i) => {
  const b = document.createElement("button"); b.className = "chip"; b.textContent = f.name; b.setAttribute("role", "tab");
  b.addEventListener("click", () => { E.auto = false; selectFeeling(i); }); feelSelect.appendChild(b);
});
const pct = v => v.toFixed(2).replace(".", ",");
function rows(names, vals, hi, unit) {
  return names.map((n, j) => `<div class="prob${j === hi ? " hi" : ""}"><span>${n}</span><b>${unit}${pct(vals[j])}</b><div class="bar"><i style="width:0" data-w="${vals[j] * 100}"></i></div></div>`).join("");
}
function selectFeeling(i) {
  E.sel = i; E.grow = 0; E.lastSwitch = performance.now();
  const base = -BASE_A(i);
  let d = base - E.rotT; d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI; E.rotT += d;
  $$(".chip", feelSelect).forEach((c, j) => { c.classList.toggle("on", j === i); c.setAttribute("aria-selected", j === i); });
  const f = FEELINGS[i], p = f.p;
  layers.innerHTML = `
    <div class="chain"><span class="cap sm">Caminho em destaque</span><p>${f.name} <i>→</i> ${f.st[p]} <i>→</i> ${f.beh[p]} <i>→</i> ${f.imp[p]}</p></div>
    <div class="layer core" data-ring="r1"><div class="layer-h"><span class="serif">${f.name}</span><span class="cap sm tag">01 · Classificação</span></div>
      <div class="body"><span class="q">O que o usuário está sentindo?</span> ${f.desc} <br><span class="cap sm" style="color:var(--accent)">objeto principal da pesquisa</span></div></div>
    <div class="layer" data-ring="r2"><div class="layer-h"><span class="serif">Estado emocional</span><span class="cap sm">02 · Intensidade</span></div>
      <div class="body"><span class="q">Quão forte é esse sentimento?</span><div class="probs">${rows(f.st, f.sv, p, "")}</div></div></div>
    <div class="layer" data-ring="r3"><div class="layer-h"><span class="serif">Comportamento</span><span class="cap sm">03 · Probabilidade</span></div>
      <div class="body"><span class="q">Qual a chance desse sentimento gerar uma ação?</span><div class="probs">${rows(f.beh, f.bv, p, "p ")}</div></div></div>
    <div class="layer" data-ring="r4"><div class="layer-h"><span class="serif">Impacto no negócio</span><span class="cap sm">04 · Impacto</span></div>
      <div class="body"><span class="q">Quanto isso afeta o negócio?</span><div class="probs">${rows(f.imp, f.iv, p, "")}</div></div></div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => $$(".bar i", layers).forEach(b => b.style.width = b.dataset.w + "%")));
  $$(".layer", layers).forEach(l => {
    l.addEventListener("mouseenter", () => ringEls[l.dataset.ring].classList.add("hl"));
    l.addEventListener("mouseleave", () => ringEls[l.dataset.ring].classList.remove("hl"));
  });
}
const itemA = (i, j) => BASE_A(i) + (j - 2) * STEP + E.rot;
// smooth closed curve through polar points (Catmull-Rom → cubic Bézier)
function closedCurve(pts) {
  const n = pts.length; let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let k = 0; k < n; k++) {
    const p0 = pts[(k - 1 + n) % n], p1 = pts[k], p2 = pts[(k + 1) % n], p3 = pts[(k + 2) % n];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}
function layerBlob(key, rIn, rOut, t, seed) {
  const pts = [];
  FEELINGS.forEach((f, i) => f[key].forEach((v, j) => {
    const a = itemA(i, j); const wob = S.reduced ? 0 : noise3(Math.cos(a) * 1.2 + seed, Math.sin(a) * 1.2, t * .25) * 6;
    pts.push(polar(lerp(rIn, rOut, v) + wob, a));
  }));
  return closedCurve(pts);
}
function renderEngine(t, dt) {
  E.rot = lerp(E.rot, E.rotT, 1 - Math.pow(1 - (S.reduced ? 1 : .06), dt * 60));
  E.grow = Math.min(1, E.grow + dt * (S.reduced ? 10 : .9));
  const f = FEELINGS[E.sel], g = ease(E.grow), g2 = ease(clamp((E.grow - .25) / .6)), g3 = ease(clamp((E.grow - .5) / .5));
  gTicks.setAttribute("transform", `rotate(${(S.reduced ? 0 : t * 2) % 360} ${C} ${C})`);
  // focus wedge on the selected sector
  const a0 = BASE_A(E.sel) + E.rot, half = SECT / 2;
  const [w1x, w1y] = polar(RINGS.r1 + 42, a0 - half), [w2x, w2y] = polar(RINGS.ticks - 6, a0 - half), [w3x, w3y] = polar(RINGS.ticks - 6, a0 + half), [w4x, w4y] = polar(RINGS.r1 + 42, a0 + half);
  wedge.setAttribute("d", `M${w1x},${w1y} L${w2x},${w2y} A${RINGS.ticks - 6},${RINGS.ticks - 6} 0 0 1 ${w3x},${w3y} L${w4x},${w4y} A${RINGS.r1 + 42},${RINGS.r1 + 42} 0 0 0 ${w1x},${w1y}Z`);
  // multilayer contours: estado (intensidade), comportamento (probabilidade), impacto
  blobState.setAttribute("d", layerBlob("sv", RINGS.r1 + 48, RINGS.r2 + 30, t, 1));
  blobBeh.setAttribute("d", layerBlob("bv", RINGS.r2 + 20, RINGS.r3 + 34, t, 4));
  blobImp.setAttribute("d", layerBlob("iv", RINGS.r3 + 20, RINGS.r4 + 34, t, 7));
  // all items
  FEELINGS.forEach((F, i) => {
    const on = i === E.sel, it = items[i];
    const [sx1, sy1] = polar(RINGS.r1 + 42, BASE_A(i) + E.rot), [sx2, sy2] = polar(RINGS.ticks, BASE_A(i) + E.rot + half);
    it.spoke.setAttribute("x1", C); it.spoke.setAttribute("y1", C);
    const [bx, by] = polar(RINGS.ticks, BASE_A(i) + E.rot - half); it.spoke.setAttribute("x2", bx); it.spoke.setAttribute("y2", by);
    for (let j = 0; j < 5; j++) {
      const a = itemA(i, j);
      const [x2, y2] = polar(RINGS.r2, a), [x3, y3] = polar(RINGS.r3, a), [x4, y4] = polar(RINGS.r4, a);
      const hi = on && j === F.p;
      const sR = on ? (4 + F.sv[j] * 7) * (.4 + .6 * g) : 3.2, bR = on ? (4 + F.bv[j] * 7) * (.4 + .6 * g2) : 3.2, mS = on ? (7 + F.iv[j] * 10) * (.4 + .6 * g3) : 6;
      it.s[j].setAttribute("cx", x2); it.s[j].setAttribute("cy", y2); it.s[j].setAttribute("r", sR);
      it.b[j].setAttribute("cx", x3); it.b[j].setAttribute("cy", y3); it.b[j].setAttribute("r", bR);
      it.m[j].setAttribute("x", x4 - mS / 2); it.m[j].setAttribute("y", y4 - mS / 2); it.m[j].setAttribute("width", mS); it.m[j].setAttribute("height", mS);
      const op = on ? 1 : .32;
      it.s[j].setAttribute("opacity", op); it.b[j].setAttribute("opacity", op); it.m[j].setAttribute("opacity", op);
      it.s[j].setAttribute("fill", hi ? COL.state : COL.night); it.b[j].setAttribute("fill", hi ? COL.beh : COL.night); it.m[j].setAttribute("fill", hi ? COL.imp : COL.night);
    }
  });
  // feelings on ring 1
  feelNodes.forEach((n, i) => {
    const a = BASE_A(i) + E.rot; const [x, y] = polar(RINGS.r1, a);
    n.c.setAttribute("cx", x); n.c.setAttribute("cy", y);
    n.label.setAttribute("x", x); n.label.setAttribute("y", y + 5);
    const on = i === E.sel;
    n.c.setAttribute("fill", on ? "#f7af65" : COL.night); n.c.setAttribute("stroke", on ? "#f7af65" : "#c9c2b1");
    n.c.setAttribute("stroke-opacity", on ? 1 : .45);
    n.label.style.fill = on ? COL.night : "#ece8dd"; n.label.style.opacity = on ? 1 : .7;
    n.label.style.fontWeight = on ? 600 : 400;
  });
  // labels + links of the selected sector (radial, readable because the sector faces right)
  const [fx, fy] = polar(RINGS.r1 + 40, a0);
  let li = 0; const L = (d, w, op, color) => { const el = linkEls[li++]; el.setAttribute("d", d); el.setAttribute("stroke-width", w); el.setAttribute("stroke-opacity", op); el.setAttribute("stroke", color); };
  const [c0x, c0y] = polar(RINGS.core, a0);
  L(`M${c0x},${c0y}L${polar(RINGS.r1 - 40, a0).join(",")}`, 1.8, .9 * g, "#f7af65");
  for (let j = 0; j < 5; j++) {
    const a = itemA(E.sel, j), hi = j === f.p;
    const [x2, y2] = polar(RINGS.r2, a), [x3, y3] = polar(RINGS.r3, a), [x4, y4] = polar(RINGS.r4, a);
    const mx = (fx + x2) / 2, my = (fy + y2) / 2;
    L(`M${fx},${fy}Q${polar((RINGS.r1 + RINGS.r2) / 2 + 10, a).join(",")} ${x2},${y2}`, hi ? 2.4 : .6 + f.sv[j] * 2, (hi ? .95 : .4) * g, hi ? "#f7af65" : "#c9c2b1");
    L(`M${x2},${y2}L${x3},${y3}`, hi ? 2.4 : .6 + f.bv[j] * 2, (hi ? .95 : .35) * g2, hi ? "#f7af65" : "#c9c2b1");
    L(`M${x3},${y3}L${x4},${y4}`, hi ? 2.4 : .6 + f.iv[j] * 2, (hi ? .95 : .3) * g3, hi ? "#f7af65" : "#c9c2b1");
    // labels sit just outside each node, rotated along the radius
    const deg = a * 180 / Math.PI, flip = Math.cos(a) < 0;
    [["s", RINGS.r2, f.st[j], f.sv[j], g], ["b", RINGS.r3, f.beh[j], f.bv[j], g2], ["m", RINGS.r4, f.imp[j], f.iv[j], g3]].forEach(([k, r, txt, v, gg]) => {
      const el = lab[k][j]; const [lx, ly] = polar(r + 14, a);
      el.textContent = txt;
      const off = (k === "b" ? -9 : 9) * (flip ? -1 : 1); el.setAttribute("x", lx); el.setAttribute("y", ly + off);
      el.setAttribute("text-anchor", flip ? "end" : "start");
      el.setAttribute("dominant-baseline", "middle");
      el.setAttribute("transform", `rotate(${flip ? deg + 180 : deg} ${lx} ${ly})`);
      el.style.opacity = gg; el.classList.toggle("hi", hi);
    });
  }
  // auto-cycle while idle
  if (E.auto && !S.reduced && performance.now() - E.lastSwitch > 5600) selectFeeling((E.sel + 1) % FEELINGS.length);
}
selectFeeling(7); E.rot = E.rotT;
new IntersectionObserver(es => es.forEach(en => { E.visible = en.isIntersecting; if (en.isIntersecting) E.lastSwitch = performance.now(); }), { threshold: .15 }).observe(inst);

/* ---------------- LAB ---------------- */
const LAB = [
  { name: "Atlas", analogy: "O termômetro", when: ["durante", "depois"],
    what: "Motor de inferência de sentimentos probabilísticos. Analisa o feedback da audiência em posts de canais digitais.",
    q: "O que a audiência sente, inclusive o que ela não diz explicitamente?",
    glyph: `<circle cx="50" cy="50" r="40"/><ellipse cx="50" cy="50" rx="14" ry="40"/><ellipse cx="50" cy="50" rx="28" ry="40"/><line x1="10" y1="50" x2="90" y2="50"/><ellipse cx="50" cy="50" rx="40" ry="14"/>`, spin: true },
  { name: "Gargantua", analogy: "O túnel de vento", when: ["antes"],
    what: "Modelo de análise de criativos e campanhas. Cruza previsibilidade neural com o motor de inferência.",
    q: "Este criativo vai prender atenção, reter e gerar ação? Que reação emocional provoca?",
    glyph: `<ellipse cx="50" cy="50" rx="44" ry="10"/><ellipse cx="50" cy="50" rx="36" ry="7"/><ellipse cx="50" cy="50" rx="28" ry="5"/><circle cx="50" cy="50" r="17" fill="currentColor" stroke="none"/><path d="M33 50 a17 17 0 0 1 34 0"/>` },
  { name: "Tesseract", analogy: "O simulador de voo", when: ["antes"],
    what: "Simulador de clientes. Cria audiências sintéticas variadas em cognição, persona, contexto e localização, com tecnologia agêntica.",
    q: "Como públicos específicos reagiriam a este cenário, produto ou campanha?",
    glyph: `<rect x="12" y="12" width="76" height="76"/><rect x="32" y="32" width="36" height="36"/><line x1="12" y1="12" x2="32" y2="32"/><line x1="88" y1="12" x2="68" y2="32"/><line x1="12" y1="88" x2="32" y2="68"/><line x1="88" y1="88" x2="68" y2="68"/>`, spin: true },
  { name: "Ben", analogy: "A peça que encaixa tudo no motor do cliente", when: ["durante"],
    what: "Frente de SDKs para integrar nossa inteligência a soluções existentes, sob demanda.",
    q: "Como ativar sentimento e reação dentro da experiência que o cliente já tem?",
    glyph: Array.from({ length: 25 }, (_, i) => `<circle cx="${18 + (i % 5) * 16}" cy="${18 + Math.floor(i / 5) * 16}" r="${i === 12 ? 4 : 1.6}" ${i === 12 ? 'fill="#f7af65" stroke="none"' : 'fill="currentColor" stroke="none"'}/>`).join("") },
  { name: "Projetos sob medida", analogy: "Divisão de P&D", when: ["antes", "durante", "depois"], any: true,
    what: "Divisão de P&D para pesquisas de tiro curto e Provas de Conceito.",
    q: "Existe uma solução para um desafio que nenhuma frente cobre ainda?",
    glyph: `<circle cx="50" cy="50" r="30"/><line x1="50" y1="6" x2="50" y2="94"/><line x1="6" y1="50" x2="94" y2="50"/><circle cx="50" cy="50" r="4" fill="#f7af65" stroke="none"/><path d="M20 20h8M20 20v8M80 80h-8M80 80v-8"/>` }
];
const bench = $("#bench");
const MOMENTS_J = ["antes", "durante", "depois"];
LAB.forEach((l, i) => {
  const d = document.createElement("article"); d.className = "instr" + (i === 0 ? " open" : ""); d.tabIndex = 0;
  const journey = `<div class="journey" aria-label="Momento da jornada: ${l.any ? "qualquer momento" : l.when.join(" e ")}">${MOMENTS_J.map(m => `<span class="${l.when.includes(m) ? "on" : ""}">${m}</span>`).join("")}</div>`;
  d.innerHTML = `<div class="cap sm instr-top"><span>Frente 0${i + 1}</span><span class="when">${l.any ? "Qualquer momento" : l.when.map(w => w[0].toUpperCase() + w.slice(1)).join(" e ")}</span></div>
    <svg class="glyph" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><g ${l.spin ? 'style="transform-origin:50px 50px;animation:spin ' + (40 + i * 10) + 's linear infinite"' : ""}>${l.glyph}</g></svg>
    <div><h4>${l.name}</h4><p class="analogy">${l.analogy}</p>
      <div class="desc">
        <p class="what">${l.what}</p>
        <p class="cap sm qlabel">Pergunta que responde</p>
        <p class="q">${l.q}</p>
        <p class="cap sm qlabel">Momento da jornada</p>${journey}
        ${l.name === "Gargantua" ? `<button class="btn light demo-mini" data-demo>Ver em ação <span class="arr">▶</span></button>` : ""}
      </div></div>`;
  d.addEventListener("click", () => { $$(".instr", bench).forEach(x => x !== d && x.classList.remove("open")); d.classList.add("open"); });
  d.addEventListener("mouseenter", () => { $$(".instr", bench).forEach(x => x.classList.toggle("open", x === d)); });
  d.addEventListener("focus", () => { $$(".instr", bench).forEach(x => x.classList.toggle("open", x === d)); });
  bench.appendChild(d);
});


/* ---------------- DEMO VIDEO — Gargantua platform ---------------- */
const demoOv = $("#demoOv"), demoVideo = $("#demoVideo");
function openDemo() {
  demoOv.classList.add("open"); demoOv.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden";
  Sound.duck(true); demoVideo.currentTime = 0; const p = demoVideo.play(); p && p.catch && p.catch(() => {});
  setTimeout(() => $("#demoClose").focus({ preventScroll: true }), 300);
}
function closeDemo() {
  demoVideo.pause(); demoOv.classList.remove("open"); demoOv.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; Sound.duck(false);
}
document.addEventListener("click", e => { const d = e.target.closest("[data-demo]"); if (d) { e.stopPropagation(); openDemo(); } });
$("#demoClose").addEventListener("click", closeDemo);
demoOv.addEventListener("click", e => { if (e.target === demoOv) closeDemo(); });
addEventListener("keydown", e => { if (e.key === "Escape" && demoOv.classList.contains("open")) closeDemo(); });

/* ---------------- CASES ---------------- */
const CASES = [
  { who: "Defender · @defenderuiz", sector: "Comunidade off-road · Reel no Instagram", url: "https://defenderuiz-case-endurance.netlify.app/",
    q: "Como uma única crítica virou <em>20% de todo</em> o engajamento?", layout: "l-left", motif: "lines", pos: [.75, .6],
    kpis: [["153", "comentários"], ["124", "vozes únicas"], ["+78", "sentimento líquido"], ["1→31", "defensores espontâneos"]],
    feel: "Orgulho de marca, admiração técnica e aspiração",
    d: ["Entender por que um sábado de trilha virou fenômeno de comunidade, e o que essa comunidade sente pelo carro e por quem o pilota.",
        "Reel de trilha publicado em março de 2026 por um criador off-road, em parceria com outro canal 4x4. Os comentários continuavam chegando 66 dias depois.",
        "Sentimento e suas raízes emocionais, cauda longa da conversa, 9 tópicos, 5 perfis comportamentais (K-Means), persona síntese, controvérsia e qualidade das respostas do dono do perfil.",
        "71% de sentimento positivo, ancorado em orgulho de marca e admiração técnica: o carro é tratado como ícone e território. Uma única crítica gerou 31 respostas defensivas e, sozinha, respondeu por 20% do engajamento.",
        "Série com obstáculos extremos, setup do carro fixado para reduzir perguntas repetidas, playbook para críticas leves (responder, não apagar) e 11 perguntas ainda sem resposta para converter em relação.",
        "153 comentários de 124 autores, net sentiment +78, 61 respostas em cadeia, 16 perguntas detectadas (5 respondidas) e 31 menções à marca."] },
  { who: "Bisutti · Espaços para eventos", sector: "Eventos premium · Reel no Instagram", url: "https://bisutii-endurance-case.netlify.app/",
    q: "Como transformar <em>encantamento</em> em visita agendada?", layout: "l-right", motif: "spiral", pos: [.22, .5],
    kpis: [["+68", "sentimento líquido"], ["21", "sinais de intenção comercial"], ["47", "dúvidas detectadas"], ["6", "personas"]],
    feel: "Encantamento, desejo e sonho",
    d: ["Descobrir o que o público sente diante de um espaço de celebração, e quem está pronto para visitar, orçar ou indicar.",
        "Reel da campanha \"Espaços BISUTTI\", analisado nos primeiros 45 minutos após a publicação (13 de maio de 2026).",
        "Indicadores de engajamento, sentimento e vocabulário, perguntas e marcações, 6 personas comportamentais, temas da conversa e matriz de impacto × esforço.",
        "Forte associação emocional com sofisticação, celebração e desejo de experiência presencial. Decoração (score 88) e casamento (82) concentram a afetividade; orçamento é o ponto crítico (score 31) e pede resposta ágil.",
        "Atendimento ativo em até 2 horas para dúvidas de orçamento, campanha \"Marque quem vai casar\", tour visual dos espaços e CTA para visita consultiva.",
        "426 comentários, 312 compartilhamentos, 198 salvamentos, 21 comentários com intenção de orçamento e 16 com desejo de visita."] },
  { who: "Volkswagen Brasil · Convocação da Seleção", sector: "Patrocínio esportivo · Reel no Instagram", url: "https://vw-selecao-case.netlify.app/",
    q: "A torcida ama a marca pelo <em>passado</em> ou pelo futuro?", layout: "l-center", motif: "arcs", pos: [.5, 1.05],
    kpis: [["1.513", "comentários"], ["1.067", "vozes únicas"], ["+79", "Brand Love"], ["12", "potencial viral"]],
    feel: "Afeto, paixão, desejo e legado familiar",
    d: ["Entender como a comunidade sente o patrocínio à Seleção e o que fazer com essa conversa para a linha de produtos 2026.",
        "Reel publicado em 13/05/2026 sobre a Seleção e o patrocínio à CBF (#Hexa), com 45 minutos de coleta.",
        "Sentimento por léxico bilíngue, 5 temas por coocorrência, 5 personas (K-Means) e quatro índices: Brand Love, Profundidade de Conversa, Momentum de Comunidade e Potencial Viral.",
        "Muito afeto e pouca amplificação: Brand Love +79, potencial viral 12. As histórias de família e da Kombi carregam o vínculo, enquanto eletrificados, conectividade e sustentabilidade não aparecem na conversa.",
        "Converter as vozes em jornadas de produto: \"Marca Quem Vai Pro Hexa\", \"Meu Primeiro Volks\", \"De Kombi ao Hexa\", \"SAC do Torcedor\" e \"PCD Hexa\", com KPIs propostos (inferência).",
        "1.513 comentários e 1.067 vozes únicas; personas de 38,7% (torcedores de emoção rápida) a 1,0% (amplificadores de marca). Sentimento baseado em léxico, não em modelo treinado."] },
  { who: "Volkswagen Brasil · Post Ancelotti", sector: "Patrocínio esportivo · Post no Instagram", url: "https://relatorio-vw-selecao.netlify.app/",
    q: "E quando um post de celebração vira <em>pedido de socorro?</em>", layout: "l-left l-small", motif: "wave", pos: [.7, .5],
    kpis: [["15", "comentários"], ["6", "vozes únicas"], ["60%", "do feed era um único caso de SAC"], ["1", "compra atribuída ao patrocínio"]],
    feel: "Desespero, fé, cobrança e pertencimento",
    d: ["Separar o que é crise real do que é ruído, e entender o que cada pessoa precisava da marca naquele momento.",
        "Post da marca patrocinadora da Seleção. A janela analisada mostrou o oposto do tom celebrativo esperado.",
        "Linha do tempo dos comentários, decodificação semântica, sentimento por volume e por voz única, arquétipos de voz e dossiê por perfil.",
        "Por volume, 67% do feed era negativo; por voz única, 50% das pessoas estavam positivas. Um único cliente com carro novo e sem diagnóstico respondia por 60% do feed. E uma pessoa declarou ter comprado um VW por causa da Seleção.",
        "Resposta humana ao cliente em menos de 6 horas, reconhecimento público da compra atribuída ao patrocínio e moderação contextual de ruído político. Triagem antes de pânico.",
        "15 comentários de 6 vozes, 9 repetições da mesma reclamação em 18 segundos e 1 compra atribuída diretamente ao patrocínio."] },
  { who: "Carmed (Cimed) × Coca-Cola", sector: "Colaboração entre marcas · Reel de sorteio", url: "https://analise-reel-coca-cimed.netlify.app/",
    q: "Quem fica com a <em>emoção</em> numa colaboração entre marcas?", layout: "l-right l-small", motif: "scatter", pos: [.25, .5],
    kpis: [["100%", "sentimento positivo"], ["87%", "citam Coca-Cola"], ["27%", "citam Carmed"], ["4", "motivações distintas"]],
    feel: "Afeto à marca, merecimento e humor",
    d: ["Entender o que move quem participa de um sorteio e qual marca realmente captura o vínculo emocional.",
        "Reel de sorteio de uma \"mala recheada\" da colab Carmed × Coca-Cola, com 15 comentários em 1 minuto e 40 segundos.",
        "Tipologia de motivação, share-of-voice das marcas no comentário, densidade emocional e classificação de valor por perfil.",
        "Assimetria de marca: a Coca-Cola aparece em 87% dos comentários e a Carmed, que paga o sorteio, em 27%. Quatro motivações (devoto, narrativo, humorista, profissional) pedem respostas diferentes. Um sinal sensível (possível luto) exige moderação humana antes de qualquer resposta automática.",
        "Respostas por arquétipo, reforço da Carmed no mecanismo e no CTA, atenção a perfis de alto valor (incluindo uma profissional do canal de varejo) e cuidado com sinais sensíveis.",
        "15 perfis, 100% de sentimento positivo, 4,7 emojis por comentário e 0 menções espontâneas à marca-mãe Cimed."] },
  { who: "Red Bull · Neymar Jr", sector: "Cultura esportiva · Post no Instagram", url: "https://redbull.endurance.solutions/",
    q: "O que significa quando a marca <em>quase não</em> é citada?", layout: "l-center", motif: "rings", pos: [.5, .5],
    kpis: [["10.245", "comentários em 24h"], ["9.309", "autores únicos"], ["+75", "sentimento líquido"], ["4", "menções à marca"]],
    feel: "Orgulho nacional, energia, afeto e fé",
    d: ["Ler a energia de uma convocação e entender onde a marca está, e onde deveria estar, nessa conversa.",
        "Post \"LET'S GO @neymarjr\" de 18/05/2026, com os comentários das primeiras 24 horas.",
        "Mix de sentimento, drivers emocionais, benchmark contra a categoria esportiva, gatilhos emocionais e a camada psicolinguística da conversa.",
        "75,6% positivo e apenas 0,5% negativo. Os motores são orgulho nacional (38%), energia (21%) e afeto pelo atleta (14%). A marca aparece em só 4 comentários: a peça foi vivida como conteúdo cultural, não como anúncio.",
        "Ampliar a energia em conteúdo curto, ancorar a narrativa no arco Brasil + comeback + Copa 2026 e manter o branding discreto, com o atleta como protagonista.",
        "10.245 comentários, 9.309 autores únicos, 2.164 sinais de pura energia, 883 marcações e 51 comentários críticos."] },
  { who: "Copa do Mundo 2026 · Final Argentina × Espanha", sector: "Leitura comportamental · vídeo da partida e comentários no YouTube", url: "https://copadomundo-zeta.vercel.app/",
    q: "O que o placar não mostra sobre <em>a pressão</em> de uma final?", layout: "l-left", motif: "grid", pos: [.72, .5],
    kpis: [],
    feel: "Tensão contida, alerta e concentração intensa",
    d: ["Ler os sinais humanos que o placar não mostra: como tensão e concentração aparecem em campo nos momentos decisivos de uma final, e como a torcida reagiu.",
        "Final da Copa do Mundo de 2026 entre Argentina e Espanha, com vitória espanhola. Leitura feita a partir do vídeo da partida e de comentários públicos no YouTube.",
        "Registros faciais e corporais por timestamp (68 pontos faciais e Action Units), um índice de microtensão, 108 clipes, 14 oportunidades táticas cruzadas com regras de especialistas e 1.086 comentários públicos da torcida.",
        "Picos de microtensão em momentos-chave da partida e um cenário de \"controle e confiança\" (posse calma e apoio curto) como a resposta mais recorrente nesses picos. Na torcida, a despedida (\"até 2030\") foi o tema que mais mobilizou, e o VAR concentrou a maior parte das menções negativas.",
        "Monitoramento ao vivo para comissões técnicas, relatórios pós-jogo de performance, simulação de cenários e leitura de torcida para marcas e patrocinadores.",
        "51 registros comportamentais de 13 jogadores, taxa média de detecção facial de 92,6%, 108 clipes revisados e 1.086 comentários (17.768 curtidas). As leituras são indicativas e contrafactuais: não são diagnósticos nem relações de causa."] },
  { who: "Nissan Kicks · Campanha The Escape", sector: "Campanha publicitária · Instagram, TikTok e YouTube", url: "https://nissan.endurance.solutions/",
    q: "O que uma campanha que <em>divide opiniões</em> revela sobre o desejo?", layout: "l-left", motif: "lines", pos: [.7, .6],
    kpis: [],
    feel: "Desejo, alegria e medo",
    d: ["Entender como o público recebeu uma campanha ousada, o que ela despertou e onde está a fricção entre desejo e decisão de compra.",
        "Campanha \"Nissan Kicks, The Escape\", com conceito criativo de apocalipse zumbi, analisada a partir de 477 feedbacks em Instagram, TikTok e YouTube (junho a novembro de 2026).",
        "Sentimento e emoções por canal, polarização, temas e tópicos, menções a preço e à concorrência, persona do público e riscos de narrativa.",
        "Aprovação líquida (47% positivo, 12% negativo) e opinião forte: 59% dos comentários são expressivos. O conceito gerou memorabilidade e o design agrada, enquanto o preço frente à concorrência chinesa é a principal fricção. A cena do zumbi também abriu um debate sobre segurança e freio automático.",
        "Resposta oficial sobre freio automático e segurança, conteúdo comparativo em formato educativo, ampliação de test drives, parcerias com criadores automotivos e conteúdo segmentado por plataforma.",
        "477 feedbacks, 3,9 comentários positivos para cada negativo, 29 menções diretas ao conceito zumbi, 165 comentários com emojis e 94 marcações de outros usuários."] }
];
/* ---- carousel by theme ---- */
const THEMES = { 0: "Comunidades & Creators", 1: "Experiências & Eventos", 2: "Esporte & Patrocínio", 3: "Atendimento & Relacionamento", 4: "Marketing & Comunicação", 5: "Esporte & Patrocínio", 6: "Esporte & Patrocínio", 7: "Marketing & Comunicação" };
const THEME_ORDER = ["Marketing & Comunicação", "Esporte & Patrocínio", "Comunidades & Creators", "Experiências & Eventos", "Atendimento & Relacionamento"];
CASES.forEach((c, i) => c.theme = THEMES[i]);
const SHORT = ["Defender", "Bisutti", "VW · Convocação", "VW · Post Ancelotti", "Carmed × Coca-Cola", "Red Bull · Neymar Jr", "Copa · Final ARG × ESP", "Nissan Kicks"];
CASES.forEach((c, i) => c.short = SHORT[i]);
CASES.sort((a, b) => THEME_ORDER.indexOf(a.theme) - THEME_ORDER.indexOf(b.theme));   // number the examples in theme order
const casesWrap = $("#cases"), czStage = $("#czStage"), czMenu = $("#czMenu"), motifs = [];
let czIdx = 0, czVisible = false;
CASES.forEach((c, i) => {
  const s = document.createElement("article");
  s.className = "case cz-slide"; s.id = `case-${i + 1}`; s.setAttribute("aria-hidden", "true"); s.setAttribute("aria-roledescription", "slide");
  let wi = 0;
  const words = c.q.replace(/<em>(.*?)<\/em>/g, (m, g) => g.split(" ").map(w => `§${w}`).join(" ")).split(" ")
    .map(w => { const d = `style="transition-delay:${380 + (wi++) * 70}ms"`; return w.startsWith("§") ? `<em class="it word" ${d}>${w.slice(1)}</em>` : `<span class="word" ${d}>${w}</span>`; }).join(" ");
  const n = String(i + 1).padStart(2, "0");
  s.innerHTML = `<canvas class="motif" aria-hidden="true"></canvas>
    <div class="case-ghost" aria-hidden="true">${n}</div>
    <div class="case-inner">
      <div class="case-meta"><span class="cap sm">${c.theme}</span><p class="who">${c.who}</p></div>
      <h3 class="case-q">${words}</h3>
      <div class="case-foot"><p class="case-feel"><span class="cap sm">O que a audiência sentiu</span>${c.feel}</p>
        <button class="btn light case-open" data-dossier="${i}">Abrir dossiê <span class="arr">→</span></button></div>
    </div>`;
  czStage.appendChild(s);
  motifs.push({ el: s, stage: s, canvas: $("canvas", s), kind: c.motif, pos: c.pos, visible: false, seed: i * 17.3 });
});
// side menu grouped by theme
czMenu.innerHTML = `<div class="cz-head"><span class="cap sm cz-title">Pesquisas realizadas</span><p><span>Análises de conteúdos públicos.</span><span>Não são clientes da Endurance.</span></p></div>
  <ol class="cz-list">${CASES.map((c, i) => `<li><button class="cz-item" data-go="${i}"><b>${String(i + 1).padStart(2, "0")}</b><span><em>${c.short}</em><small>${c.theme}</small></span></button></li>`).join("")}</ol>`;
function goCase(i, dir) {
  i = (i + CASES.length) % CASES.length;
  const prev = czIdx; czIdx = i;
  motifs.forEach((m, j) => {
    const on = j === i;
    m.el.classList.toggle("on", on); m.el.setAttribute("aria-hidden", !on);
    m.el.classList.toggle("from-left", !on && j === prev && dir < 0);
    m.visible = on && czVisible; if (on) sizeMotif(m);
  });
  $$(".cz-item", czMenu).forEach(b => b.classList.toggle("on", +b.dataset.go === i));
  $("#czCount").textContent = `${String(i + 1).padStart(2, "0")} / ${String(CASES.length).padStart(2, "0")}`;
  $("#czTheme").textContent = CASES[i].theme;
  $("#czBar").style.width = ((i + 1) / CASES.length * 100) + "%";
  $("#czNextName").textContent = CASES[(i + 1) % CASES.length].short;
  $("#czPrevName").textContent = CASES[(i - 1 + CASES.length) % CASES.length].short;
  const item = $(`.cz-item[data-go="${i}"]`, czMenu);
  if (item && czMenu.scrollWidth > czMenu.clientWidth) czMenu.scrollTo({ left: item.offsetLeft - (czMenu.clientWidth - item.offsetWidth) / 2, behavior: S.reduced ? "auto" : "smooth" });
  if (S.scene === "case") { const c = CASES[i]; field.preset({ ...SCENES.case.field, cx: 1 - c.pos[0], cy: c.pos[1] > 1 ? .2 : 1 - c.pos[1] }); }
}
czMenu.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b) goCase(+b.dataset.go, +b.dataset.go < czIdx ? -1 : 1); });
$("#czPrev").addEventListener("click", () => goCase(czIdx - 1, -1));
$("#czNext").addEventListener("click", () => goCase(czIdx + 1, 1));
addEventListener("keydown", e => {
  if (!czVisible || $("#dossier").classList.contains("open") || $("#menu").classList.contains("open") || document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (e.key === "ArrowRight") { e.preventDefault(); goCase(czIdx + 1, 1); }
  if (e.key === "ArrowLeft") { e.preventDefault(); goCase(czIdx - 1, -1); }
});
{ let x0 = null, y0 = 0; czStage.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  czStage.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) goCase(czIdx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); x0 = null; }); }
new IntersectionObserver(es => es.forEach(en => { czVisible = en.isIntersecting; motifs.forEach((m, j) => m.visible = czVisible && j === czIdx); if (czVisible) sizeMotif(motifs[czIdx]); }), { threshold: .2 }).observe(casesWrap);
function sizeMotif(m) {
  const dpr = Math.min(devicePixelRatio || 1, lowPower ? 1 : 1.5); const r = m.stage.getBoundingClientRect();
  if (!r.width) return;
  m.canvas.width = r.width * dpr; m.canvas.height = r.height * dpr; m.w = r.width; m.h = r.height; m.dpr = dpr;
}
addEventListener("resize", () => motifs.forEach(m => m.visible && sizeMotif(m)));
goCase(0, 1);
function drawMotif(m, t) {
  const ctx = m.canvas.getContext("2d"), w = m.w, h = m.h; if (!w) return;
  ctx.setTransform(m.dpr, 0, 0, m.dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const cx = m.pos[0] * w, cy = m.pos[1] * h, S0 = Math.min(w, h);
  ctx.lineWidth = 1;
  const sand = a => `rgba(201,194,177,${a})`, orng = a => `rgba(247,175,101,${a})`;
  if (S.reduced) t = 4;
  switch (m.kind) {
    case "rings": { // a return, rippling
      for (let i = 0; i < 26; i++) { const ph = ((i / 26) + t * .05) % 1; ctx.strokeStyle = i % 9 === 0 ? orng(.5 * (1 - ph)) : sand(.28 * (1 - ph)); ctx.beginPath(); ctx.arc(cx, cy, ph * S0 * .75, 0, TAU); ctx.stroke(); }
      break;
    }
    case "scatter": { // many pieces becoming one shape
      const n = 420; for (let i = 0; i < n; i++) {
        const a = hash(i, 1, 3) * TAU, rr = hash(i, 2, 5); const k = (Math.sin(t * .5 + i * .01) + 1) / 2;
        const tx = cx + Math.cos(i / n * TAU) * S0 * .22, ty = cy + Math.sin(i / n * TAU) * S0 * .22;
        const fx = cx + Math.cos(a) * rr * S0 * .7, fy = cy + Math.sin(a) * rr * S0 * .7;
        const x = lerp(fx, tx, smooth(k)), y = lerp(fy, ty, smooth(k));
        ctx.fillStyle = i % 23 === 0 ? orng(.8) : sand(.45); ctx.fillRect(x, y, 2, 2);
      } break;
    }
    case "wave": { // a voice, listened to
      for (let j = 0; j < 7; j++) {
        ctx.strokeStyle = j === 3 ? orng(.7) : sand(.22); ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const env = Math.exp(-Math.pow((x - cx) / (w * .28), 2));
          const y = cy + Math.sin(x * .018 + t * 1.6 + j * .7) * env * (40 + j * 14) * (0.6 + 0.4 * Math.sin(t * .8 + j));
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        } ctx.stroke();
      } break;
    }
    case "arcs": { // a stadium, all at once
      for (let i = 0; i < 22; i++) {
        const r = S0 * .2 + i * S0 * .035; const segs = 40 + i * 4;
        for (let s = 0; s < segs; s++) {
          const a0 = Math.PI + s / segs * Math.PI, on = noise3(s * .3, i * .4, t * .9) > .25;
          ctx.strokeStyle = on ? orng(.75) : sand(.18);
          ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + Math.PI / segs * .7); ctx.stroke();
        }
      } break;
    }
    case "grid": { // segments vs. feelings
      const g = 26; for (let x = g; x < w; x += g) for (let y = g; y < h; y += g) {
        const v = noise3(x * .006, y * .006, t * .2); const r = 1 + Math.max(0, v) * 2.6;
        ctx.fillStyle = v > .45 ? orng(.45) : sand(.14 + Math.max(0, v) * .3); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      } break;
    }
    case "spiral": { // a memory forming
      const n = 520; for (let i = 0; i < n; i++) {
        const a = i * 2.39996 + t * .08, r = Math.sqrt(i / n) * S0 * .46;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        ctx.fillStyle = (i % 34 === 0) ? orng(.9) : sand(.35 * (1 - i / n) + .1); ctx.fillRect(x, y, 1.8, 1.8);
      } break;
    }
    case "lines": { // a road of choices
      for (let j = 0; j < 30; j++) {
        const y0 = h * .35 + j * (h * .6 / 30); ctx.strokeStyle = j === 18 ? orng(.7) : sand(.2); ctx.beginPath();
        for (let x = 0; x <= w; x += 8) { const n = noise3(x * .004 + t * .15, j * .2, 1); const y = y0 + n * 30 * (j / 30); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      } break;
    }
  }
}
casesWrap.addEventListener("click", e => { const d = e.target.closest("[data-dossier]"); if (d) openDossier(+d.dataset.dossier); });
const DOSSIER_FIELDS = ["O desafio humano", "O contexto", "O que investigamos", "O que a inteligência revelou", "Possibilidades geradas", "Evidências"];
function openDossier(i) {
  const c = CASES[i], el = $("#dossier");
  el.innerHTML = `<button class="close-x" aria-label="Fechar dossiê">×</button><div class="dossier-in">
    <span class="cap sm">Dossiê · Pesquisa ${String(i + 1).padStart(2, "0")} · ${c.who}</span>
    <h2>${c.q}</h2>
    <p class="dossier-note"><b>Pesquisa realizada.</b> Análise da Endurance sobre conteúdos e conversas públicas, para demonstrar o que a nossa inteligência revela. As marcas, clubes ou seleções citados não são clientes da Endurance.</p>
    <div class="dossier-grid">${DOSSIER_FIELDS.map((f, j) => `<div><span class="cap sm">0${j + 1}</span><p class="serif">${f}</p><p>${c.d[j]}</p></div>`).join("")}</div>
    <div style="margin-top:40px;display:flex;gap:14px;flex-wrap:wrap;align-items:center"><a class="btn solid" href="${c.url}" target="_blank" rel="noopener">Abrir relatório interativo <span class="arr">↗</span></a><button class="btn" data-close>Voltar à narrativa</button><button class="btn" data-ask="${i}">Perguntar sobre esta análise</button></div>
  </div>`;
  openOverlay(el);
  el.querySelector(".close-x").onclick = () => closeOverlay(el);
  el.querySelector("[data-close]").onclick = () => closeOverlay(el);
  el.querySelector("[data-ask]").onclick = () => { closeOverlay(el); toggleCompanion(true); askCompanion(`Na pesquisa "${c.who}", o que essa análise revela sobre o que as pessoas sentem, e como isso se aplicaria a um desafio parecido?`); };
  el.scrollTop = 0;
}


/* ---------------- LOOP ---------------- */
const loopSvg = $("#loopSvg"); const LR = 220, LC = 300;
loopSvg.innerHTML = `
  <circle cx="${LC}" cy="${LC}" r="${LR}" fill="none" stroke="#2c3b4e" stroke-opacity=".15"/>
  <circle cx="${LC}" cy="${LC}" r="${LR + 26}" fill="none" stroke="#2c3b4e" stroke-opacity=".08" stroke-dasharray="2 6"/>
  <circle id="loopArc" cx="${LC}" cy="${LC}" r="${LR}" fill="none" stroke="#a3523a" stroke-width="2.5" stroke-linecap="round" transform="rotate(-90 ${LC} ${LC})" stroke-dasharray="0 9999"/>
  ${["Compreender", "Observar", "Refletir", "Construir"].map((n, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 2; const x = LC + Math.cos(a) * LR, y = LC + Math.sin(a) * LR;
    const lx = LC + Math.cos(a) * (LR - 34), ly = LC + Math.sin(a) * (LR - 44) + 9;
    const anchor = i === 1 ? "end" : i === 3 ? "start" : "middle";
    return `<g class="st" data-i="${i}"><circle cx="${x}" cy="${y}" r="9" fill="#ece8dd" stroke="#2c3b4e"/><text x="${lx}" y="${ly}" text-anchor="${anchor}">${n}</text></g>`;
  }).join("")}
  <text x="${LC}" y="${LC + 6}" text-anchor="middle" style="font-size:50px;font-style:italic">LOOP</text>
  <text x="${LC}" y="${LC + 40}" text-anchor="middle" style="font-family:Instrument Sans;font-size:11px;letter-spacing:3px" opacity=".6">ITERATIVO</text>
  <circle id="loopDot" r="7" fill="#a3523a"/>`;
const loopArc = $("#loopArc"), loopDot = $("#loopDot"), loopSteps = $$("#loopStep > div"), loopSt = $$(".st", loopSvg);
const CIRC = TAU * LR; let loopIdx = -1;
function updateLoop(p) {
  const turn = clamp(p / .92) * 1.25;
  const frac = Math.min(1, turn);
  loopArc.setAttribute("stroke-dasharray", `${(frac * CIRC).toFixed(1)} 9999`);
  const a = -Math.PI / 2 + turn * TAU;
  loopDot.setAttribute("cx", LC + Math.cos(a) * LR); loopDot.setAttribute("cy", LC + Math.sin(a) * LR);
  const idx = turn >= 1 ? 4 : Math.min(3, Math.floor(turn * 4 + .02));
  if (idx !== loopIdx) {
    loopIdx = idx; loopSteps.forEach((s, j) => s.classList.toggle("on", j === idx));
    loopSt.forEach((g, j) => { const c = g.querySelector("circle"); const on = idx === 4 ? j === 0 : j <= idx; c.setAttribute("fill", on ? "#a3523a" : "#ece8dd"); c.setAttribute("stroke", on ? "#a3523a" : "#2c3b4e"); });
  }
}

/* ---------------- AI (Groq via server.py proxy — the key stays on the server) ---------------- */
async function groqSample(input, opts = {}) {
  const messages = typeof input === "string" ? [{ role: "user", content: input }] : input;
  const res = await fetch("api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages, kind: opts.modelTier === "quick" ? "chat" : "explore" }), signal: opts.signal });
  if (!res.ok) {
    let msg = ""; try { msg = (await res.json()).error || ""; } catch (e) {}
    const err = new Error(msg === "rate_limited" ? "" : msg); if (res.status === 429) err.code = "rate_limited"; throw err;
  }
  const reader = res.body.getReader(), dec = new TextDecoder(); let text = "";
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    text += dec.decode(value, { stream: true }); opts.onText && opts.onText({ text });
  }
  text += dec.decode();
  if (!text.trim()) throw new Error("resposta vazia");
  return { text };
}
let samplePromise = null;
function getSample() {
  if (!samplePromise) samplePromise = fetch("api/health", { cache: "no-store" }).then(r => r.ok ? groqSample : null).catch(() => null);
  return samplePromise;
}
getSample();
const KB = `Você fala em nome da Endurance, um laboratório de pesquisa e desenvolvimento em análise humana — "AI Lab for Human Intelligence".
Propósito: compreender os sentimentos humanos fundamentais, desenvolver tecnologias capazes de investigar e codificar essa dimensão humana e transformar essa inteligência em novas possibilidades. A inteligência artificial é o motor de pesquisa, desenvolvimento e aplicação. O ser humano é a razão de existir.
Posicionamento: "We don't start with what people do. We start with what they feel." O foco não é o comportamento — o comportamento é uma das possíveis manifestações da experiência emocional. O foco são os sentimentos fundamentais que podem influenciar percepções, experiências e decisões. Sentimentos inferidos nunca são tratados como certezas: há contextualização, estimativas probabilísticas e validação.
A Endurance NÃO é: agência de marketing, consultoria tradicional, empresa convencional de análise comportamental, plataforma genérica de IA, software house que apenas executa demandas. É um laboratório de pesquisa, inteligência e desenvolvimento tecnológico.
Human Intelligence Engine: o modelo cognitivo da Endurance. Transforma sinais humanos em um modelo vivo de comportamento, relacionando sentimentos, estados emocionais, decisões e impactos de negócio; esse modelo alimenta continuamente a inteligência usada para criar, simular e validar novas experiências. Sentimentos fundamentais do modelo: Confiança, Medo, Raiva, Tristeza, Nojo, Surpresa, Antecipação e Felicidade; cada um se desdobra em estados emocionais, comportamentos e impactos (ex.: Felicidade → Satisfação → Permanecer → Retenção). Quatro camadas (classificação, intensidade, probabilidade, impacto): 1) Sentimento fundamental — o que a pessoa pode estar sentindo (objeto principal da pesquisa); 2) Estado emocional — intensidade e contexto; 3) Comportamento — possíveis ações associadas, analisadas probabilisticamente; 4) Impacto no negócio — relação estimada e validável com indicadores. Não é uma cadeia causal universal.
LOOP (metodologia para descobrir e estruturar projetos com clientes): movimentos iterativos de Compreender, Observar, Refletir e Construir. Começa pelos desafios organizacionais; investiga jornadas, pessoas, contextos e experiências; identifica onde fatores humanos influenciam resultados relevantes; prioriza oportunidades; desenvolve hipóteses e estrutura um projeto com objetivos, entregáveis e indicadores. O discovery pode resultar em: mapa de desafios, oportunidades priorizadas, hipóteses, escopo de projeto, indicadores, critérios de sucesso. Depois, conforme o projeto: pesquisa, prototipagem, desenvolvimento, integração, validação e evolução. O cliente não precisa chegar com uma solução pronta — pode chegar com um problema, uma oportunidade ou uma pergunta.
Ecossistema tecnológico do laboratório (cinco frentes, cada uma nascida de uma linha de pesquisa; podem ser usadas sozinhas ou combinadas em um projeto): Atlas — motor de inferência de sentimentos probabilísticos que analisa o feedback da audiência em posts de canais digitais; responde "o que a audiência sente, inclusive o que não diz explicitamente?"; durante e depois; analogia: o termômetro. Gargantua — modelo de análise de criativos e campanhas que cruza previsibilidade neural com o motor de inferência; responde "este criativo vai prender atenção, reter e gerar ação? que reação emocional provoca?"; antes; analogia: o túnel de vento. Tesseract — simulador de clientes que cria audiências sintéticas variadas em cognição, persona, contexto e localização, com tecnologia agêntica; responde "como públicos específicos reagiriam a este cenário, produto ou campanha?"; antes; analogia: o simulador de voo. Ben — frente de SDKs para integrar a inteligência da Endurance a soluções existentes, sob demanda; responde "como ativar sentimento e reação dentro da experiência que o cliente já tem?"; durante; analogia: a peça que encaixa tudo no motor do cliente. Projetos sob medida — divisão de P&D para pesquisas de tiro curto e provas de conceito; responde "existe uma solução para um desafio que nenhuma frente cobre ainda?"; qualquer momento. Não invente detalhes técnicos além disso.
Pesquisas realizadas pela Endurance (NÃO são clientes da Endurance; são análises da Endurance sobre conversas públicas em redes sociais, feitas para demonstrar a inteligência): 1) Defender (@defenderuiz, comunidade off-road): 153 comentários, 124 vozes, sentimento líquido +78; uma crítica gerou 31 defesas espontâneas e 20% do engajamento; emoções: orgulho de marca, admiração técnica, aspiração. 2) Bisutti (espaços para eventos): sentimento +68, 21 sinais de intenção comercial, 47 dúvidas, 6 personas; encantamento e desejo; oportunidade: transformar afeto em visitas e orçamentos com resposta em até 2h. 3) Volkswagen Brasil, convocação da Seleção: 1.513 comentários, 1.067 vozes, Brand Love +79 e potencial viral 12; a torcida ama a marca pelo passado (família, Kombi), não pelo futuro (eletrificados ausentes). 4) Volkswagen Brasil, post Ancelotti: 15 comentários de 6 vozes; 60% do feed era um único caso de SAC; por voz única 50% positivo; 1 compra atribuída ao patrocínio; lição: triagem antes de pânico. 5) Carmed (Cimed) × Coca-Cola: 100% positivo, Coca citada em 87% e Carmed em 27% dos comentários; 4 motivações; um sinal sensível exigiu moderação humana. 6) Red Bull × Neymar Jr: 10.245 comentários em 24h, 9.309 autores, sentimento +75; orgulho nacional 38%, energia 21%; a marca foi citada só 4 vezes, sinal de que a peça foi vivida como cultura. 7) Copa do Mundo 2026, final Argentina × Espanha: leitura comportamental do vídeo da partida (68 pontos faciais, Action Units, índice de microtensão, 108 clipes, 14 oportunidades táticas) e de 1.086 comentários no YouTube; picos de tensão em momentos-chave, cenário de controle e confiança como resposta mais recorrente; na torcida, a despedida ('até 2030') mobilizou e o VAR concentrou a negatividade. Leituras indicativas e contrafactuais, não diagnósticos nem causalidade. 8) Nissan Kicks, campanha The Escape (conceito de apocalipse zumbi): 477 feedbacks em Instagram, TikTok e YouTube; 47% positivo e 12% negativo, 59% de comentários expressivos; desejo, alegria e medo; o design agrada e o preço frente à concorrência chinesa é a principal fricção; a cena gerou debate sobre segurança e freio automático. Chame-as de "pesquisas realizadas" e sempre deixe claro que as marcas não são clientes. Não cite nomes de pessoas comuns.
Regras: nunca invente clientes, cases, resultados, métricas, prazos, preços ou capacidades técnicas. Trate sentimentos como hipóteses. Não prometa resultados. Seja claro, elegante e breve, sem jargão de marketing. Responda no idioma em que a pessoa escrever.`;
function aiError(e) {
  const c = e && e.code;
  if (c === "not_granted") return "A permissão para usar o agente de IA não foi concedida nesta visualização.";
  if (c === "rate_limited") return "Muitas solicitações em sequência. Tente novamente em alguns instantes.";
  return "Não foi possível consultar o agente agora." + (e && e.message ? ` (${e.message})` : "");
}

/* ---------------- ACT VI ---------------- */
function renderBuildQ() {
  const q = $("#buildQ"); const pre = S.name ? `${S.name.split(" ")[0]}, what` : "What";
  const txt = `${pre} would you build if you could understand how people §feel?`;
  q.innerHTML = txt.split(" ").map((w, j) => w.startsWith("§") ? `<em class="it w" style="transition-delay:${j * 70}ms">${w.slice(1)}</em>` : `<span class="w" style="transition-delay:${j * 70}ms">${w}</span>`).join(" ");
}
renderBuildQ();
new IntersectionObserver(es => es.forEach(en => en.isIntersecting && $("#buildQ").classList.add("in")), { threshold: .3 }).observe($("#buildQ"));
const EXAMPLES = ["Entender por que clientes abandonam a jornada de compra", "Criar uma experiência de marca que emocione no momento certo", "Compreender o que torcedores sentem ao longo de uma partida", "Melhorar o atendimento a partir do que o cliente sente"];
EXAMPLES.forEach(x => { const b = document.createElement("button"); b.className = "chip"; b.textContent = x; b.onclick = () => { $("#idea").value = x; $("#idea").focus(); }; $("#examples").appendChild(b); });
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let lastSheet = "";
$("#explore").addEventListener("click", async () => {
  const idea = $("#idea").value.trim(), st = $("#aiStatus"), sheet = $("#sheet"), btn = $("#explore");
  if (idea.length < 12) { st.textContent = "Descreva o desafio com um pouco mais de contexto (uma ou duas frases bastam)."; $("#idea").focus(); return; }
  const sample = await getSample();
  if (!sample) { st.textContent = "O agente de IA está indisponível no momento. Nenhuma resposta pré-escrita é exibida no lugar dele."; return; }
  btn.disabled = true; sheet.classList.remove("show");
  st.innerHTML = `<span class="thinking"><i></i><i></i><i></i><span style="margin-left:10px">Interpretando o desafio…</span></span>`;
  const prompt = `${KB}

Tarefa: um visitante${S.name ? ` chamado ${S.name}` : ""} descreveu um desafio, ideia ou oportunidade. Faça uma exploração inicial de possíveis caminhos de projeto DENTRO das capacidades descritas acima. É um ponto de partida para uma conversa, não uma proposta.
Desafio do visitante:
"""${idea}"""

Responda APENAS com JSON válido, sem texto antes ou depois, neste formato:
{"leitura":"releitura do desafio em até 40 palavras, centrada no que as pessoas podem estar sentindo",
"sentimentos":[{"nome":"sentimento fundamental hipotético","porque":"até 20 palavras"}] (exatamente 3),
"caminhos":[{"titulo":"nome curto do caminho","investigar":"o que investigaríamos, até 25 palavras","construir":"o que poderia ser construído, até 25 palavras","indicadores":"indicadores que poderiam ser acompanhados, até 15 palavras"}] (exatamente 3),
"perguntas":["perguntas para o discovery (LOOP)"] (exatamente 4),
"proximo_passo":"uma frase convidando para uma conversa estratégica"}
Use o idioma do visitante.`;
  try {
    const ctrl = new AbortController();
    const res = await sample(prompt, { modelTier: "default", signal: ctrl.signal, onText: ({ text }) => { st.querySelector("span span") && (st.querySelector("span span").textContent = `Compondo possibilidades… ${text.length} caracteres`); } });
    const raw = res.text || ""; let data = null;
    try { data = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); } catch (e) { data = null; }
    st.textContent = "";
    if (!data || !Array.isArray(data.caminhos)) { sheet.innerHTML = `<div class="sheet-head"><span class="cap sm">Exploração inicial · gerada por IA</span></div><div class="raw">${esc(raw)}</div>`; sheet.classList.add("show"); lastSheet = raw; btn.disabled = false; return; }
    sheet.innerHTML = `
      <div class="sheet-head"><span class="cap sm" style="color:var(--orange)">Exploração inicial · gerada por IA${S.name ? ` para ${esc(S.name)}` : ""}</span><span class="cap sm muted">Ponto de partida para conversa · não é uma proposta</span></div>
      <p class="sheet-lede" data-reveal>${esc(data.leitura)}</p>
      <div class="sheet-cols">
        <div data-reveal><span class="cap sm muted">Sentimentos que podem estar em jogo · hipóteses</span><ul class="feel-h">${(data.sentimentos || []).map(f => `<li><span class="serif it">${esc(f.nome)}</span><p>${esc(f.porque)}</p></li>`).join("")}</ul></div>
        <div data-reveal><span class="cap sm muted">Caminhos de projeto possíveis</span><div class="paths" style="margin-top:14px">${data.caminhos.map((c, j) => `<div class="path"><span class="cap sm">Caminho 0${j + 1}</span><p class="serif">${esc(c.titulo)}</p><dl><dt>Investigar</dt><dd>${esc(c.investigar)}</dd><dt>Construir</dt><dd>${esc(c.construir)}</dd><dt>Indicadores</dt><dd>${esc(c.indicadores)}</dd></dl></div>`).join("")}</div></div>
      </div>
      <div class="qs" data-reveal><span class="cap sm muted">Perguntas para o discovery · LOOP</span><div><ol>${(data.perguntas || []).map(q => `<li>${esc(q)}</li>`).join("")}</ol><p style="margin-top:24px;font-family:var(--serif);font-size:24px;color:var(--orange)">${esc(data.proximo_passo)}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:26px"><button class="btn light" id="copySheet">Copiar exploração</button><button class="btn light" id="refine">Refinar o desafio</button></div><div class="ai-status" id="copyOut"></div></div></div>`;
    lastSheet = `Desafio: ${idea}\n\nLeitura: ${data.leitura}\n\nSentimentos (hipóteses):\n${(data.sentimentos || []).map(f => `- ${f.nome}: ${f.porque}`).join("\n")}\n\nCaminhos:\n${data.caminhos.map((c, j) => `${j + 1}. ${c.titulo}\n   Investigar: ${c.investigar}\n   Construir: ${c.construir}\n   Indicadores: ${c.indicadores}`).join("\n")}\n\nPerguntas para o discovery:\n${(data.perguntas || []).map(q => `- ${q}`).join("\n")}`;
    sheet.classList.add("show");
    $$("[data-reveal]", sheet).forEach((el, j) => setTimeout(() => el.classList.add("in"), 120 + j * 180));
    $("#copySheet").onclick = async () => { try { await navigator.clipboard.writeText(lastSheet); $("#copyOut").textContent = "Copiado."; } catch (e) { $("#copyOut").textContent = "Não foi possível copiar nesta visualização."; } };
    $("#refine").onclick = () => { $("#idea").focus(); goTo("act-6", innerHeight * .25); };
  } catch (e) { st.textContent = aiError(e); }
  btn.disabled = false;
});
$("#talkBtn").addEventListener("click", () => {
  $("#talkOut").innerHTML = `Nesta versão de demonstração a solicitação ainda não é enviada. <span class="ph-tag">canal oficial de contato a definir</span>${lastSheet ? " Você pode copiar sua exploração acima e levá-la para a conversa." : ""}`;
});

/* ---------------- COMPANION ---------------- */
const comp = $("#companion"), compBody = $("#compBody"); let compHistory = [], compBusy = false;
const SUGS = {
  1: ["Por que começar pelos sentimentos?", "O que é um sentimento fundamental?"],
  2: ["Qual a diferença entre sentimento e comportamento?", "A Endurance é uma agência?"],
  3: ["Como funcionam as quatro camadas?", "Como vocês lidam com a incerteza das inferências?"],
  4: ["Que tipos de desafio vocês ajudam a resolver?", "Como um projeto começa?"],
  5: ["O que sai de um discovery?", "Qual a diferença entre o Engine e o LOOP?"],
  6: ["Como formular um bom desafio?", "Quais são os próximos passos?"]
};
function addMsg(cls, text) { const d = document.createElement("div"); d.className = `msg ${cls}`; d.textContent = text; compBody.appendChild(d); compBody.scrollTop = compBody.scrollHeight; return d; }
function renderSugs() {
  $$(".sugs", compBody).forEach(s => s.remove());
  const s = document.createElement("div"); s.className = "sugs";
  (SUGS[S.act] || SUGS[1]).forEach(q => { const b = document.createElement("button"); b.textContent = q; b.onclick = () => askCompanion(q); s.appendChild(b); });
  compBody.appendChild(s); compBody.scrollTop = compBody.scrollHeight;
}
async function toggleCompanion(open) {
  const o = open ?? !comp.classList.contains("open");
  comp.classList.toggle("open", o); comp.setAttribute("aria-hidden", !o);
  document.body.classList.toggle("comp-open", o);
  if (o) {
    $("#compCtx").textContent = `Você está em: Ato ${ACTS[S.act - 1].n} — ${ACTS[S.act - 1].title}`;
    if (!compBody.children.length) {
      const sample = await getSample();
      addMsg("sys", sample ? "Pergunte sobre o que está vendo. Eu acompanho em que ponto da experiência você está." : "O agente de IA está indisponível no momento.");
    }
    renderSugs(); setTimeout(() => $("#compInput").focus({ preventScroll: true }), 500);
  }
}
async function askCompanion(q) {
  if (compBusy || !q.trim()) return;
  $$(".sugs", compBody).forEach(s => s.remove());
  addMsg("user", q);
  const sample = await getSample();
  if (!sample) { addMsg("sys", "Agente indisponível no momento. Nenhuma resposta pré-escrita é exibida no lugar dele."); return; }
  compBusy = true;
  const out = addMsg("ai", "…");
  const ctx = `\n\nContexto: o visitante${S.name ? ` (${S.name})` : ""} está na experiência digital privada da Endurance, no Ato ${ACTS[S.act - 1].n} — ${ACTS[S.act - 1].title}. Responda como um guia discreto do laboratório: no máximo 120 palavras, em prosa, sem listas longas, sem markdown.`;
  compHistory.push({ role: "user", content: q });
  const hist = compHistory.slice(-8);
  while (hist.length && hist[0].role !== "user") hist.shift();
  const input = hist.map((m, i) => i === 0 ? { role: "user", content: KB + ctx + "\n\nPergunta: " + m.content } : m);
  try {
    const res = await sample(input, { modelTier: "quick", cache: false, onText: ({ text }) => { out.textContent = text; compBody.scrollTop = compBody.scrollHeight; } });
    out.textContent = res.text; compHistory.push({ role: "assistant", content: res.text });
  } catch (e) { out.remove(); compHistory.pop(); addMsg("sys", aiError(e)); }
  compBusy = false; renderSugs();
}
$("#askBtn").addEventListener("click", () => toggleCompanion());
$("#compClose").addEventListener("click", () => toggleCompanion(false));
$("#compForm").addEventListener("submit", e => { e.preventDefault(); const v = $("#compInput").value; $("#compInput").value = ""; askCompanion(v); });
$("#compInput").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#compForm").requestSubmit(); } });


/* ---------------- NAVIGATION HINTS (contextual) ---------------- */
const HINTS = {
  act1: ["scroll", "Role para continuar · clique no campo para senti-lo"],
  moments: ["scroll", "Role para viver cada instante · mova o cursor e clique no campo"],
  transition: ["scroll", "Role para continuar"],
  thesis: ["scroll", "Role para conhecer a Endurance"],
  principle: ["scroll", "Role para revelar"],
  thesisbody: ["scroll", "Role para continuar"],
  engine: ["click", "Clique em um sentimento no gráfico ou nos botões abaixo"],
  lab: ["hover", "Passe o mouse (ou toque) em uma frente para ver os detalhes"],
  cases: ["scroll", "Role para ver as pesquisas"],
  case: ["keys", "Use ← → ou o menu lateral para navegar entre as pesquisas"],
  loop: ["scroll", "Role para percorrer o LOOP"],
  loopout: ["scroll", "Role para o convite final"],
  build: ["type", "Descreva seu desafio e clique em Explorar possibilidades"]
};
if (isTouch) Object.assign(HINTS, {
  act1: ["scroll", "Role para continuar · toque no campo para senti-lo"],
  moments: ["scroll", "Role para viver cada instante · toque no campo"],
  engine: ["click", "Toque em um sentimento no gráfico ou nos botões abaixo"],
  lab: ["click", "Toque em uma frente para ver os detalhes"],
  case: ["click", "Deslize para o lado ou use as setas para navegar entre as pesquisas"],
  build: ["type", "Descreva seu desafio e toque em Explorar possibilidades"]
});
if (isTouch) { $(".lab-cue").textContent = "Toque em uma frente para ver o que ela faz"; $("#moments .corner.br").textContent = "Toque · o campo responde"; }
const hintEl = $("#hint"); let hintT = null, idleT = null, hintKey = "";
function showHint(key, ms = 4800) {
  const h = HINTS[key]; if (!h || document.body.classList.contains("locked")) return;
  hintKey = key; hintEl.dataset.kind = h[0]; $("#hintTxt").textContent = h[1];
  hintEl.classList.add("on"); clearTimeout(hintT); hintT = setTimeout(() => hintEl.classList.remove("on"), ms);
}
function armIdle() { clearTimeout(idleT); idleT = setTimeout(() => showHint(S.scene, 6000), 3200); }
addEventListener("scroll", () => { hintEl.classList.remove("on"); armIdle(); }, { passive: true });
addEventListener("pointerdown", armIdle, { passive: true });
armIdle();

/* ---------------- SCROLL ENGINE ---------------- */
const sceneEls = () => $$("[data-scene]");
let allScenes = sceneEls();
const prMask = $("#prMask"), prImg = $("#prMask img"), prShade = $("#prShade"), prL1 = $("#prL1"), prL2 = $("#prL2"), prStrike = $("#prStrike");
function updatePrinciple(p) {
  const t = ease(clamp(p / .42));
  prMask.style.clipPath = `inset(${lerp(18, 0, t).toFixed(2)}% ${lerp(30, 0, t).toFixed(2)}% ${lerp(18, 0, t).toFixed(2)}% ${lerp(30, 0, t).toFixed(2)}%)`;
  prImg.style.transform = `scale(${lerp(1.2, 1.02, t).toFixed(4)})`;
  prShade.style.opacity = lerp(.25, .88, ease(clamp((p - .28) / .22))).toFixed(3);
  const l1 = ease(clamp((p - .34) / .12)), l2 = ease(clamp((p - .62) / .12));
  prL1.style.opacity = l1.toFixed(3); prL1.style.transform = `translateY(${((1 - l1) * 30).toFixed(1)}px)`;
  prL2.style.opacity = l2.toFixed(3); prL2.style.transform = `translateY(${((1 - l2) * 30).toFixed(1)}px)`;
  prStrike.style.setProperty("--s", ease(clamp((p - .5) / .08)).toFixed(3));
}
const pins = { principle: [$("#principle"), updatePrinciple], act1: [act1, updateAct1], moments: [$("#moments"), updateMoments], transition: [$("#act-2"), updateTransition], loop: [$("#act-5"), updateLoop] };
function pinProgress(el) { const r = el.getBoundingClientRect(); return clamp(-r.top / (r.height - innerHeight)); }
function enterScene(name, el) {
  if (!['act1', 'moments', 'transition'].includes(name)) Sound.zone('quiet');
  S.scene = name; setTimeout(() => { if (S.scene === name) showHint(name); }, 900); const cfg = SCENES[name] || SCENES.act1;
  const act = +(el.dataset.act || cfg.act);
  if (act !== S.act || !$("#actLabel").dataset.set) {
    S.act = act; $("#actLabel").dataset.set = 1;
    $("#actLabel").textContent = `Ato ${ACTS[act - 1].n} — ${ACTS[act - 1].title}`;
    $$("button", ticks).forEach((b, i) => b.classList.toggle("on", i === act - 1));
    if (comp.classList.contains("open")) { $("#compCtx").textContent = `Você está em: Ato ${ACTS[act - 1].n} — ${ACTS[act - 1].title}`; if (!compBusy) renderSugs(); }
  }
  document.body.dataset.theme = el.dataset.theme || cfg.theme;
  document.body.classList.toggle("nav-clear", act === 1);   // glass menu only from Act II on
  if (name === "moments") { momentIdx = -1; }
  if (cfg.field) field.preset(cfg.field);
  if (name === "case") { const c = CASES[czIdx]; field.preset({ ...cfg.field, cx: 1 - c.pos[0], cy: c.pos[1] > 1 ? .2 : 1 - c.pos[1] }); }
}
let currentSceneEl = null;
function scrollTick() {
  const vh = innerHeight, mid = vh * .5;
  let active = null;
  for (const el of allScenes) { const r = el.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) { active = el; break; } }
  if (active && active !== currentSceneEl) { currentSceneEl = active; enterScene(active.dataset.scene, active); }
  for (const k in pins) { const [el, fn] = pins[k]; const r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < vh) fn(pinProgress(el)); }
  const max = document.documentElement.scrollHeight - vh;
  $("#progress").style.width = (max > 0 ? scrollY / max * 100 : 0) + "%";
}

/* ---------------- MAIN LOOP ---------------- */
let last = performance.now(), frame = 0;
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; frame++;
  S.mouse.sx = lerp(S.mouse.sx, S.mouse.x, .08); S.mouse.sy = lerp(S.mouse.sy, S.mouse.y, .08);
  scrollTick();
  field.step(dt);
  if (!S.reduced || frame % 4 === 0) field.draw();
  if (!gate.classList.contains("gone")) { seal.step(dt); seal.draw(); }
  if (E.visible) renderEngine(now / 1000, dt);
  for (const m of motifs) if (m.visible && (!S.reduced || frame % 20 === 0)) drawMotif(m, now / 1000 + m.seed);
  if (S.scene === "moments") { $("#roA").textContent = field.P.amp.toFixed(2); $("#roF").textContent = field.P.freq.toFixed(2); }
  requestAnimationFrame(loop);
}
document.addEventListener("visibilitychange", () => { last = performance.now(); });
requestAnimationFrame(loop);
})();
