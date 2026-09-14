import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, FileText, Folder, List, LoaderCircle, Moon, PanelLeft, Search, Sun, Type, X, AlertCircle, RefreshCw, PanelRightClose } from 'lucide-react';
import haliteIcon from '../desktop/icon.svg';
import type { Bootstrap, DocFile, DocumentData, Heading, Preferences, ReadingPosition } from '../shared/types';
import { Explorer } from './components/Explorer';
import { Markdown, CodeBlock } from './components/Markdown';
import { QuickOpen } from './components/QuickOpen';
import { getHeadings } from './lib/markdown';
import { documentUrl } from './lib/navigation';

interface Route { path: string; hash: string; serial: number }
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to load this document.');
  return result;
}
function currentHash() { try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; } }
function parents(path: string) { const parts = path.split('/'); return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/')); }

export function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap>();
  const [files, setFiles] = useState<DocFile[]>([]);
  const [route, setRoute] = useState<Route>();
  const [data, setData] = useState<DocumentData>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [revision, setRevision] = useState(0);
  const [focus, setFocus] = useState('');
  const [expanded, setExpanded] = useState(new Set<string>());
  const [filter, setFilter] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const [sidebar, setSidebar] = useState(() => window.innerWidth >= 800);
  const [outline, setOutline] = useState(() => window.innerWidth >= 1180);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [fontSize, setFontSize] = useState(17);
  const [activeHeading, setActiveHeading] = useState('');
  const [progress, setProgress] = useState(0);
  const [viewVersion, setViewVersion] = useState(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const reader = useRef<HTMLElement>(null);
  const article = useRef<HTMLElement>(null);
  const dataRef = useRef<DocumentData | undefined>(undefined);
  const preferences = useRef<Preferences>({});
  const historyIndex = useRef(0);
  const maxHistoryIndex = useRef(0);
  const serial = useRef(0);
  const lastPosition = useRef<ReadingPosition>({ top: 0 });
  const restore = useRef<{ hash?: string; position?: ReadingPosition }>({});
  const preferenceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingPreferences = useRef<Preferences>({});
  const initialized = useRef(false);

  const savePreferences = useCallback((patch: Preferences) => {
    preferences.current = { ...preferences.current, ...patch, positions: { ...preferences.current.positions, ...patch.positions } };
    pendingPreferences.current = { ...pendingPreferences.current, ...patch, positions: { ...pendingPreferences.current.positions, ...patch.positions } };
    clearTimeout(preferenceTimer.current);
    preferenceTimer.current = setTimeout(() => {
      const pending = pendingPreferences.current; pendingPreferences.current = {};
      void api('/api/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending) }).catch(() => setNotice('Reading preferences could not be saved. You can continue reading.'));
    }, 500);
  }, []);

  const capturePosition = useCallback((): ReadingPosition => {
    const pane = reader.current;
    if (!pane) return lastPosition.current;
    const top = pane.scrollTop;
    const boundary = pane.getBoundingClientRect().top;
    const headings = Array.from(article.current?.querySelectorAll<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]') || []);
    const current = headings.filter(heading => heading.getBoundingClientRect().top - boundary <= 110).at(-1);
    const position = { top, ...(current ? { heading: current.id, offset: boundary - current.getBoundingClientRect().top } : {}) };
    lastPosition.current = position;
    return position;
  }, []);

  const rememberPosition = useCallback(() => {
    const path = dataRef.current?.path;
    if (path === undefined) return;
    const position = capturePosition();
    savePreferences({ lastPath: path, positions: { [path]: position } });
    history.replaceState({ ...history.state, position }, '', location.href);
  }, [capturePosition, savePreferences]);

  useEffect(() => {
    const controller = new AbortController();
    api<Bootstrap>('/api/bootstrap', { signal: controller.signal }).then(result => {
      setBootstrap(result); setFiles(result.files); setFocus(result.focus);
      preferences.current = result.preferences;
      if (result.preferences.theme) setTheme(result.preferences.theme);
      if (result.preferences.fontSize) setFontSize(result.preferences.fontSize);
      const path = new URLSearchParams(location.search).get('path') ?? result.initialPath;
      const hash = currentHash();
      setExpanded(new Set([...(result.preferences.expanded || []), ...parents(path)]));
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      restore.current = navigation?.type === 'reload' && history.state?.position
        ? { position: history.state.position }
        : { hash, position: result.preferences.positions?.[path] };
      history.replaceState({ halite: true, index: 0 }, '', documentUrl(path, hash));
      setRoute({ path, hash, serial: ++serial.current });
      initialized.current = true;
    }).catch(error => { if (error.name !== 'AbortError') { setError(error.message); setLoading(false); } });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (initialized.current) savePreferences({ theme, fontSize });
  }, [theme, fontSize, savePreferences]);

  const navigate = useCallback((path: string, hash = '') => {
    rememberPosition(); setNotice('');
    const next = ++historyIndex.current; maxHistoryIndex.current = next;
    history.pushState({ halite: true, index: next }, '', documentUrl(path, hash));
    restore.current = { hash, position: preferences.current.positions?.[path] };
    setRoute({ path, hash, serial: ++serial.current }); setHistoryVersion(value => value + 1);
    if (window.innerWidth < 800) setSidebar(false);
    if (window.innerWidth < 1180) setOutline(false);
  }, [rememberPosition]);

  useEffect(() => {
    const pop = (event: PopStateEvent) => {
      const previous = dataRef.current?.path;
      if (previous !== undefined) savePreferences({ positions: { [previous]: capturePosition() } });
      const path = new URLSearchParams(location.search).get('path') || '';
      const hash = currentHash();
      restore.current = event.state?.position ? { position: event.state.position } : { hash, position: preferences.current.positions?.[path] };
      historyIndex.current = event.state?.index ?? 0;
      setRoute({ path, hash, serial: ++serial.current }); setHistoryVersion(value => value + 1);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [capturePosition, savePreferences]);

  useEffect(() => {
    if (!route) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    api<DocumentData>(`/api/document?path=${encodeURIComponent(route.path)}`, { signal: controller.signal }).then(document => {
      dataRef.current = document; setData(document); setLoading(false);
      setExpanded(previous => new Set([...previous, ...parents(document.path)]));
      setFocus(previous => previous && document.path && !document.path.startsWith(`${previous}/`) ? '' : previous);
      if (document.path !== route.path) history.replaceState(history.state, '', documentUrl(document.path, route.hash));
      window.document.title = `${document.path.split('/').pop() || bootstrap?.name || 'Project'} · Halite`;
      setViewVersion(value => value + 1);
      savePreferences({ lastPath: document.path });
    }).catch(error => {
      if (error.name !== 'AbortError') { setError(error.message); setLoading(false); setData(undefined); dataRef.current = undefined; }
    });
    return () => controller.abort();
  }, [route, revision, bootstrap?.name, savePreferences]);

  const headings = useMemo<Heading[]>(() => data?.kind === 'markdown' ? getHeadings(data.content) : [], [data]);
  const words = useMemo(() => data?.content.trim().split(/\s+/).length || 0, [data]);

  useEffect(() => {
    if (!data || !reader.current) return;
    const pane = reader.current;
    const target = restore.current;
    const apply = () => {
      const hash = target.hash || target.position?.heading;
      const element = hash ? Array.from(article.current?.querySelectorAll<HTMLElement>('[id]') || []).find(node => node.id === hash) : undefined;
      if (element) {
        const top = element.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
        pane.scrollTop = Math.max(0, top + (target.hash ? -28 : target.position?.offset || 0));
      } else pane.scrollTop = target.hash ? 0 : target.position?.top || 0;
      if (target.hash && !element) setNotice(`The section “${target.hash}” was not found in this document.`);
      capturePosition();
    };
    const frame = requestAnimationFrame(apply);
    // Diagrams and images can change layout after the text becomes visible.
    const observer = new ResizeObserver(apply);
    if (article.current) observer.observe(article.current);
    const stop = () => observer.disconnect();
    pane.addEventListener('wheel', stop, { passive: true }); pane.addEventListener('touchstart', stop, { passive: true }); pane.addEventListener('keydown', stop);
    const timer = setTimeout(stop, 2500);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); observer.disconnect(); pane.removeEventListener('wheel', stop); pane.removeEventListener('touchstart', stop); pane.removeEventListener('keydown', stop); };
  }, [viewVersion, data, capturePosition]);

  useEffect(() => {
    const pane = reader.current;
    if (!pane) return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const position = capturePosition(); setActiveHeading(position.heading || headings[0]?.id || '');
      const available = pane.scrollHeight - pane.clientHeight;
      setProgress(available > 0 ? Math.min(100, Math.round(pane.scrollTop / available * 100)) : 100);
      clearTimeout(timer); timer = setTimeout(rememberPosition, 600);
    };
    pane.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    return () => { clearTimeout(timer); pane.removeEventListener('scroll', onScroll); };
  }, [data, headings, capturePosition, rememberPosition]);

  useEffect(() => {
    if (!bootstrap) return;
    const events = new EventSource('/api/events');
    events.onopen = () => setConnected(true);
    events.onerror = () => setConnected(false);
    events.onmessage = event => {
      const { paths } = JSON.parse(event.data) as { paths: string[] };
      void api<DocFile[]>('/api/files').then(setFiles).catch(() => {});
      if (paths.some(path => path === dataRef.current?.path || /\.(png|jpe?g|svg|gif|webp|avif)$/i.test(path)) || dataRef.current?.kind === 'directory') {
        restore.current = { position: capturePosition() }; setRevision(value => value + 1);
      }
    };
    return () => events.close();
  }, [bootstrap, capturePosition]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setQuickOpen(value => !value); }
      if (event.key === 'Escape') { if (window.innerWidth < 800) setSidebar(false); if (window.innerWidth < 1180) setOutline(false); }
    };
    const flush = () => {
      const path = dataRef.current?.path;
      const patch = { ...pendingPreferences.current, ...(path !== undefined ? { lastPath: path, positions: { ...pendingPreferences.current.positions, [path]: capturePosition() } } : {}) };
      navigator.sendBeacon('/api/preferences', new Blob([JSON.stringify(patch)], { type: 'application/json' }));
    };
    window.addEventListener('keydown', keyboard); window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('keydown', keyboard); window.removeEventListener('pagehide', flush); clearTimeout(preferenceTimer.current); };
  }, [capturePosition]);

  useEffect(() => {
    const selected = document.querySelector<HTMLElement>('.tree-row.selected');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [data?.path, sidebar]);

  const toggleFolder = (path: string) => setExpanded(previous => {
    const next = new Set(previous); if (next.has(path)) next.delete(path); else next.add(path);
    savePreferences({ expanded: [...next] }); return next;
  });
  const displayedPath = data?.path ?? route?.path ?? '';
  const breadcrumbs = displayedPath.split('/').filter(Boolean);
  const language = ({ py: 'python', ts: 'typescript', tsx: 'tsx', js: 'javascript', json: 'json', yml: 'yaml', yaml: 'yaml', sh: 'bash', rs: 'rust', go: 'go' } as Record<string, string>)[displayedPath.split('.').pop() || ''] || 'text';

  return <div className={`app ${sidebar ? 'with-sidebar' : ''} ${outline ? 'with-outline' : ''}`}>
    <header className="topbar"><div className="brand"><img className="brand-mark" src={haliteIcon} alt="" /><div><strong>Halite</strong><span>PROJECT READER</span></div></div>
      <div className="topbar-project"><Folder size={16} /><span>{bootstrap?.name || 'Opening project…'}</span><span className="read-only-badge">Read only</span></div>
      <div className="toolbar-actions"><button className="icon-button" title="Quick open (Ctrl/⌘ K)" aria-label="Quick open" onClick={() => setQuickOpen(true)}><Search size={19} /></button><button className="icon-button" title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'} aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</button></div>
    </header>
    {sidebar && <Explorer files={files} selected={displayedPath} focus={focus} expanded={expanded} query={filter} onFocus={setFocus} onToggle={toggleFolder} onNavigate={navigate} onQuery={setFilter} onSearch={() => setQuickOpen(true)} onClose={() => setSidebar(false)} />}
    {sidebar && <button className="sidebar-scrim" aria-label="Close explorer" onClick={() => setSidebar(false)} />}
    <div className="workspace">
      <nav className="document-toolbar" aria-label="Document navigation"><div className="navigation-buttons">
        {!sidebar && <button className="icon-button" aria-label="Show explorer" title="Show explorer" onClick={() => setSidebar(true)}><PanelLeft size={18} /></button>}
        <button className="icon-button" aria-label="Go back" title="Go back" disabled={historyIndex.current <= 0} data-history-version={historyVersion} onClick={() => history.back()}><ArrowLeft size={18} /></button>
        <button className="icon-button" aria-label="Go forward" title="Go forward" disabled={historyIndex.current >= maxHistoryIndex.current} onClick={() => history.forward()}><ArrowRight size={18} /></button>
      </div><div className="breadcrumbs"><button onClick={() => navigate('')} title="Project root">{bootstrap?.name || 'Project'}</button>{breadcrumbs.map((part, index) => <span key={index}><ChevronRight size={12} />{index < breadcrumbs.length - 1 ? <button onClick={() => navigate(breadcrumbs.slice(0, index + 1).join('/'))}>{part}</button> : <strong title={displayedPath}>{part}</strong>}</span>)}</div>
      <div className="toolbar-actions"><div className="font-controls"><Type size={16} /><button aria-label="Decrease text size" title="Decrease text size" disabled={fontSize <= 14} onClick={() => setFontSize(size => size - 1)}>−</button><button aria-label="Increase text size" title="Increase text size" disabled={fontSize >= 24} onClick={() => setFontSize(size => size + 1)}>+</button></div><button className={`icon-button ${outline ? 'pressed' : ''}`} aria-label={outline ? 'Hide outline' : 'Show outline'} title="Document outline" onClick={() => setOutline(!outline)}><List size={19} /></button></div></nav>
      {notice && <div className="notice" role="status"><AlertCircle size={16} /><span>{notice}</span><button className="icon-button" aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={16} /></button></div>}
      {!connected && <div className="connection-notice" role="status">Connection lost. Reconnecting to the local viewer…</div>}
      <div className="reader-layout"><main className="reader" ref={reader} tabIndex={0} aria-label="Document" aria-busy={loading}>
        {loading && !data && !error && <div className="empty-state"><LoaderCircle className="spinning" size={28} /><h1>Opening your documents…</h1></div>}
        {error && <div className="empty-state error-state"><AlertCircle size={30} /><h1>Unable to open this document</h1><p>{error}</p><code>{displayedPath}</code><div><button className="primary-button" onClick={() => setQuickOpen(true)}><Search size={16} />Find a document</button><button className="quiet-button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} />Retry</button></div></div>}
        {data && !error && <div className="document-content">
          <div className="document-meta"><span><FileText size={14} />{data.kind === 'markdown' ? 'MARKDOWN' : data.kind === 'text' ? 'TEXT PREVIEW' : 'FOLDER'}</span><span>{data.kind !== 'directory' && `${Math.max(1, Math.ceil(words / 220))} min read`}{loading && <LoaderCircle size={13} className="spinning" />}</span></div>
          <article ref={article} className="prose" style={{ fontSize }}>
            {data.kind === 'markdown' ? <Markdown content={data.content} path={data.path} theme={theme} revision={revision} onNavigate={navigate} onNotice={setNotice} /> : data.kind === 'text' ? <><h1>{data.path.split('/').pop()}</h1><CodeBlock code={data.content} language={language} /></> : <><h1>{data.path.split('/').pop() || bootstrap?.name}</h1><p className="folder-intro">Documents in this folder</p><div className="folder-list">{data.entries?.map(entry => <button key={entry.path} onClick={() => navigate(entry.path)}>{entry.directory ? <Folder size={20} /> : <FileText size={20} />}<span>{entry.name}</span><ChevronRight size={17} /></button>)}{!data.entries?.length && <p>No Markdown documents here. Use the explorer or quick open to find another file.</p>}</div></>}
          </article>
          {data.kind !== 'directory' && <footer className="document-end"><span>End of document</span><button onClick={() => reader.current?.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top ↑</button></footer>}
        </div>}
      </main>
      {outline && <aside className="outline" aria-label="Document outline"><div className="sidebar-heading"><span>ON THIS PAGE</span><button className="icon-button" aria-label="Hide outline" onClick={() => setOutline(false)}><PanelRightClose size={16} /></button></div><nav>{headings.map(heading => <a key={heading.id} href={documentUrl(displayedPath, heading.id)} className={activeHeading === heading.id ? 'active' : ''} style={{ paddingLeft: 12 + Math.max(0, heading.depth - 2) * 11 }} onClick={event => { event.preventDefault(); navigate(displayedPath, heading.id); }}>{heading.text}</a>)}{!headings.length && <p className="sidebar-empty">{data?.kind === 'markdown' ? 'This document has no headings.' : 'Headings appear here for Markdown documents.'}</p>}</nav><div className="reading-progress"><div><span>Reading progress</span><span>{progress}%</span></div><div className="progress-track"><div style={{ width: `${progress}%` }} /></div></div></aside>}
      </div>
      <footer className="statusbar"><span title={displayedPath}>{displayedPath || 'Project documents'}</span><span><span className={`status-dot ${connected ? '' : 'offline'}`} />{connected ? 'Watching for changes' : 'Reconnecting'}</span></footer>
    </div>
    {quickOpen && <QuickOpen files={files} onNavigate={navigate} onClose={() => setQuickOpen(false)} />}
  </div>;
}
