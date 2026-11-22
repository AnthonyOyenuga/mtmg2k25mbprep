// Open /api/ping in a browser to check the deployment. Shows no secrets.
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    passwordSet: !!process.env.ADMIN_PASSWORD,
    redisSet: !!((process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) && (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)),
  });
};
