// Vercel serverless proxy
// Handles: NASCAR cacher (free, no key), SportsDataIO (paid), Discovery Lab (paid hobbyist)

const SPORTSDATA_KEY = "bc0810a6cc664a83aa343c7ec4002b7e";

// All possible SportsDataIO base URLs to try — covers main API and Discovery Lab
const SD_BASES = [
  "https://api.discoverylab.sportsdata.io/v2/nascar/scores/json",
  "https://api.discoverylab.sportsdata.io/nascar/v2/json",
  "https://api.sportsdata.io/v2/nascar/scores/json",
  "https://api.sportsdata.io/nascar/v2/json",
];

async function trySportsData(path) {
  for (const base of SD_BASES) {
    const url = `${base}${path}?key=${SPORTSDATA_KEY}`;
    try {
      const res = await fetch(url, {
        headers: { Accept:"application/json", "Ocp-Apim-Subscription-Key": SPORTSDATA_KEY },
      });
      if (res.status === 200) {
        const data = await res.json();
        return { ok:true, data, usedBase:base };
      }
      if (res.status !== 404) {
        const body = await res.text().catch(()=>"");
        return { ok:false, status:res.status, body:body.slice(0,400), usedBase:base };
      }
    } catch(err) {
      return { ok:false, status:0, body:err.message };
    }
  }
  return {
    ok:false, status:404,
    body:"All SportsDataIO URL formats returned 404. Your key likely needs a Discovery Lab subscription at discoverylab.sportsdata.io/personal-use-apis/nascar — the standard free trial does not include NASCAR.",
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");
  if(req.method==="OPTIONS") return res.status(200).end();

  const { path, source, test } = req.query;

  if(test) return res.status(200).json({ ok:true, message:"Vercel proxy is reachable", timestamp:new Date().toISOString() });
  if(!path) return res.status(400).json({ error:"Missing ?path=" });

  const p = decodeURIComponent(path);

  if(source==="sportsdata") {
    const result = await trySportsData(p);
    if(result.ok) {
      res.setHeader("Cache-Control","public, max-age=30, s-maxage=30");
      return res.status(200).json(result.data);
    }
    return res.status(result.status||500).json({
      error:`SportsDataIO unavailable (HTTP ${result.status})`,
      detail: result.body,
      triedBases: SD_BASES,
    });
  }

  // NASCAR cacher (free, no key needed)
  const url = `https://cf.nascar.com/cacher${p}`;
  try {
    const response = await fetch(url, { headers:{ "User-Agent":"FERDA-Racing/1.0", Accept:"application/json" } });
    if(!response.ok) return res.status(response.status).json({ error:`Cacher returned ${response.status}` });
    const data = await response.json();
    res.setHeader("Cache-Control","public, max-age=60, s-maxage=60");
    return res.status(200).json(data);
  } catch(err) {
    return res.status(500).json({ error:err.message });
  }
}
