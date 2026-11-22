const crypto = require("crypto");
const URL_ = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").trim();
const TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "").trim();
const KEY = "rev14:state", LOG = "rev14:log", ADM = "rev14:admins", CNT = "rev14:counts";
const OK = /^(t\|\d{1,2}-\d{1,2}|s\|\d{1,2}\|[0-7]|sc\|\d{1,2}\|[0-2]|e\|[A-Za-z0-9]{4,24})$/;

const redis = async (cmd) => {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
};
const same = (a, b) => {
  const h = (s) => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(h(a), h(b));
};
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);
const toObj = (a) => { const o = {}; for (let i = 0; i < (a || []).length; i += 2) o[a[i]] = a[i + 1]; return o; };
// ADMIN_PASSWORD: "pass1,pass2" or named "Ada:pass1,Ben:pass2" (named = verified identity)
const entries = () => (process.env.ADMIN_PASSWORD || "").split(",").map((s) => s.trim()).filter(Boolean).map((e) => {
  const i = e.indexOf(":");
  return i > 0 && i <= 40 ? { name: e.slice(0, i).trim(), pw: e.slice(i + 1) } : { name: null, pw: e };
});
async function note(who, text) {
  const at = Date.now();
  await redis(["LPUSH", LOG, JSON.stringify({ who, at, t: clean(text, 140) })]);
  await Promise.all([redis(["LTRIM", LOG, 0, 299]), redis(["HSET", ADM, who, String(at)]), redis(["HINCRBY", CNT, who, 1])]);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const list = entries();
  if (!URL_ || !TOKEN) return res.status(500).json({ error: "Server not configured" });
  const pw = String(req.headers["x-admin-password"] || "");
  const me = pw ? list.find((e) => same(e.pw, pw)) : null;
  if (pw && !me) {
    await new Promise((r) => setTimeout(r, 500));
    return res.status(401).json({ error: "Unauthorized" });
  }
  // No password = public, read-only visitor. Only a valid admin password may write or see activity.
  try {
    if (req.method === "GET") {
      const a = (await redis(["HGETALL", KEY])) || [];
      const state = toObj(a);
      if (!me) for (const k of Object.keys(state)) { // hide admin identities from the public
        try {
          const o = JSON.parse(state[k]);
          if (k === "m|last") state[k] = JSON.stringify({ at: o.at });
          else if (k.startsWith("e|")) { delete o.by; state[k] = JSON.stringify(o); }
        } catch (e) {}
      }
      const out = { state, admin: !!me, me: me ? me.name : null };
      if (me && new URL(req.url || "/", "http://x").searchParams.get("activity")) {
        const [log, adm, cnt] = await Promise.all([redis(["LRANGE", LOG, 0, 99]), redis(["HGETALL", ADM]), redis(["HGETALL", CNT])]);
        out.log = (log || []).map((x) => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
        out.admins = toObj(adm);
        out.counts = toObj(cnt);
        out.roster = list.map((e) => e.name).filter(Boolean);
      }
      return res.json(out);
    }
    if (req.method === "POST") {
      if (!me) return res.status(401).json({ error: "Unauthorized" });
      const { op, f, v, who, lbl } = req.body || {};
      const name = me.name || clean(who, 40) || "Admin";
      if (op === "hello") { await note(name, "Signed in"); return res.json({ ok: true }); }
      if (op === "reset") { await redis(["DEL", KEY]); await note(name, "Reset all shared data"); return res.json({ ok: true }); }
      if (!OK.test(String(f))) return res.status(400).json({ error: "Bad field" });
      if (op === "del") { await redis(["HDEL", KEY, f]); await note(name, lbl || "Deleted an item"); return res.json({ ok: true }); }
      if (op === "set") {
        const val = JSON.stringify(v);
        if (val === undefined || val.length > 2000) return res.status(400).json({ error: "Bad value" });
        await redis(["HSET", KEY, f, val, "m|last", JSON.stringify({ who: name, at: Date.now() })]);
        await note(name, lbl || "Updated " + f);
        return res.json({ ok: true });
      }
    }
    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Storage error: " + e.message });
  }
};
