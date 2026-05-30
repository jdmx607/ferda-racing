// api/nascar.js — Vercel serverless function
// Proxies requests to cf.nascar.com/cacher to avoid CORS issues in the browser.
// Deployed automatically by Vercel from the /api directory.

export default async function handler(req, res) {
  const path = req.query.path;
  if (!path) {
    return res.status(400).json({ error: "Missing ?path= parameter" });
  }

  // Only allow NASCAR cacher domain for security
  const url = `https://cf.nascar.com/cacher${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FERDA-Racing/1.0)",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `NASCAR feed returned ${response.status}`,
        url,
      });
    }

    const data = await response.json();

    // Cache for 60 seconds to reduce hammering the feed during races
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, url });
  }
}
