const A = require("../lib/auth.js");
const LIST = "rev14:quizzes";
const COURSES = ["Mixed", "Chem Path", "Histopath", "MMP", "Pharmacology", "Haematology"];
const str = (s, n) => (typeof s === "string" ? s.trim().slice(0, n) : "");
const num = (x) => (Number.isFinite(+x) ? Math.max(0, Math.round(+x)) : 0);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!A.URL_ || !A.TOKEN) return res.status(500).json({ error: "Server not configured" });
  try {
    const au = await A.authenticate(req);
    if (au.bad || !au.who) return res.status(401).json({ error: "Sign in to use quizzes" });
    const who = au.who, admin = who.r === "admin", pkey = "rev14:pq:" + who.u;

    if (req.method === "GET") {
      const id = new URL(req.url || "/", "http://x").searchParams.get("id");
      if (id) {
        if (!/^[a-z0-9]{4,16}$/.test(id)) return res.status(400).json({ error: "Bad id" });
        const raw = await A.redis(["GET", "rev14:qz:" + id]);
        if (!raw) return res.status(404).json({ error: "Quiz not found" });
        return res.json({ id, questions: JSON.parse(raw) });
      }
      const [l, p] = await Promise.all([A.redis(["HGETALL", LIST]), A.redis(["HGETALL", pkey])]);
      const quizzes = Object.values(A.toObj(l)).map((v) => { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean).sort((a, b) => a.at - b.at);
      const progress = {};
      for (const [k, v] of Object.entries(A.toObj(p))) { try { progress[k] = JSON.parse(v); } catch (e) {} }
      return res.json({ quizzes, progress });
    }

    if (req.method === "POST") {
      const b = req.body || {};
      if (b.action === "answer") {
        if (!/^[a-z0-9]{4,16}\|\d{1,4}$/.test(String(b.f))) return res.status(400).json({ error: "Bad field" });
        const v = b.v || {};
        const rec = { b: Math.min(num(v.b), 5), d: num(v.d), n: num(v.n), c: num(v.c), l: v.l ? 1 : 0, t: num(v.t) };
        await A.redis(["HSET", pkey, b.f, JSON.stringify(rec)]);
        return res.json({ ok: true });
      }
      if (b.action === "resetq") {
        if (!/^[a-z0-9]{4,16}$/.test(String(b.id))) return res.status(400).json({ error: "Bad id" });
        const fields = Object.keys(A.toObj((await A.redis(["HGETALL", pkey])) || [])).filter((k) => k.startsWith(b.id + "|"));
        if (fields.length) await A.redis(["HDEL", pkey, ...fields]);
        return res.json({ ok: true });
      }
      if (!admin) return res.status(403).json({ error: "Admins only" });
      if (b.action === "delete") {
        if (!/^[a-z0-9]{4,16}$/.test(String(b.id))) return res.status(400).json({ error: "Bad id" });
        await A.redis(["DEL", "rev14:qz:" + b.id]);
        await A.redis(["HDEL", LIST, b.id]);
        return res.json({ ok: true });
      }
      if (b.action === "update") {
        if (!/^[a-z0-9]{4,16}$/.test(String(b.id))) return res.status(400).json({ error: "Bad id" });
        const raw = await A.redis(["HGET", LIST, b.id]);
        if (!raw) return res.status(404).json({ error: "Quiz not found" });
        const meta = JSON.parse(raw);
        if (b.day !== undefined) meta.day = Number.isInteger(b.day) && b.day >= 0 && b.day <= 14 ? b.day : 0;
        if (b.course !== undefined) { if (!COURSES.includes(b.course)) return res.status(400).json({ error: "Unknown course" }); meta.course = b.course; }
        await A.redis(["HSET", LIST, b.id, JSON.stringify(meta)]);
        return res.json({ ok: true });
      }
      if (b.action === "save") {
        const day = Number.isInteger(b.day) && b.day >= 0 && b.day <= 14 ? b.day : 0;
        const title = str(b.title, 100);
        const course = COURSES.includes(b.course) ? b.course : "Mixed";
        if (!title) return res.status(400).json({ error: "Give the quiz a title" });
        if (!Array.isArray(b.questions) || !b.questions.length || b.questions.length > 500) return res.status(400).json({ error: "A quiz needs 1 to 500 questions" });
        const qs = [];
        for (const q of b.questions) {
          const o = Array.isArray(q.o) ? q.o.map((x) => str(x, 400)).filter(Boolean).slice(0, 6) : [];
          const a = Number.isInteger(q.a) ? q.a : -1;
          const text = str(q.q, 1000);
          if (text.length < 3 || o.length < 2 || a < 0 || a >= o.length) return res.status(400).json({ error: "A question is incomplete" });
          qs.push({ q: text, o, a, x: str(q.x, 1500) });
        }
        const json = JSON.stringify(qs);
        if (json.length > 700000) return res.status(413).json({ error: "Quiz is too large" });
        const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).slice(-9);
        await A.redis(["SET", "rev14:qz:" + id, json]);
        await A.redis(["HSET", LIST, id, JSON.stringify({ id, title, course, day, n: qs.length, at: Date.now(), by: who.n })]);
        return res.json({ ok: true, id });
      }
    }
    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error: " + e.message });
  }
};
