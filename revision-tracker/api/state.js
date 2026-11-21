const crypto = require("crypto");
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const KEY = "rev14:state";
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

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const pws = (process.env.ADMIN_PASSWORD || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!pws.length || !URL_ || !TOKEN) return res.status(500).json({ error: "Server not configured" });
  const pw = String(req.headers["x-admin-password"] || "");
  if (!pws.some((p) => same(p, pw))) {
    await new Promise((r) => setTimeout(r, 500));
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    if (req.method === "GET") {
      const a = (await redis(["HGETALL", KEY])) || [];
      const state = {};
      for (let i = 0; i < a.length; i += 2) state[a[i]] = a[i + 1];
      return res.json({ state });
    }
    if (req.method === "POST") {
      const { op, f, v, who } = req.body || {};
      if (op === "reset") { await redis(["DEL", KEY]); return res.json({ ok: true }); }
      if (!OK.test(String(f))) return res.status(400).json({ error: "Bad field" });
      if (op === "del") { await redis(["HDEL", KEY, f]); return res.json({ ok: true }); }
      if (op === "set") {
        const val = JSON.stringify(v);
        if (val === undefined || val.length > 2000) return res.status(400).json({ error: "Bad value" });
        const meta = JSON.stringify({ who: String(who || "Admin").slice(0, 40), at: Date.now() });
        await redis(["HSET", KEY, f, val, "m|last", meta]);
        return res.json({ ok: true });
      }
    }
    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Storage error: " + e.message });
  }
};
