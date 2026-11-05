const fs = require("fs");
const path = require("path");
const { adminOk, askAuth } = require("./_lib");

// served at /admin (see vercel.json); the HTML lives outside public/ so it is never served without auth
module.exports = (req, res) => {
  if (!adminOk(req)) return askAuth(res);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.status(200).send(fs.readFileSync(path.join(process.cwd(), "admin", "index.html"), "utf8"));
};
