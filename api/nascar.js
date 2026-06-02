// Vercel serverless proxy — ESM format (package.json has "type":"module")
// Routes NASCAR cacher (CORS bypass) and SportsDataIO (server-side key) calls

const SPORTSDATA_KEY = "bc0810a6cc664a83aa343c7ec4002b7e";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { path, source, test } = req.query;

  // Quick connectivity test — hit /api/nascar?test=1
  if (test) {
    return res.status(200).json({
      ok: true,
      message: "Vercel proxy is reachable",
      timestamp: new Date().toISOString(),
    });
  }

  if (!path) return res.status(400).json({ error: "Missing ?path= parameter" });

  let url;
  let headers = { Accept: "application/json" };

  if (source === "sportsdata") {
    const decodedPath = decodeURIComponent(path);
    url = `https://api.sportsdata.io/v2/nascar/scores/json${decodedPath}?key=${SPORTSDATA_KEY}`;
    headers["Ocp-Apim-Subscription-Key"] = SPORTSDATA_KEY;
  } else {
    const decodedPath = decodeURIComponent(path);
    url = `https://cf.nascar.com/cacher${decodedPath}`;
    headers["User-Agent"] = "FERDA-Racing/1.0";
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return res.status(response.status).json({
        error: `Upstream returned ${response.status}`,
        upstream: url.replace(SPORTSDATA_KEY, "***"),
        body: body.slice(0, 200),
      });
    }

    const data = await response.json();
    const cacheAge = source === "sportsdata" ? 30 : 60;
    res.setHeader("Cache-Control", `public, max-age=${cacheAge}, s-maxage=${cacheAge}`);
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({
      error: err.message,
      upstream: url ? url.replace(SPORTSDATA_KEY, "***") : "unknown",
    });
  }
}
