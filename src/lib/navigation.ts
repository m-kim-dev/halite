import type { DocFile } from '../../shared/types';

export type ResolvedLink = { kind: 'local'; path: string; hash: string } | { kind: 'external'; href: string } | { kind: 'blocked'; reason: string };
const virtualOrigin = 'http://project.local';

export function resolveLink(href: string, currentPath: string): ResolvedLink {
  if (/^(https?:|mailto:)/i.test(href)) return { kind: 'external', href };
  if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//') || href.includes('\\')) return { kind: 'blocked', reason: 'This link uses an unsupported protocol or path.' };
  try {
    const base = `${virtualOrigin}/${currentPath.split('/').map(encodeURIComponent).join('/')}`;
    // Check for attempted root escapes before URL normalization removes .. segments.
    const pathPart = href.split(/[?#]/, 1)[0];
    const parts = pathPart.startsWith('/') ? [] : currentPath.split('/').slice(0, -1);
    if (pathPart) for (const part of decodeURIComponent(pathPart).split('/')) {
      if (part === '..') { if (!parts.length) return { kind: 'blocked', reason: 'This link leaves the open project.' }; parts.pop(); }
      else if (part && part !== '.') parts.push(part);
    }
    const url = new URL(href, base);
    const decoded = decodeURIComponent(url.pathname).slice(1);
    if (decoded.includes('\0')) return { kind: 'blocked', reason: 'This link contains an invalid path.' };
    return { kind: 'local', path: decoded.replace(/\/$/, ''), hash: decodeURIComponent(url.hash.slice(1)) };
  } catch { return { kind: 'blocked', reason: 'This link is malformed.' }; }
}

export function projectPrefix() {
  return typeof location === 'undefined' ? '' : location.pathname.match(/^\/projects\/[a-f0-9-]+/)?.[0] || '';
}
export function apiUrl(endpoint: string) {
  const prefix = projectPrefix();
  return prefix ? `/api${prefix}${endpoint.replace(/^\/api/, '')}` : endpoint;
}
export function documentUrl(path: string, hash = '') {
  return `${projectPrefix()}/?path=${encodeURIComponent(path)}${hash ? `#${encodeURIComponent(hash)}` : ''}`;
}

export function assetUrl(href: string, currentPath: string, revision = 0): string | undefined {
  const link = resolveLink(href, currentPath);
  if (link.kind === 'external' && /^https?:/i.test(link.href)) return link.href;
  if (link.kind === 'local') return `${apiUrl('/api/asset')}?path=${encodeURIComponent(link.path)}&v=${revision}`;
  return undefined;
}

export function searchFiles(files: DocFile[], query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return files.slice(0, 60);
  return files.map(file => {
    const name = file.path.split('/').pop()!.toLocaleLowerCase();
    const text = `${file.path} ${file.title}`.toLocaleLowerCase();
    let score = 0;
    for (const term of terms) {
      if (name === term || name === `${term}.md`) score += 200;
      else if (name.includes(term)) score += 100;
      else if (text.includes(term)) score += 60;
      else {
        let cursor = 0;
        for (const character of text) if (character === term[cursor]) cursor++;
        if (cursor !== term.length) return { file, score: -1 };
        score += 10;
      }
    }
    return { file, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path)).slice(0, 60).map(x => x.file);
}
