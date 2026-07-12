import { useMemo, useState } from "react";
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
  readMarkdown,
  upsertFrontmatterField,
  walkMarkdownFiles,
  STORAGE_KEYS,
  type ExportProfile,
} from "@/lib";

type SearchResult = { path: string; rel: string; line: number; excerpt: string };
type SavedTransform = { id: string; name: string; find: string; replacement: string };

type DeveloperToolsOverlayProps = {
  open: boolean;
  rootPath: string | null;
  activePath: string | null;
  source: string;
  onChange: (source: string) => void;
  onOpenFile: (path: string) => void;
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

  const searchWorkspace = async (needle = query, backlink = false) => {
    if (!rootPath || !needle.trim()) return;
    setBusy(true);
    const matches: SearchResult[] = [];
    for (const file of await walkMarkdownFiles(rootPath)) {
      const content = await readMarkdown(file.path);
      content.split(/\r?\n/).forEach((line, index) => {
        if (matches.length < 200 && line.toLocaleLowerCase().includes(needle.toLocaleLowerCase())) {
          matches.push({ path: file.path, rel: file.rel, line: index + 1, excerpt: line.trim() });
        }
      });
    }
    if (backlink) setBacklinks(matches.filter((item) => item.path !== activePath));
    else setResults(matches);
    setBusy(false);
  };

  const loadGitDiff = async () => {
    if (!rootPath) return;
    setBusy(true);
    try {
      setGitDiff((await invoke<string>("git_diff", { root: rootPath })) || "working tree is clean");
    } catch (err) {
      setGitDiff(`git diff unavailable - ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const validateLocalLinks = async () => {
    if (!activePath) return;
    setBusy(true);
    const broken: Array<{ target: string; line: number }> = [];
    for (const link of links.filter((item) => !item.external && !item.target.startsWith("#"))) {
      const cleanTarget = decodeURIComponent(link.target.split("#")[0]);
      const target = joinPath(dirname(activePath), cleanTarget);
      if (!(await pathExists(target))) broken.push({ target: link.target, line: link.line });
    }
    setBrokenLinks(broken);
    setBusy(false);
  };

  const saveTransform = () => {
    if (!transformName.trim() || !find) return;
    const item = { id: crypto.randomUUID(), name: transformName.trim(), find, replacement };
    setSavedTransforms((items) => [item, ...items].slice(0, 20));
    setTransformName("");
  };

  return (
    <Overlay open={open} onClose={onClose} ariaLabel="developer tools" variant="wide">
      <header className="mdv-help__header">
        <div className="mdv-help__title-text">
          <span className="mdv-help__brand">developer tools</span>
          <span className="mdv-help__subtitle">search, metadata, links, git and repeatable text transforms</span>
        </div>
        <Button aria-label="close" title="close" onClick={onClose} icon={<Icon icon={X} size={14} />} />
      </header>
      <div className="mdv-devtools">
        <section className="mdv-devtools__section">
          <h2><Icon icon={Search} size={14} /> workspace search</h2>
          <div className="mdv-devtools__row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="search all editable files" onKeyDown={(event) => { if (event.key === "Enter") void searchWorkspace(); }} />
            <button type="button" onClick={() => void searchWorkspace()} disabled={!rootPath || busy}>search</button>
          </div>
          <div className="mdv-devtools__results">
            {results.map((item) => <button type="button" key={`${item.path}:${item.line}`} onClick={() => onOpenFile(item.path)}><strong>{item.rel}:{item.line}</strong><span>{item.excerpt}</span></button>)}
          </div>
        </section>

        <section className="mdv-devtools__section">
          <h2><Icon icon={Code2} size={14} /> frontmatter and links</h2>
          <button type="button" onClick={() => onChange(fixMarkdownLint(source))}>auto-fix markdown lint</button>
          <p>{frontmatter.present ? (frontmatter.valid ? `${frontmatter.fields.length} frontmatter fields` : frontmatter.error) : "no frontmatter block"}</p>
          <p>{links.length} links in this document ({links.filter((link) => !link.external).length} local)</p>
          <div className="mdv-devtools__chips">{frontmatter.fields.map((field) => <span key={field.key}>{field.key}: {field.value}</span>)}</div>
          <div className="mdv-devtools__row"><input value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} placeholder="frontmatter key" /><input value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} placeholder="value" /><button type="button" disabled={!fieldKey} onClick={() => onChange(upsertFrontmatterField(source, fieldKey, fieldValue))}>set</button></div>
          <button type="button" disabled={!activePath || busy} onClick={() => void validateLocalLinks()}><Icon icon={Link2} size={13} /> validate local links</button>
          <p>{brokenLinks.length ? `${brokenLinks.length} broken local links` : "no broken local links found"}</p>
          <div className="mdv-devtools__chips">{brokenLinks.map((link) => <span key={`${link.target}:${link.line}`}>line {link.line}: {link.target}</span>)}</div>
          <button type="button" disabled={!rootPath || !activePath || busy} onClick={() => void searchWorkspace(activePath ? basename(activePath) : "", true)}><Icon icon={Link2} size={13} /> find backlinks</button>
          <div className="mdv-devtools__results">{backlinks.map((item) => <button type="button" key={`${item.path}:${item.line}`} onClick={() => onOpenFile(item.path)}><strong>{item.rel}:{item.line}</strong><span>{item.excerpt}</span></button>)}</div>
        </section>

        <section className="mdv-devtools__section">
          <h2><Icon icon={GitCompare} size={14} /> git diff</h2>
          <button type="button" disabled={!rootPath || busy} onClick={() => void loadGitDiff()}>refresh diff</button>
          <pre className="mdv-devtools__diff">{gitDiff || "select a workspace and refresh"}</pre>
        </section>

        <section className="mdv-devtools__section">
          <h2><Icon icon={Wand2} size={14} /> custom transform</h2>
          <div className="mdv-devtools__row"><input value={find} onChange={(event) => setFind(event.target.value)} placeholder="literal text to find" /><input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder="replacement" /><button type="button" disabled={!find} onClick={() => onChange(applyTextTransform(source, find, replacement))}>apply</button></div>
          <div className="mdv-devtools__row"><input value={transformName} onChange={(event) => setTransformName(event.target.value)} placeholder="command name" /><button type="button" disabled={!transformName.trim() || !find} onClick={saveTransform}>save command</button></div>
          <div className="mdv-devtools__results">{savedTransforms.map((item) => <button type="button" key={item.id} onClick={() => onChange(applyTextTransform(source, item.find, item.replacement))}><strong>{item.name}</strong><span>{item.find} → {item.replacement}</span></button>)}</div>
        </section>

        <section className="mdv-devtools__section">
          <h2>export profiles</h2>
          <div className="mdv-devtools__row">
            <select value={exportProfile} onChange={(event) => onExportProfileChange(event.target.value as ExportProfile)}><option value="compact">compact</option><option value="standard">standard</option><option value="spacious">spacious</option></select>
            <button type="button" onClick={onExportHtml}>export html</button>
            <button type="button" onClick={onExportPdf}>export pdf</button>
          </div>
        </section>
      </div>
    </Overlay>
  );
}
