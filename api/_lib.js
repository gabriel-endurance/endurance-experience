// Shared helpers for the serverless functions (files starting with "_" are not routes on Vercel).
const crypto = require("crypto");

const env = (k, d = "") => process.env[k] || d;
const HEARTBEAT_GAP = 75; // seconds; must match supabase/schema.sql
const ACCESS_MS = 4 * 3600 * 1000; // per invite code, counted from its first signature
const SESSION_COOKIE = "endr_s";
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

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}

function setSessionCookie(res, token, maxAgeSec) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`);
}
const clearSessionCookie = res => setSessionCookie(res, "", 0);

async function dbJson(pathAndQuery) {
  const r = await supabase(pathAndQuery);
  if (!r.ok) throw new Error(`supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

// Expiry of an invite code (ms epoch), or null if the code was never used.
async function codeExpiry(code) {
  const [first] = await dbJson(`accesses?select=started_at&code=eq.${encodeURIComponent(code)}&order=started_at.asc&limit=1`);
  return first ? Date.parse(first.started_at) + ACCESS_MS : null;
}

// Session from the HttpOnly cookie: null when absent/unknown, otherwise { id, code, name, tokenHash, expiresAt, expired }.
async function getSession(req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const tokenHash = sha256(token);
  const [a] = await dbJson(`accesses?select=id,code,name&token_hash=eq.${tokenHash}&limit=1`);
  if (!a) return null;
  const expiresAt = await codeExpiry(a.code);
  return { id: a.id, code: a.code, name: a.name || "", tokenHash, expiresAt, expired: Date.now() >= expiresAt };
}

module.exports = { env, HEARTBEAT_GAP, ACCESS_MS, sha256, safeEqual, clientIp, setSessionCookie, clearSessionCookie, codeExpiry, getSession, rateOk, send, readBody, validCredentials, newAccessId, adminOk, askAuth, supabase };
