async function redis(commands) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const r = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return await r.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { sessionId } = req.body;
  if (!sessionId || !['s1', 's2', 's3'].includes(sessionId)) {
    res.status(400).json({ error: 'Invalid sessionId' }); return;
  }

  const key = `spots:${sessionId}`;
  const results = await redis([['DECR', key]]);
  let newVal = Math.max(0, parseInt(results[0]?.result ?? 0));
  if (newVal < 0) {
    await redis([['SET', key, '0']]);
    newVal = 0;
  }

  res.status(200).json({ ok: true, spots: newVal });
};
