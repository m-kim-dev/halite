import React from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './styles.css';
import { App } from './App';
import { Workspace } from './Workspace';

createRoot(document.getElementById('root')!).render(<React.StrictMode>{location.pathname.startsWith('/workspaces/') ? <Workspace /> : <App />}</React.StrictMode>);
