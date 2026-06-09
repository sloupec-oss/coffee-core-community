const MAX_SPOTS = 12;

async function redis(commands) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const r = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  const data = await r.json();
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Initialize keys if they don't exist yet (first ever request)
  await redis([
    ['SET', 'spots:s1', String(MAX_SPOTS), 'NX'],
    ['SET', 'spots:s2', String(MAX_SPOTS), 'NX'],
  ]);

  const results = await redis([
    ['GET', 'spots:s1'],
    ['GET', 'spots:s2'],
  ]);

  res.status(200).json({
    s1: Math.max(0, parseInt(results[0].result ?? MAX_SPOTS)),
    s2: Math.max(0, parseInt(results[1].result ?? MAX_SPOTS)),
  });
};
