import express from "express";
import fetch from "node-fetch";
import cheerio from "cheerio"; // ✅ HTML 파싱용 라이브러리
import cors from "cors";

const app = express();
app.use(cors());

app.get("/naver", async (req, res) => {
  const { url, keyword } = req.query;
  if (!url) return res.status(400).send("Missing url");
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }});
    const html = await response.text();
    const $ = cheerio.load(html);

    // ✅ 네이버 언론사별 구조 탐색 (기사 목록)
    const articles = [];
    $("a.section_item").each((i, el) => {
      const title = $(el).find(".section_item_inner").text().trim();
      const link = $(el).attr("href");
      if (title.includes(keyword)) {
        articles.push({ title, link });
      }
    });

    // ✅ 각 기사 본문 요약
    const summarized = [];
    for (const art of articles.slice(0, 5)) {
      try {
        const page = await fetch(art.link, { headers: { "User-Agent": "Mozilla/5.0" }});
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
