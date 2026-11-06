const { send, supabase, getSession, clearSessionCookie } = require("../_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  let s;
  try { s = await getSession(req); } catch (e) { console.error(e); return send(res, 502, { error: "Falha ao registrar." }); }
  if (!s) return send(res, 401, { error: "Acesso não encontrado." });
  if (s.expired) { clearSessionCookie(res); return send(res, 410, { error: "expired" }); }
  const r = await supabase("rpc/touch_access", { method: "POST", body: { p_token_hash: s.tokenHash } });
  if (!r.ok) { console.error("supabase rpc", r.status, await r.text()); return send(res, 502, { error: "Falha ao registrar." }); }
  send(res, 200, { ok: true, expires_at: s.expiresAt });
};
