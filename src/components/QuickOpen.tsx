import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Search, X } from 'lucide-react';
import type { DocFile } from '../../shared/types';
import { searchFiles } from '../lib/navigation';

export function QuickOpen({ files, onNavigate, onClose }: { files: DocFile[]; onNavigate: (path: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const matches = useMemo(() => searchFiles(files, query), [files, query]);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { dialog.current?.querySelector(`[data-result-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' }); }, [selected]);
  return <dialog ref={dialog} className="quick-open" aria-label="Quick open" onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="quick-input"><Search size={21} /><input autoFocus role="combobox" aria-label="Find a document" aria-expanded="true" aria-controls="quick-results" aria-activedescendant={matches[selected] ? `quick-result-${selected}` : undefined} placeholder="Find a document by name or path…" value={query} onChange={event => { setQuery(event.target.value); setSelected(0); }} onKeyDown={event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setSelected(value => Math.min(matches.length - 1, value + 1)); }
      if (event.key === 'ArrowUp') { event.preventDefault(); setSelected(value => Math.max(0, value - 1)); }
      if (event.key === 'Enter' && matches[selected]) { onNavigate(matches[selected].path); onClose(); }
    }} /><button className="icon-button" aria-label="Close quick open" onClick={onClose}><X size={18} /></button></div>
    <div className="quick-caption">{query ? `${matches.length}${matches.length === 60 ? '+' : ''} matches` : 'PROJECT DOCUMENTS'}<span>Search names, paths, and titles</span></div>
    <div id="quick-results" className="quick-results" role="listbox" aria-label="Matching documents">{matches.map((file, index) => <button id={`quick-result-${index}`} role="option" aria-selected={index === selected} data-result-index={index} className={`quick-result ${index === selected ? 'active' : ''}`} key={file.path} onMouseMove={() => setSelected(index)} onClick={() => { onNavigate(file.path); onClose(); }}><FileText size={19} /><span><strong>{file.title}</strong><small>{file.path}</small></span><kbd>↵</kbd></button>)}{!matches.length && <div className="quick-empty">No documents match “{query}”.</div>}</div>
    <div className="quick-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
  </dialog>;
}
