export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=120");

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json, application/rss+xml, application/xml, text/xml, text/html, */*",
  };

  // ── 1. Try WordPress REST API ────────────────────────────────────────────────
  try {
    const wpRes = await fetch(
      "https://www.jayski.com/wp-json/wp/v2/posts?per_page=20&_fields=id,title,link,date,excerpt",
      { headers }
    );
    if (wpRes.ok) {
      const posts = await wpRes.json();
      if (Array.isArray(posts) && posts.length) {
        const items = posts.map(p => ({
          title:   decodeHTML(p.title?.rendered || ""),
          url:     p.link,
          date:    p.date,
          excerpt: stripHTML(decodeHTML(p.excerpt?.rendered || "")).slice(0, 220),
        }));
        return res.status(200).json({ source: "WordPress API", items });
      }
    }
  } catch (_) { /* fall through */ }

  // ── 2. Try RSS feed ──────────────────────────────────────────────────────────
  try {
    const rssRes = await fetch("https://www.jayski.com/feed/", { headers });
    if (rssRes.ok) {
      const xml = await rssRes.text();
      const items = parseRSS(xml);
      if (items.length) return res.status(200).json({ source: "RSS", items });
    }
  } catch (_) { /* fall through */ }

  return res.status(502).json({ error: "Jayski is unreachable — check back later." });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeHTML(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#8211;/g, "–").replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'").replace(/&#8230;/g, "…").replace(/&nbsp;/g, " ");
}

function stripHTML(s) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRSS(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  for (const block of blocks.slice(0, 20)) {
    const title   = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                     block.match(/<title[^>]*>([\s\S]*?)<\/title>/))?.[1] || "";
    const link    = (block.match(/<link>([\s\S]*?)<\/link>/) ||
                     block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/))?.[1] || "";
    const date    = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";
    const rawDesc = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                     block.match(/<description[^>]*>([\s\S]*?)<\/description>/))?.[1] || "";
    if (title.trim()) {
      items.push({
        title:   decodeHTML(title.trim()),
        url:     link.trim(),
        date:    date.trim(),
        excerpt: stripHTML(decodeHTML(rawDesc)).slice(0, 220),
      });
    }
  }
  return items;
}
