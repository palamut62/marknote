import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Code2, GitCompare, Link2, Search, Wand2, X } from "lucide-react";
import { Button, Icon, Overlay } from "@/components/primitives";
import { usePersistedState } from "@/hooks";
import {
  applyTextTransform,
  basename,
  dirname,
  extractDocumentLinks,
  fixMarkdownLint,
  joinPath,
  pathExists,
  parseFrontmatter,
  upsertFrontmatterField,
  STORAGE_KEYS,
  type ExportProfile,
} from "@/lib";
import { buildNoteIndex, searchNotes } from "@/lib/notes-index";

type SearchResult = { path: string; rel: string; line: number; excerpt: string; match?: string };
type SavedTransform = { id: string; name: string; find: string; replacement: string };

type DeveloperToolsOverlayProps = {
  open: boolean;
  rootPath: string | null;
  activePath: string | null;
  source: string;
  onChange: (source: string) => void;
  /** open a note; `match` is revealed in the editor when given */
  onOpenFile: (path: string, match?: string) => void;
  exportProfile: ExportProfile;
  onExportProfileChange: (profile: ExportProfile) => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onClose: () => void;
};

export function DeveloperToolsOverlay({
  open,
  rootPath,
  activePath,
  source,
  onChange,
  onOpenFile,
  exportProfile,
  onExportProfileChange,
  onExportHtml,
  onExportPdf,
  onClose,
}: DeveloperToolsOverlayProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [gitDiff, setGitDiff] = useState("");
  const [find, setFind] = useState("");
  const [replacement, setReplacement] = useState("");
  const [transformName, setTransformName] = useState("");
  const [savedTransforms, setSavedTransforms] = usePersistedState<SavedTransform[]>(STORAGE_KEYS.customTransforms, []);
  const [fieldKey, setFieldKey] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [brokenLinks, setBrokenLinks] = useState<Array<{ target: string; line: number }>>([]);
  const [backlinks, setBacklinks] = useState<SearchResult[]>([]);
  const frontmatter = useMemo(() => parseFrontmatter(source), [source]);
  const links = useMemo(() => extractDocumentLinks(source), [source]);

  const searchAbortRef = useRef<AbortController | null>(null);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  useEffect(() => () => searchAbortRef.current?.abort(), []);

  const cancelSearch = () => {
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    setBusy(false);
    setSearchNotice("arama iptal edildi");
  };

  // one unreadable file or a huge folder must never leave `busy` stuck (F07)
  const searchWorkspace = async (needle = query, backlink = false) => {
    if (!rootPath || !needle.trim()) return;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setBusy(true);
    setSearchNotice(null);
    try {
      const index = await buildNoteIndex(rootPath, controller.signal);
      const found = searchNotes(index.notes, needle, { maxHits: 200, perNote: 50 });
      const matches: SearchResult[] = found.hits
        .filter((hit) => hit.kind === "content" && hit.line != null)
        .map((hit) => ({ path: hit.path, rel: hit.rel, line: hit.line ?? 0, excerpt: hit.excerpt, match: hit.match }));
      const notes: string[] = [];
      if (found.limited) notes.push("ilk 200 sonuç gösteriliyor");
      if (index.truncatedFiles) notes.push("klasördeki ilk 5000 dosya arandı");
      if (found.skippedLarge) notes.push(`${found.skippedLarge} büyük dosya aranmadı`);
      if (index.problems.length) notes.push(`${index.problems.length} dosya okunamadı`);
      setSearchNotice(notes.length ? notes.join(" · ") : null);
      if (backlink) setBacklinks(matches.filter((item) => item.path !== activePath));
      else setResults(matches);
    } catch (err) {
      if (!controller.signal.aborted) setSearchNotice(`arama başarısız - ${String(err)} · tekrar deneyin`);
    } finally {
      if (searchAbortRef.current === controller) {
        searchAbortRef.current = null;
        setBusy(false);
      }
    }
  };

  const loadGitDiff = async () => {
    if (!rootPath) return;
    setBusy(true);
    try {
      setGitDiff((await invoke<string>("git_diff", { root: rootPath })) || "Çalışma ağacı temiz");
    } catch (err) {
      setGitDiff(`git diff kullanılamıyor - ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const validateLocalLinks = async () => {
    if (!activePath) return;
    setBusy(true);
    const broken: Array<{ target: string; line: number }> = [];
    try {
      for (const link of links.filter((item) => !item.external && !item.target.startsWith("#"))) {
        let cleanTarget: string;
        try {
          cleanTarget = decodeURIComponent(link.target.split("#")[0]);
        } catch {
          // malformed percent-encoding is itself a broken link, not a crash (F07)
          broken.push({ target: `${link.target} (hatalı kodlama)`, line: link.line });
          continue;
        }
        const target = joinPath(dirname(activePath), cleanTarget);
        if (!(await pathExists(target))) broken.push({ target: link.target, line: link.line });
      }
    } finally {
      setBrokenLinks(broken);
      setBusy(false);
    }
  };

  const saveTransform = () => {
    if (!transformName.trim() || !find) return;
    const item = { id: crypto.randomUUID(), name: transformName.trim(), find, replacement };
    setSavedTransforms((items) => [item, ...items].slice(0, 20));
    setTransformName("");
  };

  return (
    <Overlay open={open} onClose={onClose} ariaLabel="Geliştirici araçları" variant="wide">
      <header className="mdv-help__header">
        <div className="mdv-help__title-text">
          <span className="mdv-help__brand">Geliştirici araçları</span>
          <span className="mdv-help__subtitle">Arama, üst veri, bağlantılar, git ve tekrarlanabilir metin dönüşümleri</span>
        </div>
        <Button aria-label="Kapat" title="Kapat" onClick={onClose} icon={<Icon icon={X} size={14} />} />
      </header>
      <div className="mdv-devtools">
        <section className="mdv-devtools__section">
          <h2><Icon icon={Search} size={14} /> Çalışma alanında ara</h2>
          <div className="mdv-devtools__row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tüm düzenlenebilir dosyalarda ara" onKeyDown={(event) => { if (event.key === "Enter") void searchWorkspace(); }} />
            {busy ? (
              <button type="button" onClick={cancelSearch}>iptal</button>
            ) : (
              <button type="button" onClick={() => void searchWorkspace()} disabled={!rootPath}>ara</button>
            )}
          </div>
          {searchNotice ? <p role="status">{searchNotice}</p> : null}
          <div className="mdv-devtools__results">
            {results.map((item) => <button type="button" key={`${item.path}:${item.line}`} onClick={() => onOpenFile(item.path, item.match)}><strong>{item.rel}:{item.line}</strong><span>{item.excerpt}</span></button>)}
          </div>
        </section>

        <section className="mdv-devtools__section">
          <h2><Icon icon={Code2} size={14} /> Frontmatter ve bağlantılar</h2>
          <button type="button" onClick={() => onChange(fixMarkdownLint(source))}>Markdown lint hatalarını otomatik düzelt</button>
          <p>{frontmatter.present ? (frontmatter.valid ? `${frontmatter.fields.length} frontmatter alanı` : frontmatter.error) : "Frontmatter bloğu yok"}</p>
          <p>Bu belgede {links.length} bağlantı var ({links.filter((link) => !link.external).length} yerel)</p>
          <div className="mdv-devtools__chips">{frontmatter.fields.map((field) => <span key={field.key}>{field.key}: {field.value}</span>)}</div>
          <div className="mdv-devtools__row"><input value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} placeholder="Frontmatter anahtarı" /><input value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} placeholder="Değer" /><button type="button" disabled={!fieldKey} onClick={() => onChange(upsertFrontmatterField(source, fieldKey, fieldValue))}>Ayarla</button></div>
          <button type="button" disabled={!activePath || busy} onClick={() => void validateLocalLinks()}><Icon icon={Link2} size={13} /> Yerel bağlantıları doğrula</button>
          <p>{brokenLinks.length ? `${brokenLinks.length} kırık yerel bağlantı` : "Kırık yerel bağlantı bulunamadı"}</p>
          <div className="mdv-devtools__chips">{brokenLinks.map((link) => <span key={`${link.target}:${link.line}`}>satır {link.line}: {link.target}</span>)}</div>
          <button type="button" disabled={!rootPath || !activePath || busy} onClick={() => void searchWorkspace(activePath ? basename(activePath) : "", true)}><Icon icon={Link2} size={13} /> Geri bağlantıları bul</button>
          <div className="mdv-devtools__results">{backlinks.map((item) => <button type="button" key={`${item.path}:${item.line}`} onClick={() => onOpenFile(item.path)}><strong>{item.rel}:{item.line}</strong><span>{item.excerpt}</span></button>)}</div>
        </section>

        <section className="mdv-devtools__section">
          <h2><Icon icon={GitCompare} size={14} /> git diff</h2>
          <button type="button" disabled={!rootPath || busy} onClick={() => void loadGitDiff()}>Diff'i yenile</button>
          <pre className="mdv-devtools__diff">{gitDiff || "Bir çalışma alanı seç ve yenile"}</pre>
        </section>

        <section className="mdv-devtools__section">
          <h2><Icon icon={Wand2} size={14} /> Özel dönüşüm</h2>
          <div className="mdv-devtools__row"><input value={find} onChange={(event) => setFind(event.target.value)} placeholder="Aranacak düz metin" /><input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder="Yerine gelecek metin" /><button type="button" disabled={!find} onClick={() => onChange(applyTextTransform(source, find, replacement))}>Uygula</button></div>
          <div className="mdv-devtools__row"><input value={transformName} onChange={(event) => setTransformName(event.target.value)} placeholder="Komut adı" /><button type="button" disabled={!transformName.trim() || !find} onClick={saveTransform}>Komutu kaydet</button></div>
          <div className="mdv-devtools__results">{savedTransforms.map((item) => <button type="button" key={item.id} onClick={() => onChange(applyTextTransform(source, item.find, item.replacement))}><strong>{item.name}</strong><span>{item.find} → {item.replacement}</span></button>)}</div>
        </section>

        <section className="mdv-devtools__section">
          <h2>Dışa aktarma profilleri</h2>
          <div className="mdv-devtools__row">
            <select value={exportProfile} onChange={(event) => onExportProfileChange(event.target.value as ExportProfile)}><option value="compact">Sıkı</option><option value="standard">Standart</option><option value="spacious">Ferah</option></select>
            <button type="button" onClick={onExportHtml}>HTML olarak dışa aktar</button>
            <button type="button" onClick={onExportPdf}>PDF olarak dışa aktar</button>
          </div>
        </section>
      </div>
    </Overlay>
  );
}
