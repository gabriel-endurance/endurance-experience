const { adminOk, askAuth, send, supabase, HEARTBEAT_GAP } = require("../_lib");

module.exports = async (req, res) => {
  if (!adminOk(req)) return askAuth(res);
  const r = await supabase("accesses?select=id,code,name,started_at,last_seen,active_seconds&order=started_at.desc&limit=2000");
  if (!r.ok) { console.error("supabase select", r.status, await r.text()); return send(res, 502, { error: "Falha ao consultar o banco." }); }
  const now = Date.now();
  const accesses = (await r.json()).map(a => ({
    id: a.id, code: a.code, name: a.name, started_at: a.started_at, last_seen: a.last_seen,
    seconds: Math.round(a.active_seconds), online: now - Date.parse(a.last_seen) <= HEARTBEAT_GAP * 1000
  }));
  send(res, 200, { accesses });
};
