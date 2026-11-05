# 🩺 CiritTerm - Tıbbi Terminoloji Sınav Hazırlık Platformu

**Geliştirici & Hazırlayan:** Süleyman Cirit  
**Amaç:** Tıbbi terminoloji sınavlarına hazırlanan öğrenciler ve arkadaş grubu için özel olarak geliştirilmiş hızlı, reklamsız, modern ve odaklanmış çalışma platformu.

---

## 🚀 Vercel'de Yayınlama (Deployment)

Bu site statik (HTML/CSS/JS) olarak sıfır konfigürasyonla Vercel üzerinde hemen yayına alınmaya hazır şekilde tasarlanmıştır.

### 1. Yöntem: GitHub ile (Önerilen)
1. Bu `yenisite` klasörünün içeriğini GitHub'da yeni bir depoya (repository) yükleyin.
2. [Vercel](https://vercel.com) hesabınıza giriş yapıp **"Add New Project"** butonuna tıklayın.
3. GitHub deponuzu seçin.
4. **Deploy** butonuna tıklayın. Siteniz saniyeler içinde dünya çapında hızlı CDN üzerinde yayına girecektir.

### 2. Yöntem: Vercel CLI ile
Terminalde `yenisite` klasöründeyken:
```bash
npx vercel
```
komutunu çalıştırarak doğrudan terminalden canlıya alabilirsiniz.

### 3. Yöntem: Yerel Olarak Çalıştırma (Çift Tıklama veya Yerel Sunucu)
- `index.html` dosyasına çift tıklayarak doğrudan tarayıcınızda açabilirsiniz.
- Veya terminalde:
```bash
python -m http.server 8080
```
yazıp `http://localhost:8080` adresine gidebilirsiniz.

---

## 🌟 Yeni ve Güncellenen Özellikler

1. **👥 Çok Kullanıcılı Bağımsız Yıldızlılar (Öğrenci Profilleri):**
   - Sağ üstteki profil hapına tıklayarak Süleyman, arkadaşlarınız veya yeni isimler ekleyebilirsiniz.
   - Her öğrencinin **⭐ Yıldızlı Terimleri** tamamen kendi tarayıcısında ve profiline özel olarak kaydedilir.
   - Arkadaşlar kendi aralarında cihaz paylaşsa bile profillerini seçerek kendi yıldızlı listelerini çalışabilir.

2. **🎯 Test & Sınav (100 ve 200 Soru Seçenekleri):**
   - Artık **10, 25, 50, 100 ve 200 Soru** seçenekleri mevcuttur.
   - 1.093 doğrulanmış tıbbi terim ve ek havuzundan rastgele, mükerrersiz soru türetilir.
   - Sınav sonunda başarı yüzdesi ve hatalı yapılan soruların doğru cevapları karne halinde sunulur.

3. **✍️ Bakarak Yazma Pratiği (Spelling):**
   - Ekranda doğrudan tıbbi terim, okunuşu ve Türkçe anlamı net olarak gösterilir.
   - Altındaki kutuya terime bakarak aynısını yazarsınız; anlık harf kontrolü ile el ve göz hafızası geliştirilir.
   - Enter tuşuna basarak hemen sıradaki terime geçebilirsiniz.

4. **⚡ Sadeleştirilmiş ve Hızlandırılmış Arayüz:**
   - Dikkat dağıtıcı sesli telaffuzlar, yavaşlatan animasyonlar, gelişim ve tekrar listesi kalabalığı kaldırılmıştır.
   - Tamamen sınavda çıkacak terim ve sorulara odaklanılmıştır.

5. **📖 1.093 Doğrulanmış Tıbbi Terim & Ek:**
   - Tıbbi Terimler (853 terim)
   - Ön Ekler (72 ön ek)
   - Son Ekler (66 son ek)
   - Genel Kavramlar, Eponimler, Akronimler ve Kısaltmalar (102 terim)

---

## ⌨️ Klavye Kısayolları

| Tuş | İşlev |
| :--- | :--- |
| **Boşluk (Space)** | Bilgi kartını ön/arka yüzüne çevir |
| **Sağ Ok (→)** | Sonraki bilgi kartına geç |
| **Sol Ok (←)** | Önceki bilgi kartına dön |
| **F** | Terimi aktif profilin yıldızlılarına ekle/çıkar |
| **1, 2, 3, 4** | Test & Sınav modunda A, B, C, D şıklarını seç |
| **Enter** | Yazma pratiğinde sonraki terime geç |
| **ESC** | Açık olan modalları kapat |

