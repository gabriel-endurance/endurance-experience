const fs = require("fs");
const path = require("path");
const { getSession, clearSessionCookie } = require("./_lib");

// served at / (see vercel.json); the experience HTML lives outside public/ and is only sent to a valid, unexpired session
const pages = {};
const page = name => pages[name] || (pages[name] = fs.readFileSync(path.join(process.cwd(), "site", name), "utf8"));
const inject = (html, boot) => html.replace("<!--BOOT-->", () => `<script>window.ENDR=${JSON.stringify(boot).replace(/</g, "\\u003c")}</script>`);

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  let s = null;
  try { s = await getSession(req); } catch (e) { console.error("session", e); }
  if (s && !s.expired) return res.status(200).send(inject(page("experience.html"), { name: s.name, expires: s.expiresAt }));
  if (s) clearSessionCookie(res);
  res.status(200).send(inject(page("gate.html"), { expired: !!s }));
};
