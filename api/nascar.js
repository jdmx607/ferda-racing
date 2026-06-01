// Vercel serverless proxy — forwards to NASCAR cacher (CORS bypass)
// SportsDataIO is called directly from frontend (they support CORS)
export default async function handler(req, res) {
  const path = req.query.path;
  if (!path) return res.status(400).json({ error:"Missing ?path=" });
  const url = `https://cf.nascar.com/cacher${path}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent":"FERDA-Racing/1.0", "Accept":"application/json" },
    });
    if (!response.ok) return res.status(response.status).json({ error:`Cacher returned ${response.status}`, url });
    const data = await response.json();
    res.setHeader("Cache-Control","public, max-age=60, s-maxage=60");
    res.setHeader("Access-Control-Allow-Origin","*");
    res.status(200).json(data);
  } catch(err) { res.status(500).json({ error:err.message, url }); }
}
