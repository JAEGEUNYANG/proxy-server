import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

// 🔹 단순 프록시 (media.naver.com 요청용)
app.get("/proxy", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing url");
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
      }
    });
    const text = await response.text();
    res.send(text);
  } catch (err) {
    res.status(500).send("Proxy Error: " + err.message);
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`✅ Proxy running on port ${port}`));
