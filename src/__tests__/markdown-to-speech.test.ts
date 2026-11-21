import { describe, expect, it } from '@jest/globals';

import { chunkText } from '@/text/chunk-text';
import { detectTextFormat, markdownToSpeech, toSpeakableText } from '@/text/markdown-to-speech';

/** The converted text split into its blocks, which is how the chunker sees it. */
function blocks(markdown: string): string[] {
  return markdownToSpeech(markdown).split('\n\n');
}

describe('markdownToSpeech', () => {
  it('reads headings as their own sentence', () => {
    expect(blocks('# Getting started\n\nInstall it first.\n\n## Usage?\nRun it.')).toEqual([
      'Getting started.',
      'Install it first.',
      'Usage?',
      'Run it.',
    ]);
  });

  it('reads setext headings', () => {
    expect(blocks('Title\n=====\n\nBody text.')).toEqual(['Title.', 'Body text.']);
  });

  it('drops emphasis, strikethrough and escapes', () => {
    expect(markdownToSpeech('This is **bold**, _italic_, ~~gone~~ and \\*literal\\*.')).toBe(
      'This is bold, italic, gone and *literal*.',
    );
  });

  it('reads each list item as its own sentence, including nested and ordered lists', () => {
    const md = '- first item\n- second item\n  1. nested one\n  2. nested two\n- [x] done task';
    expect(blocks(md)).toEqual([
      'first item.',
      'second item.',
      'nested one.',
      'nested two.',
      'done task.',
    ]);
  });

  it('reads loose list items with several paragraphs', () => {
    expect(blocks('1. Step one.\n\n   More detail.\n\n2. Step two')).toEqual([
      'Step one.',
      'More detail.',
      'Step two.',
    ]);
  });

  it('keeps link text and drops URLs', () => {
    expect(markdownToSpeech('See [the docs](https://example.com/docs "Docs") for more.')).toBe(
      'See the docs for more.',
    );
    expect(markdownToSpeech('Use [the guide][g].\n\n[g]: https://example.com')).toBe(
      'Use the guide.',
    );
  });

  it('says "link" instead of reading out a bare URL', () => {
    expect(markdownToSpeech('Visit <https://example.com> or https://other.dev today.')).toBe(
      'Visit link or link today.',
    );
  });

  it('reads image alt text and skips images without one', () => {
    expect(markdownToSpeech('![Build status](https://ci/badge.svg) Ready.')).toBe(
      'image: Build status Ready.',
    );
    expect(markdownToSpeech('![](logo.png)\n\nHello.')).toBe('Hello.');
  });

  it('skips badge images wrapped in links', () => {
    const md =
      '# Tool\n\n[![CI passing](badge.svg)](https://ci) [![npm](npm.svg)](https://npm)\n\nIntro.';
    expect(blocks(md)).toEqual(['Tool.', 'Intro.']);
    expect(markdownToSpeech('[![logo](logo.png) Home](https://x.dev)')).toBe('Home.');
  });

  it('skips fenced and indented code blocks but keeps inline code', () => {
    const md =
      'Install:\n\n```bash\nnpm install\n```\n\n    indented code\n\nThen run `npm start` now.';
    expect(blocks(md)).toEqual(['Install:', 'Then run npm start now.']);
  });

  it('reads table rows with their column headers', () => {
    const md = '| Name | Size |\n| --- | ---: |\n| Small | 10 MB |\n| Large | |';
    expect(blocks(md)).toEqual(['Name, Size.', 'Name: Small, Size: 10 MB.', 'Name: Large.']);
  });

  it('strips inline HTML tags and keeps their text', () => {
    expect(markdownToSpeech('Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to copy.<br>Done.')).toBe(
      'Press Ctrl+C to copy. Done.',
    );
  });

  it('strips HTML blocks and comments', () => {
    const md = '<!-- hidden note -->\n\n<p align="center">\n  <b>Centered</b> text\n</p>\n\nAfter.';
    expect(blocks(md)).toEqual(['Centered text.', 'After.']);
  });

  it('decodes HTML entities', () => {
    expect(markdownToSpeech('Tom &amp; Jerry &mdash; &#169; &#x263A;')).toBe('Tom & Jerry — © ☺.');
  });

  it('reads block quotes and skips horizontal rules', () => {
    expect(blocks('> Quoted words\n\n---\n\nAfter the rule.')).toEqual([
      'Quoted words.',
      'After the rule.',
    ]);
  });

  it('skips YAML front matter', () => {
    expect(markdownToSpeech('---\ntitle: Notes\ntags: [a]\n---\n# Notes\n\nBody.')).toBe(
      'Notes.\n\nBody.',
    );
  });

  it('joins hard-wrapped paragraph lines', () => {
    expect(markdownToSpeech('A long sentence\nthat wraps onto\nthree lines.')).toBe(
      'A long sentence that wraps onto three lines.',
    );
  });

  it('returns an empty string for a file with only code', () => {
    expect(markdownToSpeech('```\ncode\n```')).toBe('');
  });

  it('produces one chunk per block when chunked', () => {
    const chunks = chunkText(markdownToSpeech('# Intro\n\n- one\n- two\n\nLast paragraph.'));
    expect(chunks.map((c) => c.text)).toEqual(['Intro.', 'one.', 'two.', 'Last paragraph.']);
  });
});

describe('detectTextFormat', () => {
  it('detects Markdown by extension', () => {
    expect(detectTextFormat('README.md')).toBe('markdown');
    expect(detectTextFormat('notes.MARKDOWN', 'application/octet-stream')).toBe('markdown');
  });

  it('detects Markdown by MIME type', () => {
    expect(detectTextFormat('notes', 'text/markdown')).toBe('markdown');
  });

  it('treats everything else as plain text', () => {
    expect(detectTextFormat('notes.txt', 'text/plain')).toBe('plain');
    expect(detectTextFormat('notes.md.txt')).toBe('plain');
  });
});

describe('toSpeakableText', () => {
  it('passes plain text through unchanged', () => {
    expect(toSpeakableText('# not a heading\n', 'plain')).toBe('# not a heading\n');
  });

  it('converts Markdown', () => {
    expect(toSpeakableText('# Title', 'markdown')).toBe('Title.');
  });
});
