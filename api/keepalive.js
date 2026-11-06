const { env, send, safeEqual, supabase } = require("./_lib");

// Daily Vercel cron: a real query keeps the free-tier Supabase project from pausing after 7 idle days.
module.exports = async (req, res) => {
  const secret = env("CRON_SECRET");
  if (!secret || !safeEqual(String(req.headers.authorization || ""), `Bearer ${secret}`)) return send(res, 401, { ok: false });
  const r = await supabase("accesses?select=id&limit=1");
  if (!r.ok) { console.error("keepalive", r.status, await r.text()); return send(res, 502, { ok: false }); }
  send(res, 200, { ok: true });
};
