import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Palette, Pencil, RefreshCw, Settings, ShieldCheck, Sparkles, Cpu, Wrench, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { OWNER_GITHUB_URL, OWNER_NAME, OWNER_X_URL } from "./about-overlay";
import { Button, Icon, Overlay } from "@/components/primitives";
import {
  getAutostartEnabled,
  DEFAULT_PROOFREAD_PROMPT,
  DEFAULT_PROMPTIFY_PROMPT,
  DEFAULT_TRANSLATE_PROMPT,
  LANGUAGES,
  listOpenRouterModels,
  setAutostartEnabled,
  setThemeMode,
  setTransparency,
  useThemeMode,
  useTransparency,
  type OpenRouterModel,
  type Theme,
  type ThemeMode,
} from "@/lib";

type SettingsOverlayProps = {
  open: boolean;
  onClose: () => void;
  vimOn: boolean;
  onVimToggle: (next: boolean) => void;
  techCounters: boolean;
  onTechCountersChange: (next: boolean) => void;
  remoteImages: boolean;
  onRemoteImagesChange: (next: boolean) => void;
  onShowAbout: () => void;
  onShowDeveloperTools: () => void;
  openrouterKey: string;
  onOpenrouterKeyChange: (next: string) => void;
  openrouterModel: string;
  onOpenrouterModelChange: (next: string) => void;
  translateTargetLang: string;
  onTranslateTargetLangChange: (next: string) => void;
  proofreadPrompt: string;
  onProofreadPromptChange: (next: string) => void;
  promptifyPrompt: string;
  onPromptifyPromptChange: (next: string) => void;
  translatePrompt: string;
  onTranslatePromptChange: (next: string) => void;
  editorTextColor: string;
  onEditorTextColorChange: (next: string) => void;
  editorHighlightColor: string;
  onEditorHighlightColorChange: (next: string) => void;
  secretHiddenColor: string;
  onSecretHiddenColorChange: (next: string) => void;
  secretHiddenBg: string;
  onSecretHiddenBgChange: (next: string) => void;
  secretRevealedColor: string;
  onSecretRevealedColorChange: (next: string) => void;
  secretRevealedBg: string;
  onSecretRevealedBgChange: (next: string) => void;
  onCheckForUpdates?: () => void;
  updateChecking?: boolean;
  dockMode?: "off" | "left" | "right";
  onDockModeChange?: (next: "off" | "left" | "right") => void;
};

type TabId = "appearance" | "editor" | "ai" | "privacy" | "advanced" | "system";

const TABS: ReadonlyArray<{ id: TabId; label: string; icon: typeof Palette }> = [
  { id: "appearance", label: "Görünüm", icon: Palette },
  { id: "editor", label: "Editör", icon: Pencil },
  { id: "ai", label: "Yapay zeka", icon: Sparkles },
  { id: "privacy", label: "Gizlilik", icon: ShieldCheck },
  { id: "advanced", label: "Gelişmiş", icon: Wrench },
  { id: "system", label: "Sistem", icon: Cpu },
];

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: "system", label: "Sistem" },
  { value: "sade", label: "Sade (açık)" },
  { value: "gece", label: "Gece (koyu)" },
  { value: "latte", label: "latte" },
  { value: "frappe", label: "frappé" },
  { value: "macchiato", label: "macchiato" },
  { value: "mocha", label: "mocha" },
  { value: "matcha", label: "matcha" },
  { value: "kanagawa", label: "kanagawa" },
  { value: "rose-pine", label: "rosé pine" },
  { value: "ayu", label: "ayu" },
];

export function SettingsOverlay({
  open,
  onClose,
  vimOn,
  onVimToggle,
  techCounters,
  onTechCountersChange,
  remoteImages,
  onRemoteImagesChange,
  onShowAbout,
  onShowDeveloperTools,
  openrouterKey,
  onOpenrouterKeyChange,
  openrouterModel,
  onOpenrouterModelChange,
  translateTargetLang,
  onTranslateTargetLangChange,
  proofreadPrompt,
  onProofreadPromptChange,
  promptifyPrompt,
  onPromptifyPromptChange,
  translatePrompt,
  onTranslatePromptChange,
  editorTextColor,
  onEditorTextColorChange,
  editorHighlightColor,
  onEditorHighlightColorChange,
  secretHiddenColor,
  onSecretHiddenColorChange,
  secretHiddenBg,
  onSecretHiddenBgChange,
  secretRevealedColor,
  onSecretRevealedColorChange,
  secretRevealedBg,
  onSecretRevealedBgChange,
  onCheckForUpdates,
  updateChecking = false,
  dockMode = "off",
  onDockModeChange,
}: SettingsOverlayProps) {
  const { mode } = useThemeMode();
  const { opacity } = useTransparency();
  const [activeTab, setActiveTab] = useState<TabId>("appearance");

  // autostart — async OS round-trip, so we mirror the live state locally
  const [autostartOn, setAutostartOn] = useState<boolean>(false);
  const [autostartBusy, setAutostartBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getAutostartEnabled().then((v) => {
      if (!cancelled) setAutostartOn(v);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const toggleAutostart = useCallback(async () => {
    if (autostartBusy) return;
    setAutostartBusy(true);
    try {
      const next = await setAutostartEnabled(!autostartOn);
      setAutostartOn(next);
    } catch {
      // error already logged in lib/autostart
    } finally {
      setAutostartBusy(false);
    }
  }, [autostartBusy, autostartOn]);

  // models loader — only on demand, since the list is ~300 items
  const [models, setModels] = useState<OpenRouterModel[] | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);

  const fetchModels = useCallback(async () => {
    if (!openrouterKey) {
      setModelsError("Önce bir API anahtarı gir");
      return;
    }
    setModelsLoading(true);
    setModelsError(null);
    try {
      const list = await listOpenRouterModels(openrouterKey);
      setModels(list);
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : String(err));
    } finally {
      setModelsLoading(false);
    }
  }, [openrouterKey]);

  return (
    <Overlay open={open} onClose={onClose} ariaLabel="Ayarlar" variant="modal">
      <header className="mdv-help__header">
        <div className="mdv-help__title">
          <span className="mdv-settings__icon" aria-hidden>
            <Icon icon={Settings} size={20} strokeWidth={1.5} />
          </span>
          <div className="mdv-help__title-text">
            <span className="mdv-help__brand">Ayarlar</span>
            <span className="mdv-help__subtitle">Marknote'u zevkine göre ayarla</span>
          </div>
        </div>
        <Button
          title="Kapat (Esc)"
          aria-label="Kapat"
          onClick={onClose}
          icon={<Icon icon={X} size={14} strokeWidth={1.5} />}
        />
      </header>

      <nav className="mdv-settings__tabs" role="tablist" aria-label="Ayar kategorileri">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            className={`mdv-settings__tab${activeTab === t.id ? " is-active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            <Icon icon={t.icon} size={13} strokeWidth={1.6} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="mdv-help__body">
        {activeTab === "appearance" && (
          <section className="mdv-help__section">
            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>Tema</span>
                <span className="mdv-settings__hint">Uygulamanın renk düzeni</span>
              </div>
              <div className="mdv-settings__control">
                <select
                  className="mdv-settings__select"
                  value={mode}
                  onChange={(e) => setThemeMode(e.target.value as ThemeMode | Theme)}
                >
                  {THEME_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>Pencere saydamlığı</span>
                <span className="mdv-settings__hint">
                  {opacity >= 100 ? "kapalı" : `%${opacity} opak`}
                </span>
              </div>
              <div className="mdv-settings__control">
                <input
                  type="range"
                  min={40}
                  max={100}
                  step={1}
                  value={opacity}
                  onChange={(e) => setTransparency(Number(e.target.value))}
                  className="mdv-settings__slider"
                  aria-label="Pencere saydamlığı"
                />
              </div>
            </div>
          </section>
        )}

        {activeTab === "editor" && (
          <section className="mdv-help__section">
            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>Seçili metin rengi</span>
                <span className="mdv-settings__hint">Araç çubuğundaki metin rengi düğmesi kullanır</span>
              </div>
              <div className="mdv-settings__control mdv-settings__control--color">
                <input
                  type="color"
                  className="mdv-settings__color"
                  value={editorTextColor}
                  onChange={(e) => onEditorTextColorChange(e.target.value)}
                  aria-label="Seçili metin rengi"
                />
                <span className="mdv-settings__color-value">{editorTextColor}</span>
              </div>
            </div>

            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>Seçili vurgu rengi</span>
                <span className="mdv-settings__hint">Araç çubuğundaki vurgu düğmesi kullanır</span>
              </div>
              <div className="mdv-settings__control mdv-settings__control--color">
                <input
                  type="color"
                  className="mdv-settings__color"
                  value={editorHighlightColor}
                  onChange={(e) => onEditorHighlightColorChange(e.target.value)}
                  aria-label="Seçili vurgu rengi"
                />
                <span className="mdv-settings__color-value">{editorHighlightColor}</span>
              </div>
            </div>

            <div className="mdv-settings__row mdv-settings__row--stack">
              <div className="mdv-settings__label">
                <span>Gizli anahtar renkleri</span>
                <span className="mdv-settings__hint">Maskelenmiş API anahtarları / tokenlar için editör ve önizleme renkleri</span>
              </div>
              <div className="mdv-settings__color-grid">
                <label className="mdv-settings__color-field">
                  <span>Gizli metin</span>
                  <input
                    type="color"
                    className="mdv-settings__color"
                    value={secretHiddenColor}
                    onChange={(e) => onSecretHiddenColorChange(e.target.value)}
                  />
                </label>
                <label className="mdv-settings__color-field">
                  <span>Gizli arka plan</span>
                  <input
                    type="color"
                    className="mdv-settings__color"
                    value={secretHiddenBg}
                    onChange={(e) => onSecretHiddenBgChange(e.target.value)}
                  />
                </label>
                <label className="mdv-settings__color-field">
                  <span>Görünen metin</span>
                  <input
                    type="color"
                    className="mdv-settings__color"
                    value={secretRevealedColor}
                    onChange={(e) => onSecretRevealedColorChange(e.target.value)}
                  />
                </label>
                <label className="mdv-settings__color-field">
                  <span>Görünen arka plan</span>
                  <input
                    type="color"
                    className="mdv-settings__color"
                    value={secretRevealedBg}
                    onChange={(e) => onSecretRevealedBgChange(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </section>
        )}

        {activeTab === "ai" && (
          <section className="mdv-help__section">
            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>OpenRouter API anahtarı</span>
                <span className="mdv-settings__hint">İşletim sistemi kimlik kasasında saklanır · yalnızca openrouter.ai'ye gönderilir</span>
              </div>
              <div className="mdv-settings__control mdv-settings__control--key">
                <input
                  type={keyVisible ? "text" : "password"}
                  className="mdv-settings__input"
                  value={openrouterKey}
                  placeholder="sk-or-…"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  onChange={(e) => onOpenrouterKeyChange(e.target.value)}
                />
                <button
                  type="button"
                  className="mdv-settings__icon-btn"
                  aria-label={keyVisible ? "Anahtarı gizle" : "Anahtarı göster"}
                  onClick={() => setKeyVisible((v) => !v)}
                >
                  <Icon icon={keyVisible ? EyeOff : Eye} size={12} strokeWidth={1.6} />
                </button>
              </div>
            </div>

            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>Model</span>
                <span className="mdv-settings__hint">
                  {modelsError
                    ? modelsError
                    : models
                      ? `${models.length} model · birini seç`
                      : "Güncel listeyi OpenRouter'dan getir"}
                </span>
              </div>
              <div className="mdv-settings__control mdv-settings__control--model">
                <select
                  className="mdv-settings__select"
                  value={openrouterModel}
                  onChange={(e) => onOpenrouterModelChange(e.target.value)}
                  disabled={!models}
                >
                  {models ? (
                    <>
                      <option value="">- seç -</option>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {m.priceLabel ? ` · ${m.priceLabel}` : ""}
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value={openrouterModel}>
                      {openrouterModel || "- önce modelleri getir -"}
                    </option>
                  )}
                </select>
                <button
                  type="button"
                  className="mdv-settings__btn"
                  disabled={modelsLoading || !openrouterKey}
                  onClick={fetchModels}
                >
                  <Icon icon={RefreshCw} size={12} strokeWidth={1.6} />
                  {modelsLoading ? "Yükleniyor…" : models ? "Yenile" : "Getir"}
                </button>
              </div>
            </div>

            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>Hedef dil</span>
                <span className="mdv-settings__hint">
                  Çeviri simgesine tıklayınca önizleme bu dile çevrilir
                </span>
              </div>
              <div className="mdv-settings__control">
                <select
                  className="mdv-settings__select"
                  value={translateTargetLang}
                  onChange={(e) => onTranslateTargetLangChange(e.target.value)}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mdv-settings__row mdv-settings__row--stack">
              <div className="mdv-settings__label">
                <span>Yazım denetimi talimatı</span>
                <span className="mdv-settings__hint">Yazım ve dil bilgisi düğmesi kullanır</span>
              </div>
              <div className="mdv-settings__prompt">
                <textarea
                  className="mdv-settings__textarea"
                  value={proofreadPrompt}
                  spellCheck={false}
                  onChange={(e) => onProofreadPromptChange(e.target.value)}
                />
                <button
                  type="button"
                  className="mdv-settings__btn"
                  onClick={() => onProofreadPromptChange(DEFAULT_PROOFREAD_PROMPT)}
                >
                  Sıfırla
                </button>
              </div>
            </div>

            <div className="mdv-settings__row mdv-settings__row--stack">
              <div className="mdv-settings__label">
                <span>Prompt talimatı</span>
                <span className="mdv-settings__hint">"Prompt'a çevir" düğmesi kullanır</span>
              </div>
              <div className="mdv-settings__prompt">
                <textarea
                  className="mdv-settings__textarea"
                  value={promptifyPrompt}
                  spellCheck={false}
                  onChange={(e) => onPromptifyPromptChange(e.target.value)}
                />
                <button
                  type="button"
                  className="mdv-settings__btn"
                  onClick={() => onPromptifyPromptChange(DEFAULT_PROMPTIFY_PROMPT)}
                >
                  Sıfırla
                </button>
              </div>
            </div>

            <div className="mdv-settings__row mdv-settings__row--stack">
              <div className="mdv-settings__label">
                <span>Çeviri talimatı</span>
                <span className="mdv-settings__hint">
                  Çeviri sırasında hedef dil otomatik eklenir
                </span>
              </div>
              <div className="mdv-settings__prompt">
                <textarea
                  className="mdv-settings__textarea"
                  value={translatePrompt}
                  spellCheck={false}
                  onChange={(e) => onTranslatePromptChange(e.target.value)}
                />
                <button
                  type="button"
                  className="mdv-settings__btn"
                  onClick={() => onTranslatePromptChange(DEFAULT_TRANSLATE_PROMPT)}
                >
                  Sıfırla
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === "privacy" && (
          <section className="mdv-help__section">
            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>İnternetteki görselleri yükle</span>
                <span className="mdv-settings__hint">
                  Açıkken, notta internetten bir görsel varsa not açıldığında o sunucuya istek gider. Kapalıyken yalnız yerel görseller gösterilir. Değişiklik not yeniden açılınca uygulanır.
                </span>
              </div>
              <div className="mdv-settings__control">
                <button
                  type="button"
                  role="switch"
                  aria-label="İnternetteki görselleri yükle"
                  aria-checked={remoteImages}
                  className={`mdv-settings__switch${remoteImages ? " is-on" : ""}`}
                  onClick={() => onRemoteImagesChange(!remoteImages)}
                >
                  <span className="mdv-settings__switch-thumb" aria-hidden />
                </button>
              </div>
            </div>
            <div className="mdv-settings__row mdv-settings__row--text">
              <div className="mdv-settings__label">
                <span>Verileriniz nerede?</span>
                <span className="mdv-settings__hint">
                  Notlar yalnız seçtiğiniz klasördeki dosyalardır; marknote hesap veya bulut kullanmaz. Kaydedilmemiş taslak (kurtarma), sürüm geçmişi ve çöp kutusu bu bilgisayarda uygulama verisi klasöründe tutulur ve şifrelenmez. Sürüm geçmişi not başına 20 sürümle sınırlıdır; çöp kutusu siz boşaltana kadar durur. OpenRouter API anahtarı işletim sisteminin anahtar kasasında saklanır; bu, not yedeklerinin şifrelendiği anlamına gelmez. Yapay zeka özellikleri yalnız siz başlattığınızda, seçili metni OpenRouter'a gönderir.
                </span>
              </div>
            </div>
          </section>
        )}

        {activeTab === "advanced" && (
          <section className="mdv-help__section">
            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>Vim modu</span>
                <span className="mdv-settings__hint">Kipli düzenleme - normal/ekleme/görsel/değiştirme</span>
              </div>
              <div className="mdv-settings__control">
                <button
                  type="button"
                  role="switch"
                  aria-checked={vimOn}
                  className={`mdv-settings__switch${vimOn ? " is-on" : ""}`}
                  onClick={() => onVimToggle(!vimOn)}
                >
                  <span className="mdv-settings__switch-thumb" aria-hidden />
                </button>
              </div>
            </div>

            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>Teknik sayaçlar</span>
                <span className="mdv-settings__hint">Durum çubuğunda yaklaşık token sayısını göster</span>
              </div>
              <div className="mdv-settings__control">
                <button
                  type="button"
                  role="switch"
                  aria-label="Teknik sayaçlar"
                  aria-checked={techCounters}
                  className={`mdv-settings__switch${techCounters ? " is-on" : ""}`}
                  onClick={() => onTechCountersChange(!techCounters)}
                >
                  <span className="mdv-settings__switch-thumb" aria-hidden />
                </button>
              </div>
            </div>
            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>Geliştirici araçları</span>
                <span className="mdv-settings__hint">Frontmatter, bağlantı denetimi, geri bağlantılar, Git diff, özel dönüşümler, dışa aktarma profilleri</span>
              </div>
              <div className="mdv-settings__control">
                <button type="button" className="mdv-btn mdv-btn--quiet" onClick={onShowDeveloperTools}>Aç</button>
              </div>
            </div>
          </section>
        )}

        {activeTab === "system" && (
          <section className="mdv-help__section">
            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>Sistemle birlikte başlat</span>
                <span className="mdv-settings__hint">
                  Oturum açtığında Marknote otomatik başlasın
                </span>
              </div>
              <div className="mdv-settings__control">
                <button
                  type="button"
                  role="switch"
                  aria-checked={autostartOn}
                  className={`mdv-settings__switch${autostartOn ? " is-on" : ""}`}
                  onClick={toggleAutostart}
                  disabled={autostartBusy}
                >
                  <span className="mdv-settings__switch-thumb" aria-hidden />
                </button>
              </div>
            </div>

            {onDockModeChange ? (
              <div className="mdv-settings__row">
                <div className="mdv-settings__label">
                  <span>Kenar yuvası</span>
                  <span className="mdv-settings__hint">
                    Marknote'u ekran kenarına ince bir sekme olarak sabitle · tıklayınca açılır (~%70 genişlik)
                  </span>
                </div>
                <div className="mdv-settings__control">
                  <select
                    className="mdv-settings__select"
                    value={dockMode}
                    onChange={(e) => onDockModeChange(e.target.value as "off" | "left" | "right")}
                  >
                    <option value="off">Kapalı</option>
                    <option value="left">Sol kenar</option>
                    <option value="right">Sağ kenar</option>
                  </select>
                </div>
              </div>
            ) : null}

            {onCheckForUpdates ? (
              <div className="mdv-settings__row">
                <div className="mdv-settings__label">
                  <span>Güncellemeleri denetle</span>
                  <span className="mdv-settings__hint">En son sürümü kullandığını doğrula</span>
                </div>
                <div className="mdv-settings__control">
                  <button
                    type="button"
                    className="mdv-settings__btn"
                    disabled={updateChecking}
                    onClick={onCheckForUpdates}
                  >
                    <Icon icon={RefreshCw} size={12} strokeWidth={1.6} />
                    {updateChecking ? "Denetleniyor…" : "Şimdi denetle"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </div>

      <footer className="mdv-help__footer mdv-settings__owner">
        <span>Ürün sahibi: {OWNER_NAME}</span>
        <a href={OWNER_X_URL} onClick={(e) => { e.preventDefault(); void openUrl(OWNER_X_URL); }}>X: @palamut62</a>
        <a href={OWNER_GITHUB_URL} onClick={(e) => { e.preventDefault(); void openUrl(OWNER_GITHUB_URL); }}>GitHub: palamut62</a>
        <button type="button" className="mdv-btn mdv-btn--quiet" onClick={onShowAbout}>Hakkında</button>
      </footer>
    </Overlay>
  );
}
