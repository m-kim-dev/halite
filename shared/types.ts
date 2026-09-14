export interface DocFile { path: string; title: string; size: number }
export interface Heading { id: string; text: string; depth: number; line: number }
export interface ReadingPosition { top: number; heading?: string; offset?: number }
export interface Preferences {
  lastPath?: string;
  expanded?: string[];
  theme?: 'light' | 'dark';
  fontSize?: number;
  positions?: Record<string, ReadingPosition>;
}
export interface Bootstrap {
  name: string;
  root: string;
  focus: string;
  initialPath: string;
  files: DocFile[];
  preferences: Preferences;
}
export interface DocumentData {
  path: string;
  kind: 'markdown' | 'text' | 'directory';
  content: string;
  entries?: { path: string; name: string; directory: boolean }[];
  modified?: number;
}
