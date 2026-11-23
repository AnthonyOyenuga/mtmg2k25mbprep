const A = require("../lib/auth.js");
const KEY = "rev14:state", LOG = "rev14:log", ADM = "rev14:admins", CNT = "rev14:counts";
const OK = /^(t\|\d{1,2}-\d{1,2}|s\|\d{1,2}\|[0-7]|sc\|\d{1,2}\|[0-2]|e\|[A-Za-z0-9]{4,24})$/;

async function note(who, text) {
  const at = Date.now();
  await A.redis(["LPUSH", LOG, JSON.stringify({ who, at, t: A.clean(text, 140) })]);
  await Promise.all([A.redis(["LTRIM", LOG, 0, 299]), A.redis(["HSET", ADM, who, String(at)]), A.redis(["HINCRBY", CNT, who, 1])]);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!A.URL_ || !A.TOKEN) return res.status(500).json({ error: "Server not configured" });
  try {
    const au = await A.authenticate(req);
    if (au.bad) return res.status(401).json({ error: "Unauthorized" });
    const who = au.who, admin = !!who && who.r === "admin";
    const mineKey = who ? "rev14:p:" + who.u : null;

    if (req.method === "GET") {
      const state = A.toObj((await A.redis(["HGETALL", KEY])) || []);
      if (!admin) for (const k of Object.keys(state)) { // hide admin identities from non-admins
        try {
          const o = JSON.parse(state[k]);
          if (k === "m|last") state[k] = JSON.stringify({ at: o.at });
          else if (k.startsWith("e|")) { delete o.by; state[k] = JSON.stringify(o); }
        } catch (e) {}
      }
      const out = { state, role: who ? who.r : "", admin, me: who ? who.n : null };
      if (who) out.mine = A.toObj((await A.redis(["HGETALL", mineKey])) || []);
      if (admin && new URL(req.url || "/", "http://x").searchParams.get("activity")) {
        const [log, adm, cnt, users] = await Promise.all([A.redis(["LRANGE", LOG, 0, 99]), A.redis(["HGETALL", ADM]), A.redis(["HGETALL", CNT]), A.redis(["HGETALL", A.USERS])]);
        out.log = (log || []).map((x) => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
        out.admins = A.toObj(adm); out.counts = A.toObj(cnt);
        out.roster = A.entries().map((e) => e.name).filter(Boolean);
        out.users = Object.values(A.toObj(users)).map((v) => { try { return JSON.parse(v).name; } catch (e) { return null; } }).filter(Boolean).sort();
      }
      return res.json(out);
    }

    if (req.method === "POST") {
      if (!who) return res.status(401).json({ error: "Unauthorized" });
      const { scope, op, f, v, lbl } = req.body || {};
      const key = scope === "mine" ? mineKey : KEY;
      if (scope !== "mine" && !admin) return res.status(403).json({ error: "Admins only" });
      const log = scope !== "mine";
      if (op === "hello") { if (log) await note(who.n, "Signed in"); return res.json({ ok: true }); }
      if (op === "reset") { await A.redis(["DEL", key]); if (log) await note(who.n, "Reset all shared data"); return res.json({ ok: true }); }
      if (!OK.test(String(f))) return res.status(400).json({ error: "Bad field" });
      if (op === "del") { await A.redis(["HDEL", key, f]); if (log) await note(who.n, lbl || "Deleted an item"); return res.json({ ok: true }); }
      if (op === "set") {
        const val = JSON.stringify(v);
        if (val === undefined || val.length > 2000) return res.status(400).json({ error: "Bad value" });
        if (log) await A.redis(["HSET", key, f, val, "m|last", JSON.stringify({ who: who.n, at: Date.now() })]);
        else await A.redis(["HSET", key, f, val]);
        if (log) await note(who.n, lbl || "Updated " + f);
        return res.json({ ok: true });
      }
    }
    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Storage error: " + e.message });
  }
};
