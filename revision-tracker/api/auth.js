const crypto = require("crypto");
const A = require("../lib/auth.js");
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString("hex");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!A.URL_ || !A.TOKEN) return res.status(500).json({ error: "Server not configured" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { action, name, password } = req.body || {};
  const pw = String(password || "");
  try {
    if (action === "admin") {
      const me = A.entries().find((e) => A.same(e.pw, pw));
      if (!me) { await wait(500); return res.status(401).json({ error: "Wrong admin password." }); }
      const n = me.name || A.clean(name, 40) || "Admin";
      return res.json({ role: "admin", name: n, token: A.makeToken({ r: "admin", n, u: "a:" + A.slug(n), k: A.hk(me.pw) }) });
    }
    const uname = String(name || "").trim();
    if (!/^[A-Za-z0-9_.]{3,24}$/.test(uname)) return res.status(400).json({ error: "Username: 3 to 24 letters, numbers, _ or ." });
    const key = uname.toLowerCase();
    if (action === "signup") {
      if (pw.length < 6 || pw.length > 100) return res.status(400).json({ error: "Password must be at least 6 characters." });
      if (await A.redis(["HEXISTS", A.USERS, key])) return res.status(409).json({ error: "That username is taken." });
      if (Number(await A.redis(["HLEN", A.USERS])) >= 300) return res.status(403).json({ error: "Sign-ups are closed." });
      const salt = crypto.randomBytes(16).toString("hex");
      await A.redis(["HSET", A.USERS, key, JSON.stringify({ name: uname, salt, h: hash(pw, salt), at: Date.now() })]);
      return res.json({ role: "user", name: uname, token: A.makeToken({ r: "user", n: uname, u: "u:" + key }) });
    }
    if (action === "login") {
      const raw = await A.redis(["HGET", A.USERS, key]);
      let u = null; try { u = raw && JSON.parse(raw); } catch (e) {}
      const good = u && A.same(hash(pw, u.salt), u.h);
      if (!good) { await wait(400); return res.status(401).json({ error: "Wrong username or password." }); }
      return res.json({ role: "user", name: u.name, token: A.makeToken({ r: "user", n: u.name, u: "u:" + key }) });
    }
    res.status(400).json({ error: "Bad request" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error: " + e.message });
  }
};
