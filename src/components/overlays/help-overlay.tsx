import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { Button, Icon, Kbd, Overlay, Shortcut } from "@/components/primitives";
import { shortcutLabel } from "@/lib";
import helpIconUrl from "@/assets/brand/marka-ai-icon.png";

type HelpOverlayProps = {
  open: boolean;
  onClose: () => void;
  onReplayTutorial?: () => void;
};

type Row = { keys: string; label: string };

type Group = { title: string; rows: Row[] };

const GROUPS: Group[] = [
  {
    title: "Dosya",
    rows: [
      { keys: "⌘+⇧+O", label: "Not klasörü aç" },
      { keys: "⌘+O", label: "Tek bir .md dosyası aç" },
      { keys: "⌘+N", label: "Yeni not" },
      { keys: "⌘+S", label: "Kaydet (yeni notta kaydedilecek yeri sorar)" },
      { keys: "⌘+⇧+S", label: "Farklı kaydet" },
      { keys: "⌘+⇧+F", label: "Notlarda ara (başlık ve içerik)" },
      { keys: "⌘+⌥+Z", label: "Son taşıma / yeniden adlandırmayı geri al" },
    ],
  },
  {
    title: "Görünüm",
    rows: [
      { keys: "⌘+K", label: "Komut paletini aç" },
      { keys: "⌘+⇧+.", label: "Odak modu (yan panelleri gizle)" },
      { keys: "⌘+.", label: "Okuma görünümünü aç / kapat" },
      { keys: "⌃+⌘+F", label: "Tam ekranı aç / kapat" },
    ],
  },
  {
    title: "Düzenle",
    rows: [
      { keys: "⌘+F", label: "Markdown görünümünde bul / değiştir" },
      { keys: "⌘+G", label: "Sonraki eşleşmeyi bul" },
    ],
  },
  {
    title: "Paylaş",
    rows: [
      { keys: "⌘+⇧+C", label: "Markdown'ı panoya kopyala" },
      { keys: "⌘+P", label: "PDF olarak dışa aktar" },
    ],
  },
  {
    title: "Yardım",
    rows: [
      { keys: "⌘+/", label: "Bu yardımı aç" },
      { keys: "esc", label: "Açık pencereyi kapat" },
    ],
  },
];

const TIPS = [
  "Notlarınız seçtiğiniz klasörde düz .md dosyaları olarak durur; hesap veya bulut yok.",
  "Sol panelden klasör seçin, ortadaki listeden not açın. Arama kutusu başlıklarda ve içerikte birlikte arar; sonuca tıklayınca eşleşen yer seçili açılır.",
  "Kayıt durumu üst çubukta görünür: Kaydedilmedi, Kaydediliyor, Kaydedildi ya da Kayıt başarısız (Tekrar dene).",
  "Silinen notlar Çöp kutusuna gider; oradan geri yükleyebilirsiniz. Aynı adda dosya varsa üzerine yazılmaz.",
  "⋯ menüsünden Markdown, Bölünmüş (kaynak + önizleme) ve Okuma görünümlerine geçebilir, sürüm geçmişini açabilirsiniz.",
  "Yapay zeka ve geliştirici araçları ⋯ menüsünde ve Ayarlar > Gelişmiş altında; günlük yazma alanında yer kaplamaz.",
];

export function HelpOverlay({ open, onClose, onReplayTutorial }: HelpOverlayProps) {
  useEffect(() => {
    if (!open || !onReplayTutorial) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onClose();
        onReplayTutorial();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onReplayTutorial, onClose]);

  return (
    <Overlay open={open} onClose={onClose} ariaLabel="Marknote nasıl kullanılır" variant="modal">
      <header className="mdv-help__header">
        <div className="mdv-help__title">
          <img
            src={helpIconUrl}
            alt=""
            aria-hidden
            width={36}
            height={36}
            draggable={false}
            className="mdv-help__art"
          />
          <div className="mdv-help__title-text">
            <span className="mdv-help__brand">marknote</span>
            <span className="mdv-help__subtitle">Klavye + ipuçları</span>
          </div>
        </div>
        <Button
          title="Kapat (Esc)"
          aria-label="Kapat"
          onClick={onClose}
          icon={<Icon icon={X} size={14} strokeWidth={1.5} />}
        />
      </header>

      <div className="mdv-help__body">
        <section className="mdv-help__section">
          <h3 className="mdv-help__h">Kısayollar</h3>
          <div className="mdv-help__groups">
            {GROUPS.map((g) => (
              <div key={g.title} className="mdv-help__group">
                <div className="mdv-help__group-title">{g.title}</div>
                <ul className="mdv-help__list">
                  {g.rows.map((s) => (
                    <li key={s.label} className="mdv-help__row">
                      <span className="mdv-help__keys">
                        {s.keys.includes("+") ? (
                          <Shortcut keys={s.keys} />
                        ) : (
                          <Kbd>{s.keys}</Kbd>
                        )}
                      </span>
                      <span className="mdv-help__label">{s.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mdv-help__section">
          <h3 className="mdv-help__h">İpuçları</h3>
          <ul className="mdv-help__tips">
            {TIPS.map((tip) => (
              <li key={tip}>{shortcutLabel(tip)}</li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="mdv-help__footer">
        <span>marknote · açık kaynak · MIT · github.com/palamut62/marknote</span>
        {onReplayTutorial ? (
          <button
            type="button"
            className="mdv-help__replay"
            onClick={() => {
              onClose();
              onReplayTutorial();
            }}
          >
            <Sparkles size={11} strokeWidth={1.75} />
            Turu tekrar oynat
          </button>
        ) : null}
      </footer>
    </Overlay>
  );
}
