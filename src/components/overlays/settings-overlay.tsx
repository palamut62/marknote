import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Palette, Pencil, RefreshCw, Settings, Sparkles, Cpu, X } from "lucide-react";
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

type TabId = "appearance" | "editor" | "ai" | "system";

const TABS: ReadonlyArray<{ id: TabId; label: string; icon: typeof Palette }> = [
  { id: "appearance", label: "appearance", icon: Palette },
  { id: "editor", label: "editor", icon: Pencil },
  { id: "ai", label: "ai", icon: Sparkles },
  { id: "system", label: "system", icon: Cpu },
];

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: "system", label: "system" },
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
      setModelsError("enter an api key first");
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
    <Overlay open={open} onClose={onClose} ariaLabel="settings" variant="modal">
      <header className="mdv-help__header">
        <div className="mdv-help__title">
          <span className="mdv-settings__icon" aria-hidden>
            <Icon icon={Settings} size={20} strokeWidth={1.5} />
          </span>
          <div className="mdv-help__title-text">
            <span className="mdv-help__brand">settings</span>
            <span className="mdv-help__subtitle">configure marknote to your taste</span>
          </div>
        </div>
        <Button
          title="close (esc)"
          aria-label="close"
          onClick={onClose}
          icon={<Icon icon={X} size={14} strokeWidth={1.5} />}
        />
      </header>

      <nav className="mdv-settings__tabs" role="tablist" aria-label="settings categories">
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
                <span>theme</span>
                <span className="mdv-settings__hint">color scheme used across the app</span>
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
                <span>window transparency</span>
                <span className="mdv-settings__hint">
                  {opacity >= 100 ? "off" : `${opacity}% opaque`}
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
                  aria-label="window transparency"
                />
              </div>
            </div>
          </section>
        )}

        {activeTab === "editor" && (
          <section className="mdv-help__section">
            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>vim mode</span>
                <span className="mdv-settings__hint">modal editing — normal/insert/visual/replace</span>
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
                <span>selected text color</span>
                <span className="mdv-settings__hint">used by the toolbar text-color button</span>
              </div>
              <div className="mdv-settings__control mdv-settings__control--color">
                <input
                  type="color"
                  className="mdv-settings__color"
                  value={editorTextColor}
                  onChange={(e) => onEditorTextColorChange(e.target.value)}
                  aria-label="selected text color"
                />
                <span className="mdv-settings__color-value">{editorTextColor}</span>
              </div>
            </div>

            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>selected highlight color</span>
                <span className="mdv-settings__hint">used by the toolbar highlight button</span>
              </div>
              <div className="mdv-settings__control mdv-settings__control--color">
                <input
                  type="color"
                  className="mdv-settings__color"
                  value={editorHighlightColor}
                  onChange={(e) => onEditorHighlightColorChange(e.target.value)}
                  aria-label="selected highlight color"
                />
                <span className="mdv-settings__color-value">{editorHighlightColor}</span>
              </div>
            </div>

            <div className="mdv-settings__row mdv-settings__row--stack">
              <div className="mdv-settings__label">
                <span>hidden key colors</span>
                <span className="mdv-settings__hint">editor and preview colors for masked api keys / tokens</span>
              </div>
              <div className="mdv-settings__color-grid">
                <label className="mdv-settings__color-field">
                  <span>hidden text</span>
                  <input
                    type="color"
                    className="mdv-settings__color"
                    value={secretHiddenColor}
                    onChange={(e) => onSecretHiddenColorChange(e.target.value)}
                  />
                </label>
                <label className="mdv-settings__color-field">
                  <span>hidden bg</span>
                  <input
                    type="color"
                    className="mdv-settings__color"
                    value={secretHiddenBg}
                    onChange={(e) => onSecretHiddenBgChange(e.target.value)}
                  />
                </label>
                <label className="mdv-settings__color-field">
                  <span>revealed text</span>
                  <input
                    type="color"
                    className="mdv-settings__color"
                    value={secretRevealedColor}
                    onChange={(e) => onSecretRevealedColorChange(e.target.value)}
                  />
                </label>
                <label className="mdv-settings__color-field">
                  <span>revealed bg</span>
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
                <span>openrouter api key</span>
                <span className="mdv-settings__hint">stored locally · never sent anywhere except openrouter.ai</span>
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
                  aria-label={keyVisible ? "hide key" : "show key"}
                  onClick={() => setKeyVisible((v) => !v)}
                >
                  <Icon icon={keyVisible ? EyeOff : Eye} size={12} strokeWidth={1.6} />
                </button>
              </div>
            </div>

            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>model</span>
                <span className="mdv-settings__hint">
                  {modelsError
                    ? modelsError
                    : models
                      ? `${models.length} models · pick one`
                      : "fetch the live list from openrouter"}
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
                      <option value="">— select —</option>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {m.priceLabel ? ` · ${m.priceLabel}` : ""}
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value={openrouterModel}>
                      {openrouterModel || "— fetch models first —"}
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
                  {modelsLoading ? "loading…" : models ? "refresh" : "fetch"}
                </button>
              </div>
            </div>

            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>target language</span>
                <span className="mdv-settings__hint">
                  preview will be translated into this language when you click the translate icon
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
                <span>proofread instruction</span>
                <span className="mdv-settings__hint">used by the spelling and grammar button</span>
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
                  reset
                </button>
              </div>
            </div>

            <div className="mdv-settings__row mdv-settings__row--stack">
              <div className="mdv-settings__label">
                <span>prompt instruction</span>
                <span className="mdv-settings__hint">used by the turn-into-prompt button</span>
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
                  reset
                </button>
              </div>
            </div>

            <div className="mdv-settings__row mdv-settings__row--stack">
              <div className="mdv-settings__label">
                <span>translate instruction</span>
                <span className="mdv-settings__hint">
                  target language is appended automatically when translating
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
                  reset
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === "system" && (
          <section className="mdv-help__section">
            <div className="mdv-settings__row">
              <div className="mdv-settings__label">
                <span>start with system</span>
                <span className="mdv-settings__hint">
                  launch marknote automatically when you sign in
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
                  <span>edge dock</span>
                  <span className="mdv-settings__hint">
                    pin marknote to a screen edge as a thin tab · click to slide open (~70% width)
                  </span>
                </div>
                <div className="mdv-settings__control">
                  <select
                    className="mdv-settings__select"
                    value={dockMode}
                    onChange={(e) => onDockModeChange(e.target.value as "off" | "left" | "right")}
                  >
                    <option value="off">off</option>
                    <option value="left">left edge</option>
                    <option value="right">right edge</option>
                  </select>
                </div>
              </div>
            ) : null}

            {onCheckForUpdates ? (
              <div className="mdv-settings__row">
                <div className="mdv-settings__label">
                  <span>check for updates</span>
                  <span className="mdv-settings__hint">verify you're on the latest release</span>
                </div>
                <div className="mdv-settings__control">
                  <button
                    type="button"
                    className="mdv-settings__btn"
                    disabled={updateChecking}
                    onClick={onCheckForUpdates}
                  >
                    <Icon icon={RefreshCw} size={12} strokeWidth={1.6} />
                    {updateChecking ? "checking…" : "check now"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </div>

      <footer className="mdv-help__footer">
        <span>marknote · settings · esc to close</span>
      </footer>
    </Overlay>
  );
}
