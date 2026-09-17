import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export type DocumentView = 'preview' | 'source';

export function DocumentActions({ content, view, disabled, onView, onCopyFailure }: {
  content: string;
  view: DocumentView;
  disabled: boolean;
  onView: (view: DocumentView) => void;
  onCopyFailure: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const request = useRef(0);
  useEffect(() => { setCopied(false); request.current++; return () => { request.current++; }; }, [content, disabled]);
  useEffect(() => {
    if (copied) { const timer = setTimeout(() => setCopied(false), 1800); return () => clearTimeout(timer); }
  }, [copied]);
  const copy = async () => {
    const current = ++request.current;
    try {
      await navigator.clipboard.writeText(content);
      if (request.current === current) setCopied(true);
    } catch {
      if (request.current === current) onCopyFailure();
    }
  };
  return <div className="document-view-toolbar">
    <div className="document-view-switch" role="group" aria-label="Document view">
      <button type="button" aria-pressed={view === 'preview'} disabled={disabled} onClick={() => onView('preview')}>Preview</button>
      <button type="button" aria-pressed={view === 'source'} disabled={disabled} onClick={() => onView('source')}>Source</button>
    </div>
    <button type="button" className="copy-markdown" aria-label="Copy Markdown" disabled={disabled} onClick={copy}>
      {copied ? <Check size={15} /> : <Copy size={15} />}<span aria-live="polite">{copied ? 'Copied!' : 'Copy Markdown'}</span>
    </button>
  </div>;
}
