#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { startServer } from './app.js';

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    root: { type: 'string' }, port: { type: 'string' }, 'no-open': { type: 'boolean' },
    dev: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log(`Halite — local project documentation\n\nUsage: halite [file-or-directory] [options]\n\n  --root <directory>  Set the accessible project root\n  --port <number>     Listening port (default: 4173; 0 chooses a free port)\n  --no-open          Print the URL without opening a browser\n  --help             Show this help\n\nDocuments are read-only. The service listens on 127.0.0.1.\nStop with Ctrl-C. Preferences use HALITE_STATE_DIR or your user state directory.`);
  } else {
    if (positionals.length > 1) throw new Error('Supply one file or directory. Use --root for an explicit project root.');
    const port = values.port === undefined ? 4173 : Number(values.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('--port must be an integer from 0 to 65535.');
    const app = await startServer({ input: positionals[0] || process.cwd(), root: values.root, port, dev: values.dev });
    console.log(`\n  Halite\n  Project  ${app.root}\n  Open     ${app.url}\n\n  Read-only · Press Ctrl-C to stop\n`);
    if (!values['no-open']) {
      const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
      const child = spawn(command, [app.url], { detached: true, stdio: 'ignore' });
      child.on('error', () => console.log(`Open ${app.url} in your browser.`)); child.unref();
    }
    let stopping = false;
    const stop = async () => { if (stopping) return; stopping = true; await app.close(); process.exit(0); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`halite: ${message.includes('EADDRINUSE') ? 'Port is in use. Choose another with --port 4174 or --port 0.' : message}`);
  process.exitCode = 1;
}
