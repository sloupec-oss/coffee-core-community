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
    ['SET', 'spots:s3', String(MAX_SPOTS), 'NX'],
    ['SET', 'spots:s2', String(MAX_SPOTS), 'NX'],
    ['SET', 'spots:s4', String(MAX_SPOTS), 'NX'],
  ]);

  const results = await redis([
    ['GET', 'spots:s1'],
    ['GET', 'spots:s3'],
    ['GET', 'spots:s2'],
    ['GET', 'spots:s4'],
  ]);

  const parse = (val) => parseInt(val ?? MAX_SPOTS);
  const s1 = parse(results[0].result);
  const s3 = parse(results[1].result);
  const s2 = parse(results[2].result);
  const s4 = parse(results[3].result);

  // Fix corrupted keys (DECR on non-existent key produces negative values)
  const resets = [];
  if (s1 < 0) resets.push(['SET', 'spots:s1', String(MAX_SPOTS)]);
  if (s3 < 0) resets.push(['SET', 'spots:s3', String(MAX_SPOTS)]);
  if (s2 < 0) resets.push(['SET', 'spots:s2', String(MAX_SPOTS)]);
  if (s4 < 0) resets.push(['SET', 'spots:s4', String(MAX_SPOTS)]);
  if (resets.length) await redis(resets);

  res.status(200).json({
    s1: s1 < 0 ? MAX_SPOTS : Math.max(0, s1),
    s3: s3 < 0 ? MAX_SPOTS : Math.max(0, s3),
    s2: s2 < 0 ? MAX_SPOTS : Math.max(0, s2),
    s4: s4 < 0 ? MAX_SPOTS : Math.max(0, s4),
  });
};
