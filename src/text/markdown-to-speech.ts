import { Lexer, type Token, type Tokens } from 'marked';

/** How a picked file's text should be prepared for speech. */
export type TextFormat = 'plain' | 'markdown';

const MARKDOWN_EXTENSIONS = /\.(md|markdown|mdown|mkd|mkdn)$/i;

/** Picks the format from the file name, falling back to the MIME type the picker reported. */
export function detectTextFormat(name: string, mimeType?: string | null): TextFormat {
  if (MARKDOWN_EXTENSIONS.test(name)) return 'markdown';
  if (mimeType === 'text/markdown' || mimeType === 'text/x-markdown') return 'markdown';
  return 'plain';
}

/** Returns the text the speech engine should read: Markdown is converted, plain text passes through. */
export function toSpeakableText(text: string, format: TextFormat): string {
  return format === 'markdown' ? markdownToSpeech(text) : text;
}

/** YAML front matter at the very top of the file ("---" ... "---"). */
const FRONT_MATTER = /^﻿?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
/** Ends with punctuation that already gives the speech engine a pause. */
const ENDS_WITH_PUNCTUATION = /[.!?…:;,]["'”’»)\]]*$/;

/**
 * Converts Markdown into plain speakable text.
 *
 * Each block (heading, paragraph, list item, table row) becomes its own paragraph
 * separated by a blank line, so the chunker reads it as a separate sentence with a pause.
 * Syntax characters, URLs, code blocks and HTML tags are dropped.
 */
export function markdownToSpeech(markdown: string): string {
  const source = markdown.replace(FRONT_MATTER, '');
  const tokens = new Lexer({ gfm: true }).lex(source);
  const blocks: string[] = [];
  collectBlocks(tokens, blocks);
  return blocks.join('\n\n');
}

function collectBlocks(tokens: Token[], blocks: string[]): void {
  for (const token of tokens) {
    collectBlock(token, blocks);
  }
}

function collectBlock(token: Token, blocks: string[]): void {
  switch (token.type) {
    case 'heading':
    case 'paragraph':
      pushSentence(blocks, inlineText((token as Tokens.Heading | Tokens.Paragraph).tokens));
      return;
    case 'text': {
      // Block-level text appears inside tight list items.
      const text = token as Tokens.Text;
      pushSentence(blocks, text.tokens ? inlineText(text.tokens) : decodeEntities(text.text));
      return;
    }
    case 'list':
      for (const item of (token as Tokens.List).items) {
        collectBlocks(item.tokens, blocks);
      }
      return;
    case 'blockquote':
      collectBlocks((token as Tokens.Blockquote).tokens, blocks);
      return;
    case 'table':
      collectTable(token as Tokens.Table, blocks);
      return;
    case 'html':
      pushSentence(blocks, htmlToText((token as Tokens.HTML).text));
      return;
    // Code blocks, rules, link definitions and blank space are not read aloud.
    default:
      return;
  }
}

/** Reads each row as "Header: value, Header: value." so the listener knows what each value is. */
function collectTable(table: Tokens.Table, blocks: string[]): void {
  const headers = table.header.map((cell) => inlineText(cell.tokens));
  pushSentence(blocks, headers.filter(Boolean).join(', '));
  for (const row of table.rows) {
    const cells = row
      .map((cell, i) => {
        const value = inlineText(cell.tokens);
        if (!value) return '';
        return headers[i] ? `${headers[i]}: ${value}` : value;
      })
      .filter(Boolean);
    pushSentence(blocks, cells.join(', '));
  }
}

function inlineText(tokens: Token[] | undefined): string {
  if (!tokens) return '';
  return tokens.map(inlineTokenText).join('');
}

function inlineTokenText(token: Token): string {
  switch (token.type) {
    case 'link': {
      const link = token as Tokens.Link;
      // Images inside links are almost always README badges ("build passing", "npm v1.2"): skip them.
      const text = inlineText(link.tokens.filter((t) => t.type !== 'image')).trim();
      if (!text && link.tokens.some((t) => t.type === 'image')) return '';
      // A bare URL ("<https://…>" or an autolinked address) is noise when spoken.
      if (!text || text === link.href || /^(https?:\/\/|www\.|mailto:)/i.test(text)) return 'link';
      return text;
    }
    case 'image': {
      const alt = decodeEntities((token as Tokens.Image).text).trim();
      return alt ? `image: ${alt}` : '';
    }
    case 'codespan':
      return decodeEntities((token as Tokens.Codespan).text);
    case 'br':
      return ' ';
    case 'html':
      return htmlToText((token as Tokens.Tag).text);
    case 'checkbox':
      return '';
    default: {
      const nested = (token as { tokens?: Token[] }).tokens;
      if (nested) return inlineText(nested);
      return decodeEntities((token as { text?: string }).text ?? '');
    }
  }
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?(-->|$)/g, ' ')
      .replace(/<(script|style)\b[\s\S]*?(<\/\1\s*>|$)/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/?[A-Za-z][^>]*>/g, ''),
  );
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  copy: '©',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

/** Adds a block as its own sentence, ending it with a period so headings and items get a full stop. */
function pushSentence(blocks: string[], text: string): void {
  const sentence = text.replace(/\s+/g, ' ').trim();
  if (!sentence) return;
  blocks.push(ENDS_WITH_PUNCTUATION.test(sentence) ? sentence : `${sentence}.`);
}
