import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());

/* ============================================
   🔹 다중 언론사 뉴스 순회 크롤러
============================================ */
app.get("/naver-multi", async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) return res.status(400).send("Missing keyword");

  const pressCodes = [
    { id: "009", name: "매일경제" },
    { id: "015", name: "한국경제" },
    { id: "005", name: "국민일보" },
    { id: "081", name: "서울신문" }
  ];

  const results = [];

  for (const press of pressCodes) {
    const url = `https://media.naver.com/press/${press.id}/newspaper`;
    try {
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const html = await response.text();
      const $ = cheerio.load(html);

      const articles = [];
      $("a.sa_text_strong").each((i, el) => {
        const title = $(el).text().trim();
        const link = $(el).attr("href");
        if (title && title.includes(keyword)) {
          articles.push({
            press: press.name,
            title,
            link: link.startsWith("http") ? link : `https://n.news.naver.com${link}`
          });
        }
      });

      for (const art of articles.slice(0, 3)) {
        try {
          const page = await fetch(art.link, { headers: { "User-Agent": "Mozilla/5.0" } });
          const pageHtml = await page.text();
          const $$ = cheerio.load(pageHtml);
          const text = $$("div#dic_area").text().replace(/\s+/g, " ").trim();
          const sentences = text.split(/(?<=[.!?。！？])\s+/).filter(s => s.length > 30);
          const summary = sentences.slice(0, 2).join(" ");
          results.push({ ...art, summary: summary || "요약 불가" });
        } catch {
          results.push({ ...art, summary: "요약 실패" });
        }
      }
    } catch (err) {
      console.error(`[${press.name}] 크롤링 실패:`, err.message);
    }
  }

  res.json(results);
});

/* ============================================
   ✅ 서버 실행
============================================ */
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`✅ Proxy running on port ${port}`));
