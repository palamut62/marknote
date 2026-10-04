# Marknote - "Sade not defteri" uygulama raporu

Tarih: 4 Ekim 2026 · Dayanak: `marknote-sade-not-defteri-uygulama-talimati.pdf` (3 Ekim 2026 incelemesi)
Ürün sahibi: Umut Çelik · [X](https://x.com/palamut62) · [GitHub](https://github.com/palamut62)

Bu rapor yapılan değişiklikleri ve kanıtlarını özetler. Push, EXE üretimi, kurulum ve kurulu uygulama testi yapılmadı (yetkilendirilmedi).

## Kanıt türleri

- **Birim**: `bun test` (69 test, 8 dosya). `tests/rich-roundtrip.test.ts` gerçek tiptap editörünü (uygulamadaki uzantı listesiyle) happy-dom üzerinde çalıştırır.
- **Akış**: Tarayıcıda gerçek uygulama, geliştirme modunda `?mock` ile açılan sahte Tauri katmanı (`src/dev/mock-tauri.ts`; bellekte Windows yollu dosya sistemi, hata enjeksiyonu). Playwright ile sürüldü. Bu katman üretim paketine girmez (dist içinde aranarak doğrulandı).
- **Rust**: `cargo check` ve `cargo test --lib store` (çöp kutusu ad çakışması, belge anahtarı).
- **Masaüstü**: `tauri dev` ile yeni Rust kodu derlendi ve uygulama açıldı. Ekran kontrolü izni verilmediği için masaüstünde kullanıcı akışı **çalıştırılmadı**.

## F maddeleri

| ID | Durum | Ne yapıldı | Kod |
| --- | --- | --- | --- |
| F01 | Düzeltildi | Tablo, görev listesi, görsel uzantıları eklendi; görev listesi "sıkı" yazılıyor. Frontmatter, satır sonu (CRLF) ve son satır sonu editör dışında korunuyor. Her yüklemede editörden geçirip yapı karşılaştırması yapılıyor; kayıp varsa (ham HTML, hizalı tablo…) editör salt okunur olur ve "Markdown görünümünde düzenle" sunar. | `components/editor/rich-editor.tsx`, `rich-extensions.ts`, `lib/rich-compat.ts` |
| F02 | Düzeltildi | Dört boolean yerine tek `viewMode` (Yaz / Markdown / Bölünmüş / Okuma). Editörler gizlenir, yok edilmez. Toolbar yok edilmiş editörü kullanmaz (`onEditorReady(null)` işleniyor). Hata sınırı + toparlama paneli. | `app.tsx`, `rich-toolbar.tsx`, `splitter.tsx`, `editor-error-boundary.tsx` |
| F03 | Düzeltildi | Kurtarma dosyası, açılışta okunup kullanıcı karar verene kadar ne yazılır ne silinir. Karar dialogu Esc ile kapanmaz; "Taslağı sil" ikinci onay ister. Geri yüklenen taslak kaydedilene kadar diskte kalır. | `hooks/use-file-session.ts`, `overlays/dialogs.tsx` |
| F04 | Düzeltildi | Tüm belge değiştirme yolları tek korumadan geçiyor: liste, arama sonucu, yeni not, klasörde yeni not, dosya aç, son açılanlar, OS sürükle-bırak, "open-file" olayı, oluşturmayı geri alma, kurtarma geri yükleme, tray çıkışı. Kayıt başarısızsa veya iptal edilirse mevcut not açık kalır. | `app.tsx` (`continueNavigation`), `hooks/use-file-ops.ts` |
| F05 | Düzeltildi | Yol karşılaştırma Windows'a uygun (ayraç ve büyük/küçük harf duyarsız). Taşıma/yeniden adlandırmada açık not, kök klasör, son açılanlar, sabitlenenler, seçili klasör ve geri alma yığını birlikte güncelleniyor. | `lib/paths.ts`, `use-file-ops.ts`, `use-file-session.ts` |
| F06 | Düzeltildi | AI isteği belge kimliğine bağlı; başka nota geçilirse sonuç gösterilmez. Uygularken metin değiştiyse yalnız tek ve kesin eşleşmede yeniden konumlanır, aksi halde reddedilir. İptal düğmesi, 90 sn zaman aşımı, 100.000 karakter sınırı. | `app.tsx` (`runAi`, `applyAiReview`) |
| F07 | Düzeltildi | Arama ve link denetimi `try/finally` ile; dosya başına hata kaydı, iptal, sınır bildirimi. Hatalı yüzde kodlaması kırık link olarak listelenir. | `overlays/developer-tools-overlay.tsx`, `lib/notes-index.ts` |
| F08 | Düzeltildi | Uygulamaya ait çöp kutusu (Rust): taşı, listele, geri yükle, kalıcı sil, boşalt. Geri yükleme hiçbir dosyanın üzerine yazmaz ("(geri yüklendi)" eki). Klasör mesajı gerçek davranışla aynı. `window.confirm` kaldırıldı. Taşıma sonrası "Geri al" bildirimi. | `src-tauri/src/store.rs`, `lib/trash.ts`, `app.tsx` |
| F09 | Düzeltildi | Durumlar: Kaydedilmedi / Kaydediliyor / Kaydedildi / Kayıt başarısız (+Tekrar dene). Yeni not "Yeni not" başlığıyla, kaydedilecek klasör ve başlıktan önerilen dosya adıyla. Başarı yalnız yazma bitince. Otomatik kayıt eklenmedi. | `use-file-session.ts`, `shell/editor-header.tsx` |
| F10 | Düzeltildi | Tek font listesi (Sans / Serif / Mono, "Diğer" altında); önizleme beyaz listesi aynı listeden. Eski sürümlerin font değerleri birebir eşleşmeyle hâlâ işleniyor. | `lib/fonts.ts`, `lib/markdown.ts` |
| F11 | Düzeltildi | Disk tabanlı, belge başına 20 sürümlük geçmiş (Rust). Eski localStorage sürümleri bir kez diske taşınır. Geri yükleme önce mevcut hâli sürüm olarak kaydeder; başka notun sürümü uygulanmaz; hata görünür. | `store.rs`, `lib/history.ts`, `overlays/history-overlay.tsx` |

## R maddeleri

| ID | Durum | Not |
| --- | --- | --- |
| R01 | Uygulandı, masaüstünde doğrulanmadı | Kayıt artık aynı klasörde geçici dosyaya yazıp üzerine yeniden adlandırıyor. Disk dolu senaryosu sahte katmanda denendi (yazma hatası → not açık, "Kayıt başarısız"). Gerçek disk dolması/çökme denenmedi. |
| R02 | Uygulandı | Açma istekleri sıra numarasıyla; eski okuma yeni seçimi ezemez. Kayıt sırasında nota geçilirse kaydın sonucu yeni notun durumunu değiştirmez. |
| R03 | Uygulandı, masaüstünde doğrulanmadı | Tray "Çık": önce ön yüze haber verir; kurtarma taslağı hemen yazılır, kaydedilmemiş değişiklik varsa Kaydet/Kaydetme/İptal sorulur. İkinci "Çık" tıklaması her durumda çıkar (asılı kalmaz). |
| R04 | Uygulandı, masaüstünde doğrulanmadı | Başlangıç argümanındaki dosya açılır; `tauri-plugin-single-instance` ile çalışan uygulamaya ikinci açılışın dosyası iletilir. Derlendi; çift tıklama kurulu sürümde denenmedi. |
| R05 | Kısmen | İzleyici hata sonrası durmuyor, geri gelen dosyayı algılıyor; pencere odağında klasör ağacı yenileniyor. İç içe klasör değişikliklerini anlık izleme (gerçek dosya izleyici) eklenmedi. |
| R06 | Uygulandı | 5000 dosya, 200 sonuç ve 1 MB üstü dosya sınırları kullanıcıya gösteriliyor; arama iptal edilebilir; okuma eşzamanlılığı sınırlı. Artımlı indeksleme yapılmadı. |

## Gizlilik ve performans

- Gizli bilgi içeren metin AI'ya gönderilmeden önce uyarı: "Maskeleyerek gönder" (anahtarlar yer tutucuyla gider, sonuçta geri konur) veya "Olduğu gibi gönder". Akış testinde OpenRouter'a giden metinde anahtar olmadığı doğrulandı.
- İnternet görselleri varsayılan olarak yüklenmez (Ayarlar > Gizlilik); hem editörde hem önizlemede. Gizlilik sekmesi kurtarma, sürüm, çöp kutusu konumunu ve şifrelenmediğini açıklar.
- **CSP**: değerlendirildi, **uygulanmadı**. Shiki (wasm), Mermaid ve OpenRouter bağlantıları masaüstünde test edilmeden kısıtlayıcı bir CSP uygulamayı kırabilir. `$HOME/**` izinleri de aynı nedenle daraltılmadı. Sonraki iş paketi önerisi.
- Dosya açma artık tek okuma (boyut + ikili imza + UTF-8 kontrolü). Geçersiz UTF-8 dosya bozulmasın diye açılmıyor.
- Ana paket 1,70 MB → 1,78 MB (tablo/görev uzantıları). Kod bölme yapılmadı; başlangıç süresi ölçülmedi.

## Arayüz

Sol gezinme (Notlarım, Yeni not, Tüm notlar, Son açılanlar, Sabitlenenler, klasör ağacı, Çöp kutusu, Ayarlar), not listesi (tek arama kutusu, başlık/özet/tarih), tek belge (konum, kayıt durumu, odak, ⋯ menüsü), kısa biçim çubuğu. Sade (açık) ve Gece (koyu) temaları; tüm temalarda soluk metin kontrastı ≥4,5:1 (açık temada 2,30:1'den 5,5:1'e). Dialoglarda odak hapsi, açılışta odak, kapanışta önceki kontrole dönüş; arka plandaki kısayollar çalışmaz. 640 px'te paneller çekmeceye döner; yatay taşma yok. Beş adımlı tur ve demo belge kaldırıldı. Türkçe metinler, Windows'ta "Dosya Gezgini", Ctrl kısayolları. Hakkında ve Ayarlar'da "Ürün sahibi: Umut Çelik" + X + GitHub.

Gelişmiş özellikler kaldırılmadı, yer değiştirdi: AI ve geliştirici araçları ⋯ menüsü ile Ayarlar > Gelişmiş'te; Vim ve token sayacı Ayarlar > Gelişmiş'te; temalar Ayarlar ve komut paletinde (Ctrl+K).

## Kabul testleri

| ID | Sonuç | Kanıt |
| --- | --- | --- |
| T01 | Geçti | `tests/rich-roundtrip.test.ts`: tablo, görev, görsel, kod, Türkçe karakter, frontmatter; bir karakter ekle → serileştir → yapı korunur. HTML ve hizalı tablo yakalanır. |
| T02 | Geçti | Akış: 4 görünüm × 3 tur geçiş, çökme yok, konsol hatası yok, içerik korunur. |
| T03 | Geçti | Akış: İptal (not açık kalır), Kaydet + yazma hatası (not açık, "Kayıt başarısız"), Tekrar dene (diske yazıldı), Ctrl+N korumalı, Kaydetme, Farklı kaydet iptali (içerik kalır). |
| T04 | Geçti | Akış: kirli notla yeniden yükleme → teklif; karar vermeden ikinci yeniden yükleme → yine teklif; Esc kapatmaz; geri yükle → kaydedilene kadar taslak diskte; kayıttan sonra silinir. |
| T05 | Geçti | Akış: açık notun klasörü "İş" → "Arşiv"; düzenle, kaydet → yalnız yeni yol güncellendi; Ctrl+Alt+Z ile geri al → doğru yola kayıt. |
| T06 | Geçti | Akış (OpenRouter sahte yanıt, 1,5 sn gecikme): başka nota geçince sonuç gösterilmedi; metin değişince uygulama reddedildi; iptal çalıştı; maskeli gönderim. Zaman aşımı kodda, akışta denenmedi. |
| T07 | Kısmen | Birim: arama sınır bildirimi; kod: `try/finally`, dosya başına hata, hatalı kodlama. Okunamayan dosya ile canlı akış denenmedi. |
| T08 | Geçti | Akış + Rust testi: çöp kutusuna taşı, aynı adda yeni dosya varken geri yükle → mevcut dosya korunur, "(geri yüklendi)" adıyla döner; klasör onay metni doğru. |
| T09 | Çalıştırılmadı | Gerçek Save As/disk hatası, dış dosya değişimi, tray çıkışı, Windows çift tıklama masaüstünde denenmedi (ekran kontrolü izni yok). |
| T10 | Geçti (tarayıcı) | 1100 ve 640 px ekranlar, sekme sırası, dialog odağı, kontrast ölçümü, Türkçe/Windows etiketleri. Ekran okuyucu ile test edilmedi. |

Komutlar (4 Ekim): `bun test` 69 geçti / 0 kaldı · `bunx tsc --noEmit` temiz · `bun run build` başarılı (büyük paket uyarısı) · `cargo check` temiz · `cargo test --lib store` 2 geçti.

CI: ön yüz işi (typecheck + test + build, Ubuntu) ve Rust kontrolü + store testleri (macOS ve Windows) eklendi.

## Ekran görüntüleri

`docs/uygulama-raporu-2026-10-04/`: 01 not defteri (1100 px) · 02 odak · 03 bölünmüş · 04 birleşik arama · 05 kaydet/kaydetme/iptal · 06 kayıt başarısız · 07 yeni not kaydedilmedi · 08 çöp kutusu · 09 kurtarma · 10-12 640 px (not, liste çekmecesi, gezinme). Görüntüler sahte katmanla tarayıcıda alındı; 03 ve 01'deki "kırık görsel" kutusu sonradan düzeltildi (engellenen görsel artık metin kutusu).

## Kalanlar ve sonraki sınırlı iş paketi

1. Masaüstünde T09: tray çıkışı, Windows çift tıklama/ikinci örnek, gerçek disk hatası, dış değişiklik çakışması.
2. CSP ve dosya izinlerinin seçili klasöre daraltılması (masaüstü uyumluluk testiyle).
3. İç içe klasörler için gerçek dosya izleyici; büyük klasörde artımlı indeks.
4. Kod bölme (Mermaid/Shiki ve gelişmiş ekranlar) ve başlangıç süresi ölçümü.
5. `package-lock.json` güncellenmedi (proje Bun kullanıyor); npm kullanılacaksa yeniden üretilmeli.
