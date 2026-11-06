const { send, readBody, rateOk, clientIp, validCredentials, codeExpiry } = require("../_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  if (!rateOk(clientIp(req))) return send(res, 429, { error: "Muitas tentativas. Aguarde um minuto." });
  const data = readBody(req);
  if (!data || !validCredentials(data.code, data.key)) return send(res, 401, { error: "Credenciais não reconhecidas." });
  let exp;
  try { exp = await codeExpiry(String(data.code).trim().toUpperCase()); }
  catch (e) { console.error(e); return send(res, 502, { error: "Não foi possível validar o acesso." }); }
  if (exp && Date.now() >= exp) return send(res, 403, { error: "expired" });
  send(res, 200, { ok: true });
};
