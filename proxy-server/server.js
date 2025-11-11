import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());

/* ============================================
   🔹 언론사별 RSS 피드 목록
============================================ */
const pressFeeds = [
  { name: "매일경제", url: "https://www.mk.co.kr/rss/30000001/" },
  { name: "한국경제", url: "https://www.hankyung.com/feed/" },
  { name: "서울신문", url: "https://www.seoul.co.kr/rss/" },
  { name: "국민일보", url: "https://rss.kmib.co.kr/rss/total.xml" }
];

/* ============================================
   🔹 네이버 RSS 기반 뉴스 요약 API
============================================ */
app.get("/naver-rss", async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) return res.status(400).send("Missing keyword");

  const lowerKey = keyword.toLowerCase();
  const results = [];

  for (const press of pressFeeds) {
    try {
      const response = await fetch(press.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
        }
      });
      const xml = await response.text();
      const $ = cheerio.load(xml, { xmlMode: true });

      $("item").each((_, el) => {
        const title = $(el).find("title").text().trim();
        const link = $(el).find("link").text().trim();
        let desc = $(el).find("description").html()?.trim() || "";
        // 🔧 CDATA 안의 HTML을 정리해서 텍스트로 변환
        desc = desc.replace(/<!\[CDATA\[|\]\]>/g, "")
                   .replace(/<[^>]*>/g, "")
                   .replace(/\s+/g, " ")
                   .trim();

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
        }
      });
    } catch (err) {
      console.error(`[${press.name}] RSS 오류:`, err.message);
    }
  }

  res.json(results.slice(0, 50));
});

/* ============================================
   ✅ 서버 실행
============================================ */
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`✅ Proxy running on port ${port}`));
