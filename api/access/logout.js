const { send, clearSessionCookie } = require("../_lib");

module.exports = (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  clearSessionCookie(res);
  send(res, 200, { ok: true });
};
