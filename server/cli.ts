#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { startServer } from './app.js';
import { ensureService, serviceCommand, unavailable } from './client.js';

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    root: { type: 'string' }, port: { type: 'string' }, 'no-open': { type: 'boolean' },
    window: { type: 'boolean' }, tab: { type: 'boolean' },
    dev: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log(`Halite — local project documentation

Usage: halite [file-or-directory] [options]
       halite status | stop

  --tab              Open a project tab (initial default)
  --window           Open in a separate window
  --root <directory> Set the accessible project root
  --port <number>    Choose the shared service port (default: available port)
  --no-open          Print the workspace URL without launching a browser
  --dev              Run an isolated foreground development reader
  --help             Show this help

One background service serves all projects. Commands exit after opening.
Use halite stop to stop it. Documents remain read-only.
Preferences and service identity use HALITE_STATE_DIR or the user state directory.`);
  } else {
    if (positionals.length > 1) throw new Error('Supply one file or directory.');
    if (values.tab && values.window) throw new Error('Choose --tab or --window.');
    const port = values.port === undefined ? undefined : Number(values.port);
    if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) throw new Error('--port must be an integer from 0 to 65535.');
    const action = positionals[0];
    if (action === 'status' || action === 'stop') {
      try {
        const result = await serviceCommand({ action });
        console.log(action === 'stop' ? 'Halite service stopped.' : `Halite service ${result.pid} · ${result.url}\n${result.projects.map((p: { root: string }) => p.root).join('\n') || 'No open projects.'}`);
      } catch (error) { if (unavailable(error)) console.log('Halite service is not running.'); else throw error; }
    } else {
      const input = path.resolve(action || process.cwd());
      let url: string; let shouldOpen = true; let kind = 'browser';
      if (values.dev) {
        const app = await startServer({ input, root: values.root, port: port ?? 4173, dev: true });
        url = app.url;
        let stopping = false;
        const stop = async () => { if (stopping) return; stopping = true; await app.close(); process.exit(0); };
        process.on('SIGINT', stop); process.on('SIGTERM', stop);
      } else {
        await ensureService(port);
        const result = await serviceCommand({ action: 'open', input, root: values.root ? path.resolve(values.root) : undefined, mode: values.window ? 'window' : values.tab ? 'tab' : undefined });
        ({ url, shouldOpen, kind } = result);
      }
      console.log(`Halite · ${input}\n${url!}\n${values.dev ? 'Press Ctrl-C to stop.' : 'Shared service · Use halite stop to stop.'}`);
      if (!values['no-open'] && shouldOpen && kind === 'browser') {
        const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
        const child = spawn(command, [url!], { detached: true, stdio: 'ignore' });
        child.on('error', () => console.log(`Open ${url} in your browser.`)); child.unref();
      }
    }
  }
} catch (error) { console.error(`halite: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
