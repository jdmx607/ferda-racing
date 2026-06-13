export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");

  try {
    const response = await fetch(
      "https://www.reddit.com/r/nascar/hot.json?limit=25&raw_json=1",
      {
        headers: {
          "User-Agent": "ferda-racing-fantasy/1.0",
          "Accept":     "application/json",
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `Reddit returned ${response.status}` });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
