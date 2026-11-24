const crypto = require("crypto");
const URL_ = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").trim();
const TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "").trim();
const USERS = "rev14:users";

const redis = async (cmd) => {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
};
const sha = (s) => crypto.createHash("sha256").update(s).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(String(a)), sha(String(b)));
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);
const toObj = (a) => { const o = {}; for (let i = 0; i < (a || []).length; i += 2) o[a[i]] = a[i + 1]; return o; };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) || "admin";
// ADMIN_PASSWORD: "pass1,pass2" or named "Ada:pass1,Ben:pass2"
const entries = () => (process.env.ADMIN_PASSWORD || "").split(",").map((s) => s.trim()).filter(Boolean).map((e) => {
  const i = e.indexOf(":");
  return i > 0 && i <= 40 ? { name: e.slice(0, i).trim(), pw: e.slice(i + 1) } : { name: null, pw: e };
});
const secret = () => process.env.SESSION_SECRET || sha("rev14|" + TOKEN).toString("hex");
const hk = (pw) => sha("k|" + pw).toString("hex").slice(0, 12);
const sign = (p) => crypto.createHmac("sha256", secret()).update(p).digest("base64url");
const makeToken = (o) => { const p = Buffer.from(JSON.stringify({ ...o, exp: Date.now() + 30 * 864e5 })).toString("base64url"); return p + "." + sign(p); };
function readToken(h) {
  const m = /^Bearer (.+)$/.exec(h || ""); if (!m) return null;
  const [p, s] = m[1].split("."); if (!p || !s) return null;
  const e = sign(p); if (e.length !== s.length || !crypto.timingSafeEqual(Buffer.from(e), Buffer.from(s))) return null;
  try { const o = JSON.parse(Buffer.from(p, "base64url").toString()); return o.exp > Date.now() ? o : null; } catch (e) { return null; }
}
// Returns { who } for a valid session, { who: null } for anonymous, { bad: true } for an invalid/revoked token.
async function authenticate(req) {
  if (!req.headers.authorization) return { who: null };
  const t = readToken(req.headers.authorization);
  if (!t) return { bad: true };
  if (t.r === "admin") { if (!entries().some((e) => hk(e.pw) === t.k)) return { bad: true }; }
  else if (!(await redis(["HEXISTS", USERS, String(t.u).slice(2)]))) return { bad: true };
  return { who: t };
}
module.exports = { URL_, TOKEN, USERS, redis, same, clean, toObj, slug, entries, hk, makeToken, authenticate };
