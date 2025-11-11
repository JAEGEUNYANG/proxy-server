import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());

/* ============================================
   🔹 기본 프록시
============================================ */
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

/* ============================================
   🔹 단일 언론사용 네이버 기사 크롤러
============================================ */
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
        const sentences = text.split(/(?<=[.!?。！？])\s+/).filter(s => s.length > 30);
        const summary = sentences.slice(0, 2).join(" ");
        summarized.push({ ...art, summary: summary || "요약 불가" });
      } catch (err) {
        summarized.push({ ...art, summary: "요약 실패" });
      }
    }

    res.json(summarized);
  } catch (e) {
    res.status(500).send("Error: " + e.message);
  }
});

/* ============================================
   🔹 다중 언론사 뉴스 순회 크롤러
   예시: /naver-multi?keyword=서울
============================================ */
app.get("/naver-multi", async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) return res.status(400).send("Missing keyword");

  // 🔹 언론사 코드 목록 (추가 가능)
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
      $("a.section_item").each((i, el) => {
        const title = $(el).find(".section_item_inner").text().trim();
        const link = $(el).attr("href");
        if (title && title.includes(keyword)) {
          articles.push({ press: press.name, title, link });
        }
      });

      // 🔸 각 기사 내용 요약
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
