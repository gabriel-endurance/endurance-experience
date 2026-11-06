/* Gate page (Act 00): credentials → confidentiality term → intro video → reload into the experience.
   Concatenated after the core of app.js (helpers, store, S, Field) by build.sh. */

const BOOT = window.ENDR || {};
const gate = $("#gate");
const fmtDate = d => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
const postJSON = (path, body) => fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const EXPIRED_MSG = "O prazo de 04 horas deste convite terminou. Para continuar, solicite um novo convite ao time da Endurance.";
const seal = new Field($("#sealCanvas"), { N: 24, M: 120, color: RUST, mouse: false, init: { scale: 1.05, amp: .5, alpha: .85, stretch: 1.25, speed: .16 } });

$("#inviteNo").textContent = String(Math.floor(1000 + Math.random() * 8999));
if (BOOT.expired) $("#gateErr").textContent = EXPIRED_MSG;
document.body.classList.add("locked");
setTimeout(() => $("#gName").focus({ preventScroll: true }), 400);
let pendingCred = null, startReq = null;

$("#gateForm").addEventListener("submit", async e => {
  e.preventDefault();
  const code = $("#gCode").value.trim().toUpperCase(), key = $("#gKey").value.trim();
  const err = $("#gateErr"), btn = $("#gateForm button[type=submit]");
  if (!code || !key) { err.textContent = "Informe o código do convite e a chave de acesso."; return; }
  btn.disabled = true; err.textContent = "";
  try {
    const res = await postJSON("api/access/check", { code, key });
    if (!res.ok) {
      err.textContent = res.status === 403 ? EXPIRED_MSG : res.status === 429 ? "Muitas tentativas. Aguarde um minuto e tente novamente." : res.status === 401 ? "Credenciais não reconhecidas. Confira o código do convite e a chave de acesso." : "Não foi possível validar o acesso agora. Tente novamente.";
      return;
    }
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
  if (cSign.disabled || !pendingCred) return;
  // not awaited: the intro must start inside this click (fullscreen + sound need the user gesture); the session cookie arrives meanwhile
  startReq = postJSON("api/access/start", { ...pendingCred, name }).then(r => {
    if (r.ok) return true;
    throw new Error(r.status === 403 ? EXPIRED_MSG : "Não foi possível registrar o acesso. Tente novamente.");
  }, () => { throw new Error("Não foi possível registrar o acesso. Verifique sua conexão."); });
  startReq.catch(() => {});
  pendingCred = null;
  consent.classList.remove("open"); consent.setAttribute("aria-hidden", "true");
  openIntro();
});

/* ---------------- INTRO VIDEO (fullscreen, minimal controls) ---------------- */
const intro = $("#intro"), vid = $("#introVideo"), vPlay = $("#vPlay"), vMute = $("#vMute"), vBar = $("#vBar"), vFill = $("#vFill"), vTime = $("#vTime");
let hideT = null;
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
function openIntro() {
  intro.classList.add("open"); intro.setAttribute("aria-hidden", "false");
  try { const r = intro.requestFullscreen ? intro.requestFullscreen() : (intro.webkitRequestFullscreen && intro.webkitRequestFullscreen()); r && r.catch && r.catch(() => {}); } catch (e) {}
  vid.currentTime = 0; vid.muted = false;
  const p = vid.play(); if (p && p.catch) p.catch(() => { intro.classList.add("paused"); });
  wake();
}
function closeIntro() {
  if (!intro.classList.contains("open") || intro.classList.contains("leaving")) return;
  vid.pause();
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (document.webkitFullscreenElement) document.webkitExitFullscreen(); } catch (e) {}
  intro.classList.add("leaving");
  startReq.then(() => location.replace("/"), err => {
    setTimeout(() => { intro.classList.remove("open", "leaving", "paused"); intro.setAttribute("aria-hidden", "true"); }, 900);
    $("#gKey").value = ""; $("#gateErr").textContent = err.message;
  });
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

/* ---------------- seal animation ---------------- */
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  seal.step(dt); seal.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
