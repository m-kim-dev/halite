import GithubSlugger from 'github-slugger';
import { unified, type Plugin } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';
import type { Root as MarkdownRoot, Nodes } from 'mdast';
import type { Root as HtmlRoot } from 'hast';
import type { Construct, State } from 'micromark-util-types';
import type { Extension as FromMarkdownExtension } from 'mdast-util-from-markdown';
import type { Heading } from '../../shared/types';

declare module 'micromark-util-types' { interface TokenTypeMap { projectMath: 'projectMath'; projectMathMarker: 'projectMathMarker'; projectMathData: 'projectMathData' } }

// Recognize the delimiters before CommonMark interprets them as escaped brackets.
// Being a text construct keeps this out of fenced/inline code and link destinations.
const backslashMath: Construct = {
  name: 'projectMath',
  tokenize(effects, ok, nok) {
    let closing = 0;
    let display = false;
    const start: State = code => {
      if (code !== 92) return nok(code);
      effects.enter('projectMath'); effects.enter('projectMathMarker'); effects.consume(code); return opening;
    };
    const opening: State = code => {
      if (code !== 40 && code !== 91) return nok(code);
      display = code === 91; closing = display ? 93 : 41;
      effects.consume(code); effects.exit('projectMathMarker'); return between;
    };
    const between: State = code => {
      if (code === null || (!display && (code === -4 || code === -5 || code === -3))) return nok(code);
      if (code === -4 || code === -5 || code === -3) {
        effects.enter('lineEnding'); effects.consume(code); effects.exit('lineEnding'); return between;
      }
      if (code === 92) { effects.enter('projectMathMarker'); effects.consume(code); return possibleEnd; }
      effects.enter('projectMathData'); return inside(code);
    };
    const inside: State = code => {
      if (code === null || code === 92 || code === -4 || code === -5 || code === -3) {
        effects.exit('projectMathData'); return between(code);
      }
      effects.consume(code); return inside;
    };
    const possibleEnd: State = code => {
      if (code === closing) { effects.consume(code); effects.exit('projectMathMarker'); effects.exit('projectMath'); return ok; }
      if (code === 40 || code === 91) return nok(code);
      effects.exit('projectMathMarker'); return between(code);
    };
    return start;
  },
};

export const remarkBackslashMath: Plugin = function () {
  const data = this.data();
  // A closing dollar followed by a digit is usually the next currency amount.
  // Requiring non-whitespace inside single-dollar delimiters also avoids prose
  // such as "$100 long and $50 short" being swallowed as an equation.
  for (const item of data.micromarkExtensions || []) {
    const constructs = item.text?.[36];
    for (const construct of Array.isArray(constructs) ? constructs : constructs ? [constructs] : []) {
      if (construct.name !== 'mathText') continue;
      const tokenize = construct.tokenize;
      construct.tokenize = function (effects, ok, nok) {
        return tokenize.call(this, effects, code => {
          const token = this.events.at(-1)?.[1];
          const raw = token ? this.sliceSerialize(token) : '';
          if (raw.startsWith('$') && !raw.startsWith('$$') && (/\s/.test(raw[1] || '') || /\s/.test(raw.at(-2) || '') || (code !== null && code >= 48 && code <= 57))) return nok(code);
          return ok(code);
        }, nok);
      };
    }
  }
  const extension: FromMarkdownExtension = {
    enter: {
      projectMath(token) {
        const source = this.sliceSerialize(token);
        const display = source.startsWith('\\[');
        const value = source.slice(2, -2).trim();
        this.enter({ type: 'inlineMath', value, data: { hName: 'code', hProperties: { className: ['language-math', display ? 'math-display' : 'math-inline'] }, hChildren: [{ type: 'text', value }] } }, token);
        this.buffer();
      },
    },
    exit: { projectMath(token) { this.resume(); this.exit(token); } },
  };
  (data.micromarkExtensions ||= []).push({ text: { 92: backslashMath } });
  (data.fromMarkdownExtensions ||= []).push(extension);
};

function textOf(node: Nodes): string {
  if ('value' in node) return node.value;
  if ('alt' in node) return node.alt || '';
  if ('children' in node) return node.children.map(child => textOf(child as Nodes)).join('');
  return '';
}

export function getHeadings(source: string): Heading[] {
  let tree: MarkdownRoot;
  try { tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkBackslashMath).parse(source); } catch { return []; }
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  visit(tree, 'heading', node => { const text = textOf(node); headings.push({ id: slugger.slug(text), text, depth: node.depth, line: node.position?.start.line || 1 }); });
  return headings;
}

export const remarkHeadingIds: Plugin<[], MarkdownRoot> = () => tree => {
  const slugger = new GithubSlugger();
  visit(tree, 'heading', node => { node.data = { ...node.data, hProperties: { id: slugger.slug(textOf(node)) } }; });
};

// User-authored HTML stays escaped. Headings and plugins are the only HTML producers.
// Preserve the source language as a property so code controls need not parse HTML.
export const rehypeCodeLanguage: Plugin<[], HtmlRoot> = () => tree => {
  visit(tree, 'element', node => {
    if (node.tagName === 'code' && Array.isArray(node.properties.className)) {
      const language = node.properties.className.find(x => typeof x === 'string' && x.startsWith('language-'));
      if (typeof language === 'string') node.properties['data-language'] = language.slice(9);
    }
  });
};
