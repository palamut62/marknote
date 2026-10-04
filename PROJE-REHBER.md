# Marknote - proje rehberi

Tauri 2 (Rust) + React 19 + TypeScript masaüstü not uygulaması. Notlar seçilen klasörde düz `.md` dosyalarıdır. Paket yöneticisi Bun.
Ürün sahibi: Umut Çelik · https://x.com/palamut62 · https://github.com/palamut62

## Klasör haritası

| Yol | İçerik |
| --- | --- |
| `src/app.tsx` | Uygulama kabuğu: görünüm durumu, ortak geçiş koruması (`continueNavigation`), AI akışı, çöp kutusu/geçmiş akışları, menüler |
| `src/components/shell/` | Sade düzen: `nav-panel` (sol), `note-list` (orta), `editor-header` (belge başlığı + kayıt durumu) |
| `src/components/editor/` | `rich-editor` (tiptap, varsayılan "Yaz"), `rich-extensions` (tek uzantı listesi), `rich-toolbar`, `editor` (CodeMirror), `preview`, `editor-error-boundary` |
| `src/components/overlays/` | `dialogs` (onay, ad girişi, kaydedilmemiş değişiklik, kurtarma, gizli bilgi), `history-overlay`, ayarlar, hakkında, geliştirici araçları |
| `src/hooks/use-file-session.ts` | Belge oturumu: `docId`, yükleme sırası, kayıt durumu, kurtarma kararı |
| `src/hooks/use-file-ops.ts` | Taşı/yeniden adlandır/oluştur + geri alma, yol eşleme |
| `src/lib/` | `files` (atomik kayıt, tek okumalı yükleme), `paths`, `rich-compat`, `notes-index` (liste + arama), `trash`, `history`, `fonts`, `remote-images`, `secret-mask` |
| `src-tauri/src/store.rs` | Çöp kutusu ve belge başına sürüm geçmişi (uygulama verisi klasörü) |
| `src-tauri/src/lib.rs` | Komutlar, tray (güvenli çıkış), tek örnek, başlangıç dosyası |
| `src/dev/mock-tauri.ts` | Yalnız geliştirme: `http://localhost:<port>/?mock` ile tarayıcıda sahte dosya sistemi |
| `tests/` | `bun test`; `rich-roundtrip.test.ts` gerçek tiptap'ı happy-dom'da çalıştırır |
| `docs/uygulama-raporu-2026-10-04.md` | Son uygulama raporu (F/R/T durumları) |

## Verilmiş kararlar

- Ana ekran "Sade not defteri"; Markdown/Bölünmüş/Okuma ⋯ menüsünden. AI, geliştirici araçları, Vim, token sayacı Gelişmiş altında.
- Zengin editör yalnız kayıpsız round-trip geçen belgeleri düzenler; aksi halde salt okunur + Markdown görünümü.
- Silme = uygulama içi çöp kutusu; kalıcı silme ayrı ve onaylı. Geri yükleme üzerine yazmaz.
- Otomatik kayıt yok (isteğe bağlı, sonraki aşama). Kurtarma taslağı 750 ms gecikmeyle yazılır.
- İnternet görselleri varsayılan kapalı. CSP henüz tanımlı değil (masaüstü testi bekliyor).
- Native `alert/confirm/prompt` yasak; hepsi `overlays/dialogs.tsx`.

## Doğrulama

```
bun test
bunx tsc --noEmit
bun run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --lib store
```

## Açık bulgular

Masaüstünde doğrulanmamış: tray çıkışı, Windows çift tıklama/ikinci örnek, gerçek disk hatası (rapor T09). CSP ve `$HOME/**` izin daraltma. İç içe klasör izleme. Kod bölme.

## Hangi istek için nereye bak

| İstek | Yer |
| --- | --- |
| Kayıt / kurtarma / dosya geçişi | `use-file-session.ts`, `app.tsx` `continueNavigation` |
| Editör içerik kaybı | `rich-extensions.ts`, `rich-compat.ts`, `tests/rich-roundtrip.test.ts` |
| Liste / arama | `notes-index.ts`, `shell/note-list.tsx` |
| Çöp kutusu / sürümler | `store.rs`, `lib/trash.ts`, `lib/history.ts` |
| Tema / renk | `styles/tokens.css`, `styles/shell/notebook.css`, `lib/theme.ts` |
