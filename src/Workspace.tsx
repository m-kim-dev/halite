import { useCallback, useEffect, useRef, useState } from 'react';
import icon from '../desktop/icon.svg';
import './workspace.css';

type Tab = { id: string; name: string; root: string; url: string };
type State = { id: string; kind: 'browser' | 'desktop'; tabs: Tab[]; active: string | null; mode: 'tab' | 'window'; recents: { path: string; name: string }[]; windows: { id: string; name: string }[] };
type Action = { action: string; project?: string; target?: string; input?: string; mode?: string };
type Native = { open: (kind: string, mode?: string) => Promise<void>; openWorkspace: (id: string) => Promise<void>; changed: () => void; onAction: (callback: (action: string) => void) => () => void };
declare global { interface Window { haliteDesktop?: Native } }

export function Workspace() {
  const id = location.pathname.split('/')[2];
  const endpoint = `/api/workspaces/${id}`;
  const [state, setState] = useState<State>();
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(true);
  const [filter, setFilter] = useState('');
  const [menu, setMenu] = useState<{ project: string; x: number; y: number }>();
  const [busy, setBusy] = useState(false);
  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const latest = useRef(state); latest.current = state;
  const pendingNavigation = useRef(new Map<string, string>());
  const native = window.haliteDesktop;
  const post = (project: string, message: unknown) => frames.current.get(project)?.contentWindow?.postMessage(message, location.origin);

  const flush = useCallback(async (project: string) => {
    const source = frames.current.get(project)?.contentWindow;
    if (!source) return;
    const request = crypto.randomUUID();
    await new Promise<void>(resolve => {
      const done = () => { clearTimeout(timer); window.removeEventListener('message', receive); resolve(); };
      const receive = (event: MessageEvent) => { if (event.source === source && event.origin === location.origin && event.data?.type === 'halite:flushed' && event.data.request === request) done(); };
      const timer = setTimeout(done, 1500);
      window.addEventListener('message', receive); source.postMessage({ type: 'halite:flush', request }, location.origin);
    });
  }, []);

  const act = useCallback(async (action: Action, separate = false) => {
    // Reserve browser windows during the user gesture, before awaiting HTTP.
    const popup = separate && !window.haliteDesktop ? window.open('about:blank', '_blank') : null;
    setError(''); setMenu(undefined);
    try {
      if (action.project && ['move', 'close-tab'].includes(action.action)) await flush(action.project);
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.url) {
        if (window.haliteDesktop) await window.haliteDesktop.openWorkspace(result.workspace);
        else if (popup && result.shouldOpen) popup.location.replace(result.url);
        else { popup?.close(); if (result.shouldOpen) setError(`Open the new window: ${result.url}`); }
      }
    } catch (failure) { popup?.close(); setError(failure instanceof Error ? failure.message : 'Could not complete this action.'); }
  }, [endpoint, flush]);

  const open = async (kind: string, mode?: string) => {
    if (!native) return;
    setBusy(true); setError('');
    try { await native.open(kind, mode); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not open this project.'); }
    finally { setBusy(false); }
  };
  const shortcut = useCallback((key: string, shift = false) => {
    const current = latest.current;
    if (!current) return;
    if (key === 'Tab') {
      const index = current.tabs.findIndex(t => t.id === current.active);
      const tab = current.tabs[(index + (shift ? -1 : 1) + current.tabs.length) % current.tabs.length];
      if (tab) void act({ action: 'select', project: tab.id });
    } else if (key === 't') void act({ action: 'welcome' });
    else if (key === 'n') void act({ action: 'new-window' }, true);
    else if (key === 'w' && current.active) void act({ action: 'close-tab', project: current.active });
  }, [act]);

  useEffect(() => {
    const events = new EventSource(`${endpoint}/events`);
    events.onopen = () => { setConnected(true); for (const project of frames.current.keys()) post(project, { type: 'halite:connected', connected: true }); };
    events.onerror = () => { setConnected(false); for (const project of frames.current.keys()) post(project, { type: 'halite:connected', connected: false }); };
    events.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.type === 'workspace') setState(message.state);
      if (message.type === 'files') post(message.project, { type: 'halite:files', paths: message.paths });
      if (message.type === 'activate' && typeof message.path === 'string') {
        pendingNavigation.current.set(message.project, message.path);
        post(message.project, { type: 'halite:navigate', path: message.path });
      }
    };
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      const project = [...frames.current].find(([, frame]) => frame.contentWindow === event.source)?.[0];
      if (!project) return;
      if (event.data?.type === 'halite:view-changed' && latest.current?.active === project) window.haliteDesktop?.changed();
      if (event.data?.type === 'halite:navigated') pendingNavigation.current.delete(project);
      if (event.data?.type === 'halite:ready') {
        const path = pendingNavigation.current.get(project);
        if (path !== undefined) { post(project, { type: 'halite:navigate', path }); pendingNavigation.current.delete(project); }
      }
      if (event.data?.type === 'halite:shortcut' && latest.current?.active === project) shortcut(event.data.key, event.data.shift);
    };
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ['Tab', 't', 'w', 'n'].includes(event.key)) { event.preventDefault(); shortcut(event.key, event.shiftKey); }
      if (event.key === 'Escape') setMenu(undefined);
    };
    const focus = () => { void fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'focus' }) }).catch(() => {}); };
    window.addEventListener('message', receive); window.addEventListener('keydown', keyboard); window.addEventListener('focus', focus);
    const off = window.haliteDesktop?.onAction(action => { if (action === 'welcome') void act({ action }); else shortcut(action === 'previous' ? 'Tab' : action, action === 'previous'); });
    return () => { events.close(); window.removeEventListener('message', receive); window.removeEventListener('keydown', keyboard); window.removeEventListener('focus', focus); off?.(); };
  }, [endpoint, act, shortcut]);

  useEffect(() => {
    const tab = state?.tabs.find(t => t.id === state.active);
    document.title = tab ? `${tab.name} · Halite` : 'Welcome · Halite';
    native?.changed();
    if (tab) {
      document.querySelector(`[data-tab-id="${tab.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      frames.current.get(tab.id)?.contentWindow?.focus();
    }
  }, [state?.active, native]);

  if (!state) return <div className="workspace-loading">{connected ? 'Opening Halite…' : 'Halite is unavailable. Run halite again to open a workspace.'}</div>;
  return <div className="project-workspace" onClick={() => menu && setMenu(undefined)}>
    <div className="project-tabs-bar">
      <img src={icon} alt="Halite" className="workspace-icon" />
      <div className="project-tabs" role="tablist" aria-label="Projects">
        {state.tabs.map(tab => <div className={`project-tab ${state.active === tab.id ? 'active' : ''}`} key={tab.id} data-tab-id={tab.id}>
          <button role="tab" aria-selected={state.active === tab.id} tabIndex={state.active === tab.id ? 0 : -1} title={tab.root} onClick={() => void act({ action: 'select', project: tab.id })}
            onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const index = state.tabs.indexOf(tab); const next = event.key === 'Home' ? 0 : event.key === 'End' ? state.tabs.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + state.tabs.length) % state.tabs.length; void act({ action: 'select', project: state.tabs[next].id }); } }}
            onContextMenu={event => { event.preventDefault(); setMenu({ project: tab.id, x: Math.min(event.clientX, innerWidth - 260), y: event.clientY }); }}>
            <span>{tab.name}</span>{state.tabs.filter(t => t.name === tab.name).length > 1 && <small>{tab.root.split('/').slice(-2, -1).join('/')}</small>}
          </button><button className="close-project" aria-label={`Close ${tab.name}`} onClick={() => void act({ action: 'close-tab', project: tab.id })}>×</button>
        </div>)}
      </div>
      <button className={`new-project ${state.active === null ? 'active' : ''}`} aria-label="New project tab" title="New project tab (Ctrl+T)" onClick={() => void act({ action: 'welcome' })}>+</button>
      <select aria-label="Switch project" value={state.active || ''} onChange={event => void act(event.target.value ? { action: 'select', project: event.target.value } : { action: 'welcome' })}>
        <option value="">Projects…</option>{state.tabs.map(tab => <option key={tab.id} value={tab.id}>{tab.name} — {tab.root}</option>)}
      </select>
    </div>
    {(!connected || error) && <div className="workspace-notice" role="alert">{error || 'Connection lost. If the service was stopped, run halite again.'}</div>}
    <div className="project-readers">
      {state.tabs.map(tab => <iframe key={tab.id} title={`${tab.name} reader`} data-project={tab.id} src={tab.url} hidden={state.active !== tab.id} allow="clipboard-write" ref={frame => { if (frame) frames.current.set(tab.id, frame); else frames.current.delete(tab.id); }} />)}
      {state.active === null && <main className="workspace-welcome">
        <section><p className="workspace-eyebrow">HALITE · PROJECT READER</p><h1>A quiet place<br />to read your project.</h1><p>Keep your projects together in tabs,<br />or give each one its own window.</p>
          {native ? <div className="workspace-actions"><button disabled={busy} className="workspace-primary" onClick={() => void open('folder')}>Open a folder</button><button disabled={busy} onClick={() => void open('file')}>Open a file</button></div> : <div className="cli-instruction">Open a project from your terminal:<code>halite /path/to/project</code></div>}
          <label className="open-preference">Open projects in <select value={state.mode} onChange={event => void act({ action: 'settings', mode: event.target.value })}><option value="tab">Tabs</option><option value="window">Windows</option></select></label>
          <button className="workspace-link" onClick={() => void act({ action: 'new-window' }, true)}>New window ↗</button>
          <p className="workspace-hint">Your files stay where they are. Halite follows your edits.</p>
        </section>
        <section className="workspace-recents"><div className="workspace-recents-heading"><h2>Recent projects</h2>{state.recents.length > 0 && <button className="workspace-link" onClick={() => void act({ action: 'clear-recents' })}>Clear</button>}</div>
          <input type="search" aria-label="Search projects" placeholder="Find a project…" value={filter} onChange={event => setFilter(event.target.value)} />
          <div className="recent-project-list">{state.recents.filter(r => `${r.name} ${r.path}`.toLowerCase().includes(filter.toLowerCase())).map(recent => <button key={recent.path} title={recent.path} onClick={() => void act({ action: 'recent', input: recent.path }, state.mode === 'window')}><strong>{recent.name}</strong><small>{recent.path}</small></button>)}
            {!state.recents.length && <p>No recent projects yet.</p>}
          </div>{native && <button className="workspace-example" disabled={busy} onClick={() => void open('example')}><strong>Take a look around</strong><small>Try an example with math and diagrams →</small></button>}
        </section>
      </main>}
    </div>
    {menu && <div role="menu" className="project-context-menu" style={{ left: menu.x, top: menu.y }} onClick={event => event.stopPropagation()}>
      <button role="menuitem" onClick={() => void act({ action: 'move', project: menu.project }, true)}>Move to new window</button>
      {state.windows.filter(w => w.id !== id).map(w => <button role="menuitem" key={w.id} onClick={() => void act({ action: 'move', project: menu.project, target: w.id }, true)}>Move to {w.name}</button>)}
      <button role="menuitem" onClick={() => void act({ action: 'close-tab', project: menu.project })}>Close project</button>
    </div>}
  </div>;
}
