import { describe, expect, it } from '@jest/globals';

import { chunkText } from '@/text/chunk-text';

const texts = (input: string, maxLength?: number) =>
  chunkText(input, { maxLength }).map((chunk) => chunk.text);

describe('chunkText', () => {
  it('returns no chunks for empty or whitespace-only input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('  \n\t\n  ')).toEqual([]);
  });

  it('splits sentences on . ! and ?', () => {
    expect(texts('Hello there. How are you? I am fine!')).toEqual([
      'Hello there.',
      'How are you?',
      'I am fine!',
    ]);
  });

  it('records the index and the range of each chunk in the original text', () => {
    const input = '  First one.\n\nSecond   one.  ';
    const chunks = chunkText(input);
    expect(chunks).toEqual([
      { index: 0, text: 'First one.', start: 2, end: 12 },
      { index: 1, text: 'Second one.', start: 14, end: 27 },
    ]);
    for (const chunk of chunks) {
      expect(input.slice(chunk.start, chunk.end).replace(/\s+/g, ' ')).toBe(chunk.text);
    }
  });

  it('collapses hard-wrapped lines inside a sentence', () => {
    expect(texts('This sentence was\nwrapped across\r\nthree lines.')).toEqual([
      'This sentence was wrapped across three lines.',
    ]);
  });

  it('reads lines that start with a capital letter as separate phrases', () => {
    expect(
      texts('You are my sunshine\nMy only sunshine\nYou make me happy\nwhen skies are gray'),
    ).toEqual(['You are my sunshine', 'My only sunshine', 'You make me happy when skies are gray']);
  });

  it('treats a blank line as a boundary even without punctuation', () => {
    expect(texts('Chapter One\n\nIt was a dark night.')).toEqual([
      'Chapter One',
      'It was a dark night.',
    ]);
  });

  it('does not split after common abbreviations', () => {
    expect(
      texts('Mr. Smith met Dr. Jones at 5 p.m. on Main St. near the bank. They talked.'),
    ).toEqual(['Mr. Smith met Dr. Jones at 5 p.m. on Main St. near the bank.', 'They talked.']);
  });

  it('does not split after initials or dotted abbreviations', () => {
    expect(
      texts('J. R. R. Tolkien wrote it, e.g. The Hobbit. It sold well in the U.S. Today too.'),
    ).toEqual([
      'J. R. R. Tolkien wrote it, e.g. The Hobbit.',
      'It sold well in the U.S. Today too.',
    ]);
  });

  it('does not split when the next word is lowercase', () => {
    expect(texts('We bought apples, pears, etc. and went home. Done.')).toEqual([
      'We bought apples, pears, etc. and went home.',
      'Done.',
    ]);
  });

  it('keeps decimals, ellipses and closing quotes with their sentence', () => {
    expect(texts('Pi is 3.14 roughly. "Really?" she asked. Wait... What?')).toEqual([
      'Pi is 3.14 roughly.',
      '"Really?" she asked.',
      'Wait...',
      'What?',
    ]);
  });

  it('splits very long sentences at clause breaks within maxLength', () => {
    const input =
      'The first clause is fairly long, the second clause is also long, and the third clause ends it.';
    const chunks = chunkText(input, { maxLength: 40 });
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      'The first clause is fairly long,',
      'the second clause is also long,',
      'and the third clause ends it.',
    ]);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(40);
    }
  });

  it('falls back to word boundaries, then hard cuts, for long runs without clause breaks', () => {
    const words = texts('one two three four five six seven eight nine ten', 15);
    expect(words).toEqual(['one two three', 'four five six', 'seven eight', 'nine ten']);

    const hard = texts('a'.repeat(25), 10);
    expect(hard).toEqual(['a'.repeat(10), 'a'.repeat(10), 'a'.repeat(5)]);
  });

  it('never produces a chunk over maxLength', () => {
    const input = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod. '.repeat(
      20,
    );
    for (const chunk of chunkText(input, { maxLength: 50 })) {
      expect(chunk.text.length).toBeLessThanOrEqual(50);
    }
  });

  it('rejects a maxLength below 1', () => {
    expect(() => chunkText('Hi.', { maxLength: 0 })).toThrow(RangeError);
  });
});
