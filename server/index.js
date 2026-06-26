"use strict";

/**
 * RunAdam sunucusu
 * --------------------------------------------------------------
 * - Statik frontend (public/) servisi
 * - POST /api/vision-activity : kosu bandi / kardiyo ekranini Claude vision ile okur
 * - GET/PUT /api/kv/:key      : cihazlar arasi bulut senkron (kullanici senkron kodu)
 *
 * Ortam degiskenleri:
 *   ANTHROPIC_API_KEY - (vision icin gerekli) Claude API anahtari, sadece backend okur
 *   VISION_MODEL      - (ops.) varsayilan claude-opus-4-8; daha ucuz icin claude-haiku-4-5
 *   DATABASE_URL      - (ops.) varsa Postgres'e kaydeder, yoksa yerel JSON dosyasi
 *   PORT              - (ops.) varsayilan 3000
 */

require("dotenv").config();

const express = require("express");
const path = require("path");
const { loadKey, saveKey, backendName } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "4mb" }));

// --- CORS (github.io gibi farkli bir adresten frontend bu API'yi cagirabilsin) ---
app.use("/api", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.header("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// --- Saglik kontrolu ---
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    visionConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    storage: backendName()
  });
});

// --- Bulut senkron ---
app.get("/api/kv/:key", async (req, res) => {
  try {
    const data = await loadKey(req.params.key);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({ ok: false, error: "invalid_key" });
  }
});
app.put("/api/kv/:key", async (req, res) => {
  try {
    const data = (req.body && req.body.data) ?? null;
    await saveKey(req.params.key, data);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: "save_failed" });
  }
});

// --- Kosu bandi / kardiyo ekrani okuma (Claude vision) ---
const VISION_MODEL = process.env.VISION_MODEL || "claude-opus-4-8";
const ACT_VISION_PROMPT =
  "Bu bir kosu bandi / kardiyo makinesi / fitness uygulamasi antrenman ozeti ekrani. Degerleri dikkatle oku. " +
  "SADECE su JSON formatinda yanit ver, baska hicbir metin yazma:\n" +
  '{"name":"","kcal":0,"distance":0,"durationSec":0,"avgHr":0,"avgSpeed":0,"avgPaceSec":0,"incline":0,"climb":0,"watt":0,"mets":0}\n' +
  "name=aktivite adi (orn 'Kosu Bandi'); kcal=yakilan kalori; distance=mesafe km; " +
  "durationSec=toplam sure SANIYE cinsinden (orn 1:00:05 -> 3605); avgHr=ortalama nabiz bpm; " +
  "avgSpeed=ortalama hiz km/sa; avgPaceSec=ortalama tempo (dk/km) SANIYE cinsinden (orn 5:52 -> 352); " +
  "incline=ortalama egim %; climb=tirmanilan mesafe metre; watt=ortalama watt; mets=ortalama METs. " +
  "Okunmayan veya ekranda olmayan degeri 0 yaz. Ondalik ayraci virgul olabilir (10,2 -> 10.2).";

function parseVisionJson(text) {
  if (!text) return null;
  let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch (e) {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

async function claudeVision(apiKey, image, mediaType, prompt) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: prompt }
        ]
      }]
    })
  });
  if (!r.ok) {
    const t = await r.text();
    const err = new Error("api_error"); err.status = r.status; err.body = t.slice(0, 300);
    throw err;
  }
  const data = await r.json();
  const textBlock = (data.content || []).find(b => b.type === "text");
  return parseVisionJson(textBlock && textBlock.text);
}

app.post("/api/vision-activity", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "no_api_key" });
  const image = (req.body && req.body.image) || "";
  const mediaType = (req.body && req.body.mediaType) || "image/jpeg";
  if (!image) return res.status(400).json({ error: "no_image" });
  try {
    const parsed = await claudeVision(apiKey, image, mediaType, ACT_VISION_PROMPT);
    res.json(parsed || {});
  } catch (e) {
    console.error("vision-activity failed", e && e.status, e && (e.body || e.message));
    res.status(502).json({ error: "api_error" });
  }
});

// --- Statik frontend ---
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n  RunAdam calisiyor:  http://localhost:${PORT}`);
  console.log(`  Saklama: ${backendName()}`);
  console.log(`  Vision: ${process.env.ANTHROPIC_API_KEY ? "AKTIF" : "kapali (ANTHROPIC_API_KEY yok)"}`);
  console.log("");
});
