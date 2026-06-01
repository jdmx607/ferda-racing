// Vercel serverless proxy
// Routes both NASCAR cacher (CORS bypass) and SportsDataIO (server-side key protection) calls

const SPORTSDATA_KEY = "bc0810a6cc664a83aa343c7ec4002b7e";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { path, source } = req.query;

  if (!path) return res.status(400).json({ error: "Missing ?path= parameter" });

  let url;
  let headers = { "Accept": "application/json" };

  if (source === "sportsdata") {
    // SportsDataIO — key added server-side (never exposed in frontend)
    url = `https://api.sportsdata.io/v2/nascar/scores/json${path}?key=${SPORTSDATA_KEY}`;
    headers["Ocp-Apim-Subscription-Key"] = SPORTSDATA_KEY;
  } else {
    // NASCAR cacher CDN
    url = `https://cf.nascar.com/cacher${path}`;
    headers["User-Agent"] = "FERDA-Racing/1.0";
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Remote server returned ${response.status}`,
        url: url.replace(SPORTSDATA_KEY, "***"),
      });
    }
    const data = await response.json();
    // Short cache for live data, longer for static
    const cacheAge = source === "sportsdata" ? 30 : 60;
    res.setHeader("Cache-Control", `public, max-age=${cacheAge}, s-maxage=${cacheAge}`);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
