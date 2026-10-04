import { Fragment, type ReactNode } from 'react';

interface Props {
  markdown: string;
}

/**
 * Minimal, dependency-free markdown viewer.
 *
 * It builds React elements instead of injecting HTML, so AI-generated content
 * can never execute script in the dashboard. It covers what our generators
 * actually emit: headings, fenced code, lists, blockquotes, bold and inline code.
 */
export function VC_Markdown({ markdown }: Props) {
  return <div className="vc-markdown">{renderBlocks(markdown)}</div>;
}

function renderBlocks(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];

  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre className="vc-markdown__code" key={`code-${key++}`}>
          {language ? <span className="vc-markdown__code-lang">{language}</span> : null}
          <code>{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${Math.min(level + 1, 6)}` as 'h2';
      blocks.push(
        <Tag key={`h-${key++}`} className={`vc-markdown__h vc-markdown__h--${level}`}>
          {renderInline(heading[2])}
        </Tag>,
      );
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ul className="vc-markdown__list" key={`ul-${key++}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith('>')) {
        quote.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(
        <blockquote className="vc-markdown__quote" key={`q-${key++}`}>
          {quote.map((item, quoteIndex) => (
            <div key={quoteIndex}>{renderInline(item)}</div>
          ))}
        </blockquote>,
      );
      continue;
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p className="vc-markdown__p" key={`p-${key++}`}>
        {paragraph.map((item, itemIndex) => (
          <Fragment key={itemIndex}>
            {renderInline(item)}
            {itemIndex < paragraph.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </p>,
    );
  }

  return blocks;
}

function isBlockStart(line: string): boolean {
  return (
    line.startsWith('```') ||
    line.startsWith('>') ||
    /^#{1,6}\s/.test(line) ||
    /^[-*]\s+/.test(line)
  );
}

/** Handles **bold**, `code` and [links](url) without any HTML injection. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(
        <code className="vc-markdown__inline-code" key={key++}>
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        nodes.push(
          <a key={key++} href={link[2]} target="_blank" rel="noreferrer noopener">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export default VC_Markdown;
