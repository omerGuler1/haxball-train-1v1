# Haxball 1v1 Antrenman Botu

İki Chrome örneğinin rekabetçi futsal oynadığı, bağımsız bir Haxball 1v1 antrenman odası. Özel bir ortamda yetenekli bir rakip bota karşı pratik yapın.

**Canlı Oda:** 🦇🕸️ **Bats Training Bots v1** on Haxball  
**Topluluk:** [Bats Training Bots Discord](https://discord.gg/z84TRaSVT)

---

## Genel Bakış

Bu, Haxball 1v1 futsal için hafif ve kendi barındırılan bir antrenman odasıdır. İşte nasıl çalıştığı:

- **Host Örneği:** Bir başsız Chrome tarayıcısı, Headless API'sini kullanarak Haxball odasını barındırır
- **Bot Örneği:** İkinci bir başsız Chrome tarayıcısı, rakibiniz olarak oynar—topun peşinden akıllıca koşar ve yakın olduğunda atar
- **Antrenman Öğrencisi:** Odaya katılan ilk insan oyuncu antrenman öğrencisi olur ve bota karşı oynar
- **Tek Harita:** Veritabanı, kimlik doğrulama veya Discord bağımlılığı olmadan bir futsal stadyumu (`bats_map.hbs`)

> **Not:** Bu, çok daha gelişmiş olan **Bats Training Bots** özel sisteminden basitleştirilmiş bir topluluk versiyonudur. Özel sistem 3 harita kare modu, SQLite liderlik tabloları, Discord entegrasyonu ve hile karşıtı sistemler içerir.

---

## Hızlı Başlangıç

### Ön Koşullar
- **Node.js** ≥ 18
- **npm** (Node.js ile birlikte gelir)
- Haxball başsız tokeni ([haxball.com/headlesstoken](https://www.haxball.com/headlesstoken)'ten ücretsiz)

### Kurulum

1. **Bu depoyu klonlayın veya indirin:**
   ```bash
   git clone <repository-url>
   cd haxball-train-1v1
   ```

2. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

3. **Chromium'un yüklendiğinden emin olun:**
   ```bash
   npx puppeteer browsers install chrome
   ```
   Bu genellikle npm install sırasında otomatiktir, ancak Chromium indirilmediyse bunu çalıştırın.

4. **Ortam dosyanızı ayarlayın:**
   - Proje kökünde bir `.env` dosyası oluşturun veya kopyalayın
   - [https://www.haxball.com/headlesstoken](https://www.haxball.com/headlesstoken) adresini ziyaret edin
   - Yeni tokeninizi `.env` dosyasına yapıştırın:
     ```
     HEADLESS_TOKEN=your_token_here
     ```

5. **Antrenman odasını başlatın:**
   ```bash
   npm start
   # veya
   node src/index.js
   ```

6. **Odaya katılın:**
   - Konsol çıktısını bulun: `Room link: https://www.haxball.com/play?c=…`
   - Bu bağlantıyı kopyalayın ve paylaşın veya doğrudan tarayıcınızda açın
   - Siz katıldığında bot otomatik olarak oyunmaya başlayacaktır

---

## Proje Yapısı

```
haxball-train-1v1/
├── src/
│   ├── index.js                 # Giriş noktası
│   ├── orchestrator.js          # Host ve bot örneklerini yönetir
│   ├── hostEntry.js             # Host tarayıcı başlatması
│   ├── host.js                  # Host mantığı (oda oluşturma, yönetim)
│   ├── botEntry.js              # Bot tarayıcı başlatması
│   ├── botProcess.js            # Bot mantığı (karar verme, hareket)
│   ├── joinRoom.js              # Odaya katılma mantığı
│   ├── controlServer.js         # WebSocket kontrol sunucusu
│   ├── inputController.js       # Bot için giriş işleme
│   ├── protocol.js              # İletişim protokolü
│   ├── stadiumLoader.js         # Stadyum dosyası yükleme
│   ├── logger.js                # Günlüğe yazma yardımcıları
│   ├── config.js                # Yapılandırma sabitleri
│   └── injected/                # Tarayıcı sayfalarına enjekte edilen komut dosyaları
│       ├── main.js              # Ana enjekte komut dosyası
│       ├── bridge.js            # İletişim köprüsü
│       ├── decision.js          # Bot karar verme mantığı
│       ├── perception.js        # Oyun durumu algısı
│       ├── state.js             # Durum yönetimi
│       ├── math.js              # Matematik yardımcıları
│       └── util.js              # Genel yardımcılar
├── bats_map.hbs                 # Futsal stadyumu tanımı
├── package.json                 # Proje meta verileri ve bağımlılıklar
├── .env                         # Ortam değişkenleri (oluşturun)
└── README.md                    # Bu dosya
```

---

## Nasıl Çalışır

### Mimari

1. **Orchestrator** (`orchestrator.js`)
   - İki bağımsız Puppeteer işlemi başlatır
   - Biri bir host Chrome örneğini başlatır
   - Biri bir bot Chrome örneğini başlatır
   - WebSocket aracılığıyla işlemler arası iletişimi yönetir

2. **Host İşlemi**
   - Bir oda oluşturmak için Haxball Headless API'sini kullanır
   - Futsal stadyumunu yükler
   - Oyuncu bağlantılarını kabul eder
   - Bot kararlarına dayalı oyuncu hareketlerini simüle eder

3. **Bot İşlemi**
   - Odaya bir oyuncu olarak katılır
   - Oyun durumunu analiz eder (top konumu, oyuncu konumu, vb.)
   - Akıllı kararlar verir (topa kovalala, at, konumlandır)
   - Hareket komutlarını host'a gönderir

4. **Enjekte Edilen Komut Dosyaları**
   - `perception.js`: Oyun durumunu DOM/API'den çıkarır
   - `decision.js`: Bot AI mantığı karar verme için
   - `bridge.js`: Bot ve orchestrator arasındaki iletişimi kolaylaştırır
   - `state.js`: Yerel oyun durumu temsilini korur

### Oyun Döngüsü

```
Host Örneği           Bot Örneği          Orchestrator
    |                     |                    |
    ├─ Oda oluştur        |                    |
    ├─────────────────────────────────────→    |
    |                     ├─ Odaya katıl       |
    |                     ├────────────────→   |
    |                     |                    |
    | [Oyun Devam Ediyor] |                    |
    |                     ├─ Durumu çıkar      |
    |                     ├─ Karar ver         |
    |                     ├─ Komutları gönder  |
    |                     ├────────────────→   |
    |                     |                    ├─ Hareketi uygula
    |                     |                    ├─ Oyunu güncelle
```

---

## Yapılandırma

### Ortam Değişkenleri

Proje kökünde bir `.env` dosyası oluşturun:

```bash
# Gerekli
HEADLESS_TOKEN=your_headless_token_here

# İsteğe bağlı (gösterilen varsayılan)
# PORT=3000
# BOT_NAME=Bot
# HOST_NAME=Host
```

### Oyun Ayarları

Özelleştirmek için `src/config.js` dosyasını düzenleyin:
- Oda ayarları (maksimum oyuncu, şifre, vb.)
- Bot davranış parametreleri
- Stadyum dosyası yolu
- Ağ portları

---

## Kullanım İpuçları

### Antrenman Öğrencileri İçin (Oyuncular)

- **Odaya katılın** konsolda yazdırılan bağlantıyı kullanarak
- Bot **agresif, takip-ve-at stratejisi** oynar
- Savunmacı konumlandırma ve hızlı tepkiler alıştırın
- Botun zorluk seviyesi tutarlı ve tahmin edilebilir

### Geliştiriciler İçin

- **Bot davranışını değiştirin** `src/injected/decision.js` dosyasında
- **Stadyumu ayarlayın** `bats_map.hbs` dosyasını düzenleyerek veya değiştirerek
- **Oyun durumunu izleyin** `logger.js` dosyasındaki konsol günlükleri aracılığıyla
- **Gelişmiş yapay zeka** için `botProcess.js` dosyasına özel mantık ekleyin

---

## Komut Dosyaları

```bash
# Antrenman odasını başlatın
npm start

# JavaScript dosyalarını lint'leyin
npm run lint
```

---

## Sorun Giderme

### "Token geçersiz veya süresi dolmuş"
- [https://www.haxball.com/headlesstoken](https://www.haxball.com/headlesstoken) adresinde yeni bir token oluşturun
- Bunun `.env` dosyanızda doğru şekilde ayarlandığından emin olun

### Chromium bulunamadı
```bash
npx puppeteer browsers install chrome
```

### Oda görünmüyor
- Konsol hata iletilerini kontrol edin
- Yerel bağlantıları engelleyen bir güvenlik duvarı olmadığından emin olun
- Haxball tokeninizin geçerli olduğunu doğrulayın

### Bot hareket etmiyor
- Tarayıcı konsolunda WebSocket bağlantısını kontrol edin
- `controlServer.js` dosyasının çalıştığını doğrulayın
- `botProcess.js` dosyasındaki bot karar mantığını inceleyin

---

## Gelişmiş Konular

### Özel Bot Yapay Zekası

`src/injected/decision.js` dosyasını düzenleyerek kendi bot stratejinizi uygulayın:

```javascript
// Örnek: Daha savunmacı konumlandırma
function decideBotAction(gameState) {
  const { ball, bot, player } = gameState;
  
  if (isCloseToGoal(bot)) {
    return { action: 'defend', direction: calculateBlockingAngle() };
  }
  return { action: 'chase', target: ball };
}
```

### Özel Stadyum

`bats_map.hbs` dosyasını kendi Haxball stadyum dosyasıyla değiştirin (Handlebars biçimi). Stadyum `stadiumLoader.js` dosyası tarafından yüklenir.

### Protokolü Genişletme

Host ve bot arasındaki WebSocket protokolü `protocol.js` dosyasında tanımlanır. Onu aşağıdakileri desteklemek için genişletebilirsiniz:
- Özel oyun etkinlikleri
- Gelişmiş istatistik günlüğe yazma
- Gerçek zamanlı seyirci güncellemeleri

---

## Katkı Yapma

Bu, bir özel antrenman sisteminin topluluk versiyonudur. Katkılar, hata raporları ve özellik talepleri hoş karşılanır!

**İlgili Projeler:**
- 🦇🕸️ [Bats Training Bots](https://discord.gg/z84TRaSVT) — Gelişmiş, üretim versiyonu

---

## Lisans

Bu proje olduğu gibi sağlanır. Ayrıntılar için dahil edilen LICENSE dosyasını kontrol edin.

---

## Sonraki Adımlar

1. ✅ Bağımlılıkları yükleyin (`npm install`)
2. ✅ Başsız bir token alın
3. ✅ Odayı başlatın (`npm start`)
4. ✅ Katılın ve antrenman yapın!

Sorularınız mı var? [Bats Training Bots Discord](https://discord.gg/z84TRaSVT) topluluğuna katılın.

---

**Antrenmanınız için iyi şanslar! 🦇⚽**