const { env, send } = require("./_lib");

module.exports = (req, res) => send(res, env("GROQ_API_KEY") ? 200 : 503, { ok: !!env("GROQ_API_KEY") });
