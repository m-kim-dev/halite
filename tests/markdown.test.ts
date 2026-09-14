import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import { getHeadings, remarkBackslashMath } from '../src/lib/markdown';
import { resolveLink, searchFiles } from '../src/lib/navigation';

const parse = (source: string) => unified().use(remarkParse).use(remarkMath).use(remarkBackslashMath).parse(source);

describe('Markdown compatibility', () => {
  it('recognizes both math dialects without interpreting code examples', () => {
    const tree = parse('Inline \\(x_1 + x_2\\), $y$ and \\[\nz = \\frac{a}{b}\n\\]\n\n$$\nE=mc^2\n$$\n\n`\\(literal\\)`\n\n```text\n\\[code\\]\n```');
    const serialized = JSON.stringify(tree);
    expect(serialized).toContain('"value":"x_1 + x_2"');
    expect(serialized).toContain('"value":"y"');
    expect(serialized).toContain('math-display');
    expect(serialized).toContain('"type":"math"');
    expect(tree.children.at(-1)?.type).toBe('code');
    expect(serialized).toContain('"type":"inlineCode"');
  });
  it('preserves unmatched math, escaped currency, and link destinations', () => {
    const tree = parse('Unclosed \\(math. Costs \\$100 and \\$200. [file](folder/test\\(1\\).md)');
    expect(JSON.stringify(tree)).not.toContain('"type":"inlineMath"');
    expect(JSON.stringify(tree)).toContain('folder/test(1).md');
  });
  it('leaves ordinary financial amounts intact while keeping numeric equations', () => {
    const tree = parse('For $10,000 NAV, buy $5,000 long and $5,000 short. Math is $2+2$ or $t+1$.');
    const serialized = JSON.stringify(tree);
    expect(serialized).toContain('For $10,000 NAV, buy $5,000 long and $5,000 short.');
    expect(serialized).toContain('"value":"2+2"');
    expect(serialized).toContain('"value":"t+1"');
  });
  it('builds unique anchors from real headings, including formatted and setext headings', () => {
    expect(getHeadings('# A **heading**\n\n## A heading\n\n```md\n# hidden\n```\n\nSetext\n------').map(h => h.id)).toEqual(['a-heading', 'a-heading-1', 'setext']);
  });
});

describe('Project navigation', () => {
  it('resolves sibling links, encoded filenames, fragments, and project-root links', () => {
    expect(resolveLink('../other/A%20file.md#hello-world', 'docs/dev/guide.md')).toEqual({ kind: 'local', path: 'docs/other/A file.md', hash: 'hello-world' });
    expect(resolveLink('#section', 'docs/guide.md')).toEqual({ kind: 'local', path: 'docs/guide.md', hash: 'section' });
    expect(resolveLink('/README.md', 'docs/guide.md')).toEqual({ kind: 'local', path: 'README.md', hash: '' });
  });
  it('rejects unsafe protocols and paths that leave the project', () => {
    for (const href of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', '//example.com', '../../outside.md', '%2e%2e/%2e%2e/outside.md']) expect(resolveLink(href, 'docs/guide.md').kind).toBe('blocked');
  });
  it('ranks exact filenames before fuzzy matches and searches titles', () => {
    const files = [{ path: 'docs/risk.md', title: 'Risk rules', size: 1 }, { path: 'docs/portfolio.md', title: 'Managing risk', size: 1 }, { path: 'docs/long-report.md', title: 'Architecture', size: 1 }];
    expect(searchFiles(files, 'risk')[0].path).toBe('docs/risk.md');
    expect(searchFiles(files, 'architecture')[0].path).toBe('docs/long-report.md');
    expect(searchFiles(files, 'xyz-nomatch')).toEqual([]);
  });
});
