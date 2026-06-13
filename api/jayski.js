const FEEDS = [
  { name: "Jayski",         url: "https://www.jayski.com/json/articles/?format=rss" },
  { name: "Daily Downforce",url: "https://dailydownforce.com/feed" },
  { name: "Motorsport.com", url: "https://www.motorsport.com/rss/nascar-cup/news/" },
  { name: "On3 NASCAR",     url: "https://www.on3.com/pro/category/nascar/news/feed/" },
];

const REQ_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/rss+xml, application/xml, text/xml, */*",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=120");

  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const r = await fetch(feed.url, {
        headers: REQ_HEADERS,
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      const items = parseRSS(text, feed.name);
      if (!items.length) throw new Error("empty feed");
      return { name: feed.name, items };
    })
  );

  const sources = [];
  const allItems = [];

  for (const r of results) {
    if (r.status === "fulfilled") {
      sources.push(r.value.name);
      allItems.push(...r.value.items);
    }
  }

  if (!allItems.length) {
    return res.status(502).json({ error: "All news sources are unreachable right now." });
  }

  // de-dupe by URL, sort newest first
  const seen = new Set();
  const items = allItems
    .filter(item => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 30);

  return res.status(200).json({ sources, items });
}

// ── RSS parser ────────────────────────────────────────────────────────────────

function parseRSS(xml, sourceName) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];

  for (const block of blocks) {
    const title = cdataOrText(block, "title");
    const url   = (cdataOrText(block, "link") ||
                   cdataOrText(block, "guid"))?.trim();
    const date  = cdataOrText(block, "pubDate") ||
                  cdataOrText(block, "dc:date")  ||
                  cdataOrText(block, "published") || "";
    const raw   = cdataOrText(block, "description") ||
                  cdataOrText(block, "content:encoded") || "";
    if (!title) continue;
    items.push({
      title:      decode(title.trim()),
      url:        url || "",
      date:       date.trim(),
      excerpt:    stripHTML(decode(raw)).slice(0, 200) || "",
      sourceName,
    });
  }

  return items;
}

function cdataOrText(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim();
}

function decode(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#8211;/g, "–").replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'").replace(/&#8230;/g, "…").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripHTML(s) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
