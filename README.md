# 🏃 RunAdam

> _"Gelecek azmedenlere adanmıştır."_

Koşu bandı / kardiyo makinesi / fitness uygulaması özet ekranının **fotoğrafını çek**,
süre · mesafe · kalori · tempo · hız · nabız · eğim · tırmanış · watt · METs değerleri
**otomatik okunup** günlük aktivite kaydına eklensin. Web + mobil (PWA).

- **Backend:** Node.js + Express (Claude vision + bulut senkron)
- **Frontend:** Tek dosya statik HTML/CSS/JS (framework yok)
- **Tema:** Kırmızı ağırlıklı; gece/parlamento mavisi yıldızlı uzay; eğilmiş depara kalkan koşucu logosu

---

## Özellikler

- 📷 **Otomatik okuma:** Fotoğraf → `POST /api/vision-activity` (Claude vision). Okunan değerler **elle düzeltilebilir** (sensör/ölçüm hatasına karşı).
- ☁️ **Cihazlar arası senkron:** Her kullanıcının bir **senkron kodu** vardır; veriler sunucuda saklanır (`GET/PUT /api/kv/:key`). Web ve mobilde aynı kod girilince **otomatik güncellenir**. Çevrimdışıyken cihazda saklanır, internet gelince eşitlenir.
- 💾 **Yedek:** Ayarlar'dan JSON yedeği indir/yükle (Google Drive'a saklayabilirsin).
- 📊 **Tablo & istatistik:** Günlük/Haftalık/Aylık filtreli tablo, toplamlar, gün serisi (streak), son 7 gün grafiği.

---

## Kurulum (yerel)

Gereksinim: **Node.js 18+**

```bash
npm install
cp .env.example .env      # ANTHROPIC_API_KEY'i doldur
npm start                 # http://localhost:3000
```

`ANTHROPIC_API_KEY` olmadan da çalışır; sadece fotoğraf okuma kapalı olur, değerleri elle girersin.

---

## Yayına alma (Render.com)

1. Bu repoyu GitHub'a bağla, Render'da **New → Blueprint** ile `render.yaml`'ı seç.
2. Servis ortam değişkenlerine **`ANTHROPIC_API_KEY`** gir (zorunlu).
3. (Opsiyonel) Kalıcı saklama için bir Postgres oluşturup **`DATABASE_URL`** ekle. Yoksa yerel dosya kullanılır.
4. Deploy bitince adres: `https://<servis-adi>.onrender.com`

Telefonda adresi açıp **"Ana ekrana ekle"** ile uygulama gibi kullanabilirsin.

---

## API

| Yöntem | Yol | Açıklama |
|---|---|---|
| `GET` | `/api/health` | Durum + vision/saklama bilgisi |
| `POST` | `/api/vision-activity` | `{image, mediaType}` → okunan aktivite değerleri |
| `GET` | `/api/kv/:key` | Senkron blob'unu oku |
| `PUT` | `/api/kv/:key` | `{data}` senkron blob'unu yaz |

Güvenlik: `ANTHROPIC_API_KEY` yalnızca backend'de okunur, frontend'e **asla** gönderilmez.
