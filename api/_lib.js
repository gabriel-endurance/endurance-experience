// Shared helpers for the serverless functions (files starting with "_" are not routes on Vercel).
const crypto = require("crypto");

const env = (k, d = "") => process.env[k] || d;
const HEARTBEAT_GAP = 75; // seconds; must match supabase/schema.sql
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid misreading

const sha256 = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const safeEqual = (a, b) => crypto.timingSafeEqual(Buffer.from(sha256(a), "hex"), Buffer.from(sha256(b), "hex"));

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || (req.socket && req.socket.remoteAddress) || "";
}

// best effort: per serverless instance
const hits = new Map();
function rateOk(ip, limit = 20) {
  const now = Date.now(), recent = (hits.get(ip) || []).filter(t => now - t < 60000);
  const ok = recent.length < limit;
  if (ok) recent.push(now);
  hits.set(ip, recent);
  return ok;
}

function send(res, status, obj) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(obj);
}

function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { return null; } }
  if (Buffer.isBuffer(b)) { try { b = JSON.parse(b.toString("utf8")); } catch (e) { return null; } }
  return b && typeof b === "object" && !Array.isArray(b) ? b : null;
}

function validCredentials(code, key) {
  const m = /^ENDR-(\d{4})$/.exec(String(code || "").trim().toUpperCase());
  return !!m && +m[1] >= 1 && +m[1] <= 1000 && safeEqual(String(key || "").trim(), env("ACCESS_KEY", "37"));
}

function newAccessId() {
  const part = () => Array.from(crypto.randomBytes(4), b => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
  return `${part()}-${part()}`;
}

function adminOk(req) {
  const pwd = env("ADMIN_PASSWORD");
  const auth = String(req.headers.authorization || "");
  if (!pwd || !auth.startsWith("Basic ")) return false;
  const [user, ...rest] = Buffer.from(auth.slice(6), "base64").toString("utf8").split(":");
  return safeEqual(user, env("ADMIN_USER", "admin")) & safeEqual(rest.join(":"), pwd) ? true : false;
}

function askAuth(res) {
  res.setHeader("WWW-Authenticate", 'Basic realm="Endurance admin", charset="UTF-8"');
  res.setHeader("Cache-Control", "no-store");
  res.status(401).end();
}

// Supabase REST with the server-side key (legacy service_role JWT or new sb_secret_ key)
function supabase(pathAndQuery, { method = "GET", body, prefer } = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY");
  const headers = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  if (prefer) headers.Prefer = prefer;
  return fetch(`${env("SUPABASE_URL").replace(/\/$/, "")}/rest/v1/${pathAndQuery}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

module.exports = { env, HEARTBEAT_GAP, sha256, clientIp, rateOk, send, readBody, validCredentials, newAccessId, adminOk, askAuth, supabase };
