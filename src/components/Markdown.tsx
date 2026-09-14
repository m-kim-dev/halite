import { Children, Component, isValidElement, memo, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Check, Copy, Expand, ImageOff, Minus, Plus, X, Code2 } from 'lucide-react';
import { remarkBackslashMath, remarkHeadingIds, rehypeCodeLanguage } from '../lib/markdown';
import { assetUrl, documentUrl, resolveLink } from '../lib/navigation';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (copied) { const timer = setTimeout(() => setCopied(false), 1500); return () => clearTimeout(timer); } }, [copied]);
  return <button className="quiet-button copy-button" title="Copy code" aria-label={copied ? 'Copied' : 'Copy code'} onClick={async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setFailed(false); } catch { setFailed(true); }
  }}>{copied ? <Check size={14} /> : <Copy size={14} />}<span>{failed ? 'Select to copy' : copied ? 'Copied' : 'Copy'}</span></button>;
}

const highlights = new Map<string, Promise<string>>();
const makeHighlighter = async () => {
  const [{ createHighlighter, bundledLanguages }, { createJavaScriptRegexEngine }] = await Promise.all([import('shiki'), import('shiki/engine/javascript')]);
  const highlighter = await createHighlighter({ langs: [], themes: ['github-light', 'github-dark'], engine: createJavaScriptRegexEngine() });
  return { highlighter, bundledLanguages };
};
let highlighterPromise: ReturnType<typeof makeHighlighter> | undefined;
function highlight(code: string, language: string) {
  const key = `${language}:${code}`;
  if (!highlights.has(key)) {
    if (highlights.size > 80) highlights.delete(highlights.keys().next().value!);
    highlights.set(key, (highlighterPromise ||= makeHighlighter()).then(async ({ highlighter, bundledLanguages }) => {
      const lang = language in bundledLanguages ? language as keyof typeof bundledLanguages : 'text';
      if (lang !== 'text') await highlighter.loadLanguage(lang);
      return highlighter.codeToHtml(code, { lang, themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false });
    }));
  }
  return highlights.get(key)!;
}

export function CodeBlock({ code, language = 'text' }: { code: string; language?: string }) {
  const [html, setHtml] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true; setHtml('');
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      highlight(code, language).then(result => { if (alive) setHtml(result); }).catch(() => {});
    }, { rootMargin: '500px' });
    if (ref.current) observer.observe(ref.current);
    return () => { alive = false; observer.disconnect(); };
  }, [code, language]);
  return <div className="code-block" ref={ref}>
    <div className="block-toolbar"><span>{language}</span><CopyButton text={code} /></div>
    {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <pre><code>{code}</code></pre>}
  </div>;
}

function ExpandedView({ label, children, onClose }: { label: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(100);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog className="expanded-dialog" ref={dialog} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="expanded-header"><strong>{label}</strong><div className="toolbar-actions">
      <button className="icon-button" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(25, value - 25))}><Minus size={18} /></button>
      <span className="zoom-value">{zoom}%</span>
      <button className="icon-button" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(300, value + 25))}><Plus size={18} /></button>
      <button className="icon-button" aria-label="Close expanded view" onClick={onClose}><X size={20} /></button>
    </div></div>
    <div className="expanded-content"><div className="zoom-content" style={{ zoom: `${zoom}%` }}>{children}</div></div>
  </dialog>;
}

let diagramQueue = Promise.resolve();
function MermaidBlock({ code, theme }: { code: string; theme: 'light' | 'dark' }) {
  const id = `mermaid-${useId().replace(/[^a-z0-9]/gi, '')}`;
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [source, setSource] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true; setSvg(''); setError('');
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      diagramQueue = diagramQueue.catch(() => {}).then(async () => {
        if (!alive) return;
        try {
          const { default: mermaid } = await import('mermaid');
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme === 'dark' ? 'dark' : 'default', suppressErrorRendering: true, fontFamily: 'system-ui, sans-serif', flowchart: { htmlLabels: false }, maxTextSize: 100000 });
          const result = await mermaid.render(id, code); if (alive) setSvg(result.svg);
        }
        catch (error) { if (alive) setError(error instanceof Error ? error.message.split('\n').slice(0, 4).join('\n') : 'This diagram could not be rendered.'); }
      });
    }, { rootMargin: '400px' });
    if (ref.current) observer.observe(ref.current);
    return () => { alive = false; observer.disconnect(); };
  }, [code, id, theme]);
  return <div className="diagram-block" ref={ref}>
    <div className="block-toolbar"><span>Mermaid diagram</span><div className="toolbar-actions">
      <button className="quiet-button" onClick={() => setSource(!source)}><Code2 size={14} />{source ? 'Diagram' : 'Source'}</button>
      <button className="quiet-button" disabled={!svg} onClick={() => setExpanded(true)} aria-label="Expand diagram"><Expand size={14} />Expand</button>
    </div></div>
    {error && <div className="render-error" role="status"><strong>Unable to render this diagram</strong><pre>{error}</pre></div>}
    {source || error ? <CodeBlock code={code} language="mermaid" /> : svg ? <div className="mermaid-canvas" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="diagram-loading">Rendering diagram…</div>}
    {expanded && <ExpandedView label="Diagram" onClose={() => setExpanded(false)}><div className="mermaid-expanded" dangerouslySetInnerHTML={{ __html: svg }} /></ExpandedView>}
  </div>;
}

function DocumentImage({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <span className="image-error"><ImageOff size={18} />Image unavailable{alt ? `: ${alt}` : ''}</span>;
  return <><button className="document-image" aria-label={`Expand image: ${alt || 'Image'}`} onClick={() => setExpanded(true)}><img src={src} alt={alt || ''} loading="lazy" onError={() => setFailed(true)} /><span className="image-expand"><Expand size={16} /></span></button>
    {expanded && <ExpandedView label={alt || 'Image'} onClose={() => setExpanded(false)}><img src={src} alt={alt || ''} /></ExpandedView>}</>;
}

interface MarkdownProps { content: string; path: string; theme: 'light' | 'dark'; revision: number; onNavigate: (path: string, hash?: string) => void; onNotice: (message: string) => void }

class RenderBoundary extends Component<{ content: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <><div className="render-error" role="status">This document could not be rendered. Its original text is shown below.</div><CodeBlock code={this.props.content} language="markdown" /></> : this.props.children;
  }
}

export const Markdown = memo(function Markdown({ content, path, theme, revision, onNavigate, onNotice }: MarkdownProps) {
  return <RenderBoundary key={`${path}:${revision}`} content={content}><ReactMarkdown
    remarkPlugins={[remarkGfm, remarkMath, remarkBackslashMath, remarkHeadingIds]}
    rehypePlugins={[[rehypeKatex, { strict: 'ignore', trust: false, throwOnError: false }], rehypeCodeLanguage]}
    urlTransform={url => url}
    components={{
      a({ href = '', children, title }) {
        const link = resolveLink(href, path);
        if (link.kind === 'blocked') return <button className="inline-link" title={link.reason} onClick={() => onNotice(link.reason)}>{children}</button>;
        if (link.kind === 'external') return <a href={link.href} target="_blank" rel="noopener noreferrer" title={title}>{children}</a>;
        if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(link.path)) return <a href={assetUrl(href, path)} target="_blank" rel="noopener noreferrer">{children}</a>;
        return <a href={documentUrl(link.path, link.hash)} title={title} onClick={event => {
          if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); onNavigate(link.path, link.hash);
        }}>{children}</a>;
      },
      img({ src, alt }) { return <DocumentImage src={assetUrl(typeof src === 'string' ? src : '', path, revision)} alt={alt} />; },
      pre({ children }) {
        const child = Children.toArray(children)[0];
        if (isValidElement<{ children?: ReactNode; className?: string }>(child)) {
          const code = String(child.props.children ?? '').replace(/\n$/, '');
          const language = child.props.className?.match(/language-(\S+)/)?.[1] || 'text';
          if (language === 'mermaid') return <MermaidBlock code={code} theme={theme} />;
          // KaTeX replaces math code before this component is reached.
          return <CodeBlock code={code} language={language} />;
        }
        return <pre>{children}</pre>;
      },
      table({ children }) { return <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable table"><table>{children}</table></div>; },
      input({ checked, type }) { return <input type={type} checked={checked} disabled readOnly />; },
    }}
  >{content}</ReactMarkdown></RenderBoundary>;
});
