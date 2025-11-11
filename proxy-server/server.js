import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import cheerio from "cheerio";

const app = express();
app.use(cors());

/* ===== 일반 프록시 (RSS, HTML 등) ===== */
app.get("/proxy", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send("Missing url param");
  try {
    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RenderProxy/1.0)",
        "Accept": "text/html,application/xml;q=0.9"
      },
      redirect: "follow"
    });
    const text = await response.text();
    res.set("Access-Control-Allow-Origin", "*");
    res.send(text);
  } catch (e) {
    res.status(500).send("Proxy error: " + e.message);
  }
});

/* ===== 네이버 기사 크롤링 + 요약 ===== */
app.get("/naver", async (req, res) => {
  const { url, keyword } = req.query;
  if (!url) return res.status(400).send("Missing url");
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await response.text();
    const $ = cheerio.load(html);

    const articles = [];
    $("a.section_item").each((i, el) => {
      const title = $(el).find(".section_item_inner").text().trim();
      const link = $(el).attr("href");
      if (title && (!keyword || title.includes(keyword))) {
        articles.push({ title, link });
      }
    });

    const summarized = [];
    for (const art of articles.slice(0, 5)) {
      try {
        const page = await fetch(art.link, { headers: { "User-Agent": "Mozilla/5.0" } });
        const pageHtml = await page.text();
        const $$ = cheerio.load(pageHtml);
        const text = $$("div#dic_area").text().replace(/\s+/g, " ").trim();
        const summary = text.split(/(?<=[.!?。！？])\s+/).slice(0, 2).join(" ");
        summarized.push({ ...art, summary });
      } catch (e) {
        summarized.push({ ...art, summary: "요약 실패" });
      }
    }

    res.json(summarized);
  } catch (e) {
    res.status(500).send("Error: " + e.message);
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`✅ Proxy running on port ${port}`));
