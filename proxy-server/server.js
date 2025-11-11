import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());

// ✅ 캐시: 1시간 유지
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;

function setCache(key, data) {
  cache.set(key, { data, time: Date.now() });
}
function getCache(key) {
  const c = cache.get(key);
  if (!c) return null;
  if (Date.now() - c.time > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return c.data;
}

// ✅ 대상 언론사 (매일경제 + 한국경제)
const pressList = [
  { id: "009", name: "매일경제", rss: "https://rss.naver.com/newspaper/009.xml" },
  { id: "015", name: "한국경제", rss: "https://rss.naver.com/newspaper/015.xml" }
];

/* ============================================
   🔹 RSS + media.naver.com fallback 통합 버전
============================================ */
app.get("/naver-rss", async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) return res.status(400).send("Missing keyword");
  const lowerKey = keyword.toLowerCase();

  // ✅ 캐시 확인
  const cacheKey = `eco_${lowerKey}`;
  const cached = getCache(cacheKey);
  if (cached) {
    console.log("💾 Cached:", keyword);
    return res.json(cached);
  }

  const results = [];

  for (const press of pressList) {
    try {
      // 1️⃣ 먼저 RSS 시도
      const xml = await fetch(press.rss).then(r => r.text());
      const $ = cheerio.load(xml, { xmlMode: true });
      let found = 0;

      $("item").each((_, el) => {
        if (found >= 10) return; // 최대 10개
        const title = $(el).find("title").text().trim();
        const link = $(el).find("link").text().trim();
        const desc = $(el).find("description").text().trim();
        if (
          title.toLowerCase().includes(lowerKey) ||
          desc.toLowerCase().includes(lowerKey)
        ) {
          const summary = desc.split(/(?<=[.!?。！？])\s+/).slice(0, 2).join(" ");
          results.push({
            press: press.name,
            title,
            link,
            summary: summary || desc.slice(0, 200),
            full: desc
          });
          found++;
        }
      });

      // 2️⃣ fallback: RSS 비었을 때 media.naver.com 크롤링
      if (found === 0) {
        console.log(`[${press.name}] fallback → media.naver.com`);
        const mediaUrl = `https://media.naver.com/press/${press.id}/newspaper`;
        const html = await fetch(mediaUrl, {
          headers: { "User-Agent": "Mozilla/5.0" }
        }).then(r => r.text());
        const $$ = cheerio.load(html);
        $$("a.sa_text_strong").each((i, el) => {
          const title = $$(el).text().trim();
          const href = $$(el).attr("href");
          const link = href?.startsWith("http")
            ? href
            : `https://n.news.naver.com${href}`;
          if (title.toLowerCase().includes(lowerKey)) {
            results.push({
              press: press.name,
              title,
              link,
              summary: "본문 요약 중...",
              full: ""
            });
          }
        });
      }
    } catch (err) {
      console.error(`[${press.name}] 수집 실패:`, err.message);
    }
  }

  // ✅ 본문 요약 (RSS / fallback 공통)
  for (const art of results) {
    if (!art.link || art.full) continue;
    try {
      const html = await fetch(art.link, {
        headers: { "User-Agent": "Mozilla/5.0" }
      }).then(r => r.text());
      const $ = cheerio.load(html);
      const text = $("#dic_area").text().replace(/\s+/g, " ").trim();
      if (text) {
        art.full = text.slice(0, 3000);
        const sentences = text.split(/(?<=[.!?。！？])\s+/).filter(s => s.length > 30);
        art.summary = sentences.slice(0, 2).join(" ") || text.slice(0, 200);
      }
    } catch {
      art.summary = "요약 실패";
    }
  }

  // ✅ 캐시 저장
  setCache(cacheKey, results);

  res.json(results.slice(0, 30));
});

/* ============================================
   ✅ 서버 실행
============================================ */
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`✅ Proxy running on port ${port}`));
