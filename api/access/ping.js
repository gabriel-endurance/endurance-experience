const { send, readBody, sha256, supabase } = require("../_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  const data = readBody(req);
  if (!data || typeof data.token !== "string" || data.token.length > 100) return send(res, 400, { error: "Requisição inválida." });
  const r = await supabase("rpc/touch_access", { method: "POST", body: { p_token_hash: sha256(data.token) } });
  if (!r.ok) { console.error("supabase rpc", r.status, await r.text()); return send(res, 502, { error: "Falha ao registrar." }); }
  const found = await r.json();
  send(res, found ? 200 : 404, found ? { ok: true } : { error: "Acesso não encontrado." });
};
