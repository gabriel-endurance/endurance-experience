const fs = require("fs");
const path = require("path");
const { env, send, readBody, rateOk, clientIp } = require("./_lib");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const SYSTEM_PROMPT = fs.readFileSync(path.join(process.cwd(), "ai", "system_prompt.md"), "utf8");
const MAX_MESSAGES = 12, MAX_CHARS = 16000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function sanitize(messages) {
  if (!Array.isArray(messages)) return [];
  // only user/assistant turns are accepted; the system role is reserved for the server
  const out = messages.slice(-MAX_MESSAGES)
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }));
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  const apiKey = env("GROQ_API_KEY");
  if (!apiKey) return send(res, 503, { error: "GROQ_API_KEY não configurada no servidor." });
  if (!rateOk(clientIp(req))) return send(res, 429, { error: "rate_limited" });
  const body = readBody(req);
  const messages = sanitize(body && body.messages);
  if (!messages.length) return send(res, 400, { error: "Requisição inválida." });

  const payload = JSON.stringify({
    model: env("GROQ_MODEL", "openai/gpt-oss-120b"),
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    stream: true,
    temperature: 0.4,
    max_completion_tokens: body.kind === "explore" ? 1600 : 800,
    reasoning_effort: "low"
  });

  let upstream = null, waited = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    let r;
    try {
      r = await fetch(GROQ_URL, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: payload });
    } catch (e) { console.error("groq unreachable", e); return send(res, 502, { error: "Modelo indisponível no momento." }); }
    if (r.ok) { upstream = r; break; }
    const detail = (await r.text()).slice(0, 400);
    console.error("groq", r.status, detail);
    // free tier has a low tokens-per-minute cap: wait for the window instead of failing
    const m = /try again in ([\d.]+)s/.exec(detail);
    const wait = Number(r.headers.get("retry-after")) || (m ? Number(m[1]) : 0);
    if (r.status === 429 && attempt < 3 && wait > 0 && waited + wait <= 45) { waited += wait + .5; await sleep((wait + .5) * 1000); continue; }
    return send(res, r.status === 429 ? 429 : 502, { error: r.status === 429 ? "rate_limited" : "Falha ao consultar o modelo." });
  }
  if (!upstream) return send(res, 429, { error: "rate_limited" });

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
  const reader = upstream.body.getReader(), dec = new TextDecoder();
  let buf = "";
  outer: for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") break outer;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta?.content;
        if (delta) res.write(delta);
      } catch (e) { /* ignore keep-alive / partial lines */ }
    }
  }
  res.end();
};
