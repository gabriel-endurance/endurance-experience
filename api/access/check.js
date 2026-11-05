const { send, readBody, rateOk, clientIp, validCredentials } = require("../_lib");

module.exports = (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  if (!rateOk(clientIp(req))) return send(res, 429, { error: "Muitas tentativas. Aguarde um minuto." });
  const data = readBody(req);
  if (!data || !validCredentials(data.code, data.key)) return send(res, 401, { error: "Credenciais não reconhecidas." });
  send(res, 200, { ok: true });
};
