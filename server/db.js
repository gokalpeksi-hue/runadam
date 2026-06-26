"use strict";

/**
 * db.js — RunAdam icin basit anahtar-deger deposu.
 *  - Ortamda DATABASE_URL varsa  -> PostgreSQL (bulutta kalici)
 *  - Yoksa                       -> yerel data/kv/<key>.json dosyalari
 * Her kullanici kendi "senkron kodu" ile kendi blob'unu okur/yazar.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const KV_DIR = path.join(DATA_DIR, "kv");

const useDb = Boolean(process.env.DATABASE_URL);
let pool = null;
let initPromise = null;

async function ensureDb() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await pool.query(
      "CREATE TABLE IF NOT EXISTS kv_store (k TEXT PRIMARY KEY, v JSONB NOT NULL)"
    );
  })();
  return initPromise;
}

function safeKey(key) {
  return /^[A-Za-z0-9_-]{1,80}$/.test(String(key || ""));
}

async function loadKey(key) {
  if (!safeKey(key)) throw new Error("invalid_key");
  if (useDb) {
    await ensureDb();
    const res = await pool.query("SELECT v FROM kv_store WHERE k = $1", [key]);
    return res.rows[0] ? res.rows[0].v : null;
  }
  try {
    return JSON.parse(fs.readFileSync(path.join(KV_DIR, key + ".json"), "utf8"));
  } catch {
    return null;
  }
}

async function saveKey(key, value) {
  if (!safeKey(key)) throw new Error("invalid_key");
  if (useDb) {
    await ensureDb();
    await pool.query(
      "INSERT INTO kv_store (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = $2",
      [key, value]
    );
    return;
  }
  if (!fs.existsSync(KV_DIR)) fs.mkdirSync(KV_DIR, { recursive: true });
  fs.writeFileSync(path.join(KV_DIR, key + ".json"), JSON.stringify(value), "utf8");
}

function backendName() {
  return useDb ? "PostgreSQL (DATABASE_URL)" : "Yerel JSON dosyasi";
}

module.exports = { loadKey, saveKey, backendName };
