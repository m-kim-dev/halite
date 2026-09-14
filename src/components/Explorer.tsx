import { useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Search, PanelLeftClose, ArrowUpLeft } from 'lucide-react';
import type { DocFile } from '../../shared/types';
import { searchFiles } from '../lib/navigation';

interface TreeNode { path: string; name: string; children: TreeNode[]; file?: DocFile }
function makeTree(files: DocFile[], focus: string) {
  const root: TreeNode = { path: focus, name: focus, children: [] };
  for (const file of files) {
    if (focus && !file.path.startsWith(`${focus}/`)) continue;
    const relative = focus ? file.path.slice(focus.length + 1) : file.path;
    let parent = root;
    const parts = relative.split('/');
    parts.forEach((name, index) => {
      const nodePath = [focus, ...parts.slice(0, index + 1)].filter(Boolean).join('/');
      let node = parent.children.find(child => child.path === nodePath);
      if (!node) { node = { path: nodePath, name, children: [] }; parent.children.push(node); }
      if (index === parts.length - 1) node.file = file;
      parent = node;
    });
  }
  const sort = (node: TreeNode) => { node.children.sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name, undefined, { numeric: true })); node.children.forEach(sort); };
  sort(root); return root.children;
}

interface ExplorerProps {
  files: DocFile[]; selected: string; focus: string; expanded: Set<string>; query: string;
  onFocus: (focus: string) => void; onToggle: (path: string) => void; onNavigate: (path: string) => void;
  onQuery: (value: string) => void; onSearch: () => void; onClose: () => void;
}
export function Explorer(props: ExplorerProps) {
  const { files, selected, focus, expanded, query, onFocus, onToggle, onNavigate, onQuery, onSearch, onClose } = props;
  const tree = useMemo(() => makeTree(files, focus), [files, focus]);
  const matches = useMemo(() => searchFiles(files, query), [files, query]);
  const treeRef = useRef<HTMLDivElement>(null);
  const draw = (nodes: TreeNode[], depth = 0) => nodes.map(node => {
    const open = expanded.has(node.path);
    return <div role="none" key={node.path}>
      <button role="treeitem" aria-level={depth + 1} aria-selected={node.file ? selected === node.path : undefined} aria-expanded={node.file ? undefined : open}
        className={`tree-row ${selected === node.path ? 'selected' : ''}`} data-tree-path={node.path} data-directory={!node.file || undefined}
        style={{ paddingLeft: 12 + depth * 15 }} title={node.path}
        onClick={() => node.file ? onNavigate(node.path) : onToggle(node.path)}
        onKeyDown={event => {
          if (event.key === 'ArrowRight' && !node.file && !open) { event.preventDefault(); onToggle(node.path); }
          if (event.key === 'ArrowLeft' && !node.file && open) { event.preventDefault(); onToggle(node.path); }
        }}>
        {node.file ? <><span className="tree-indent" /><FileText size={15} /></> : <>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{open ? <FolderOpen size={16} /> : <Folder size={16} />}</>}
        <span>{node.name}</span>
      </button>
      {!node.file && open && <div role="group">{draw(node.children, depth + 1)}</div>}
    </div>;
  });
  return <aside className="explorer" aria-label="File explorer">
    <div className="sidebar-heading"><span>EXPLORER</span><button className="icon-button" title="Hide explorer" aria-label="Hide explorer" onClick={onClose}><PanelLeftClose size={17} /></button></div>
    <button className="search-trigger" onClick={onSearch}><Search size={16} /><span>Quick open</span><kbd>⌘ / Ctrl K</kbd></button>
    <div className="explorer-filter"><Search size={14} /><input aria-label="Filter files" placeholder="Filter files…" value={query} onChange={event => onQuery(event.target.value)} />{query && <button className="clear-filter" aria-label="Clear filter" onClick={() => onQuery('')}>×</button>}</div>
    <div className="scope-row"><button title={focus ? 'Show the entire project' : 'Showing all project documents'} onClick={() => onFocus('')}>{focus ? <ArrowUpLeft size={13} /> : <Folder size={13} />}{focus || 'Project files'}</button><span>{files.filter(file => !focus || file.path.startsWith(`${focus}/`)).length}</span></div>
    <div className="file-tree" role="tree" aria-label="Project documents" ref={treeRef} onKeyDown={event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(treeRef.current?.querySelectorAll<HTMLButtonElement>('[role=treeitem]') || []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
      event.preventDefault(); buttons[next]?.focus();
    }}>
      {query ? matches.map(file => <button role="treeitem" aria-selected={selected === file.path} className={`search-file-row ${selected === file.path ? 'selected' : ''}`} key={file.path} onClick={() => onNavigate(file.path)}><FileText size={16} /><span><strong>{file.path.split('/').pop()}</strong><small>{file.path}</small></span></button>) : draw(tree)}
      {(query ? !matches.length : !tree.length) && <div className="sidebar-empty">{query ? 'No matching documents.' : 'No Markdown files in this folder.'}</div>}
    </div>
    <div className="sidebar-footer"><span className="status-dot" />Read-only project<span>Halite</span></div>
  </aside>;
}
