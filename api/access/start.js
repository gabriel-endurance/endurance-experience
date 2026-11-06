const crypto = require("crypto");
const { send, readBody, rateOk, clientIp, validCredentials, newAccessId, sha256, supabase, codeExpiry, setSessionCookie, ACCESS_MS } = require("../_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  const ip = clientIp(req);
  if (!rateOk(ip)) return send(res, 429, { error: "Muitas tentativas. Aguarde um minuto." });
  const data = readBody(req);
  if (!data || !validCredentials(data.code, data.key)) return send(res, 401, { error: "Credenciais não reconhecidas." });

  const code = String(data.code).trim().toUpperCase();
  let exp;
  try { exp = await codeExpiry(code); }
  catch (e) { console.error(e); return send(res, 502, { error: "Não foi possível registrar o acesso." }); }
  if (exp && Date.now() >= exp) return send(res, 403, { error: "expired" });

  const token = crypto.randomBytes(32).toString("base64url");
  const row = { token_hash: sha256(token), code, name: String(data.name || "").trim().slice(0, 80), ip };
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newAccessId();
    const r = await supabase("accesses?select=started_at", { method: "POST", body: { id, ...row }, prefer: "return=representation" });
    if (r.ok) {
      const expiresAt = exp || Date.parse((await r.json())[0].started_at) + ACCESS_MS;
      setSessionCookie(res, token, (expiresAt - Date.now()) / 1000);
      return send(res, 200, { id, expires_at: expiresAt });
    }
    if (r.status !== 409) { console.error("supabase insert", r.status, await r.text()); return send(res, 502, { error: "Não foi possível registrar o acesso." }); }
  }
  send(res, 502, { error: "Não foi possível registrar o acesso." });
};
