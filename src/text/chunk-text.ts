/** A sentence-sized piece of a document, ready to be synthesized on its own. */
export type TextChunk = {
  /** Position of the chunk in the document, starting at 0. */
  index: number;
  /** Speakable text: whitespace collapsed to single spaces and trimmed. */
  text: string;
  /** Offset of the chunk's first character in the original text. */
  start: number;
  /** Offset just past the chunk's last character in the original text. */
  end: number;
};

export type ChunkOptions = {
  /** Sentences longer than this many characters are split further. */
  maxLength?: number;
};

export const DEFAULT_MAX_CHUNK_LENGTH = 300;

/** Words that end with a period without ending the sentence (lowercase, no trailing period). */
const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'st',
  'mt',
  'vs',
  'etc',
  'inc',
  'ltd',
  'co',
  'corp',
  'no',
  'nos',
  'fig',
  'figs',
  'vol',
  'pp',
  'approx',
  'dept',
  'est',
  'gen',
  'gov',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
]);

/** Sentence-ending punctuation, optionally followed by closing quotes or brackets, then a space or the end. */
const SENTENCE_END = /[.!?…]+["'”’»)\]]*(?=\s|$)/g;
/** A blank line: always ends a sentence, so headings and list items without punctuation stand alone. */
const PARAGRAPH_BREAK = /\n[ \t]*\n/g;
/** Places where a too-long sentence can be split naturally. */
const CLAUSE_BREAK = /[,;:–—](?=\s)/g;

/**
 * Splits plain text into sentence-sized chunks, each carrying its index and its
 * character range in the original text so the player can seek and the reader can highlight.
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const maxLength = options.maxLength ?? DEFAULT_MAX_CHUNK_LENGTH;
  if (maxLength < 1) {
    throw new RangeError(`maxLength must be at least 1, got ${maxLength}`);
  }

  const ranges: [number, number][] = [];
  let sentenceStart = 0;
  for (const boundary of findBoundaries(text)) {
    ranges.push(...splitLong(text, sentenceStart, boundary, maxLength));
    sentenceStart = boundary;
  }
  ranges.push(...splitLong(text, sentenceStart, text.length, maxLength));

  const chunks: TextChunk[] = [];
  for (const [rawStart, rawEnd] of ranges) {
    const trimmed = trimRange(text, rawStart, rawEnd);
    if (!trimmed) continue;
    const [start, end] = trimmed;
    chunks.push({
      index: chunks.length,
      text: text.slice(start, end).replace(/\s+/g, ' '),
      start,
      end,
    });
  }
  return chunks;
}

function findBoundaries(text: string): number[] {
  const boundaries = new Set<number>();

  for (const match of text.matchAll(SENTENCE_END)) {
    if (isSentenceEnd(text, match.index, match[0])) {
      boundaries.add(match.index + match[0].length);
    }
  }
  for (const match of text.matchAll(PARAGRAPH_BREAK)) {
    boundaries.add(match.index + 1);
  }

  return [...boundaries].toSorted((a, b) => a - b);
}

function isSentenceEnd(text: string, index: number, punctuation: string): boolean {
  const next = text.slice(index + punctuation.length).match(/\S/)?.[0];
  // "etc. and so on": a lowercase continuation means the sentence goes on.
  if (next && next !== next.toUpperCase()) return false;

  if (!punctuation.startsWith('.') || punctuation.startsWith('..')) return true;

  const word = text
    .slice(0, index)
    .match(/(\S+)$/)?.[1]
    ?.replace(/^["'“‘([]+/, '');
  if (!word) return true;
  if (ABBREVIATIONS.has(word.toLowerCase())) return false;
  // Initials ("J. R. R. Tolkien") and dotted abbreviations ("e.g.", "U.S.").
  if (/^[A-Za-z]$/.test(word) || /^([A-Za-z]\.)+[A-Za-z]$/.test(word)) return false;
  return true;
}

/** Splits [start, end) into pieces of at most `maxLength` characters (ignoring surrounding whitespace). */
function splitLong(
  text: string,
  start: number,
  end: number,
  maxLength: number,
): [number, number][] {
  const pieces: [number, number][] = [];
  let pieceStart = start;

  while (true) {
    const trimmed = trimRange(text, pieceStart, end);
    if (!trimmed || trimmed[1] - trimmed[0] <= maxLength) break;

    const windowStart = trimmed[0];
    const windowEnd = windowStart + maxLength;
    const cut =
      lastBreak(text, CLAUSE_BREAK, windowStart, windowEnd, maxLength) ??
      lastWhitespace(text, windowStart, windowEnd) ??
      windowEnd;
    pieces.push([pieceStart, cut]);
    pieceStart = cut;
  }

  pieces.push([pieceStart, end]);
  return pieces;
}

/** End offset of the last clause break in the window, if it isn't too close to the window's start. */
function lastBreak(
  text: string,
  pattern: RegExp,
  windowStart: number,
  windowEnd: number,
  maxLength: number,
): number | null {
  const window = text.slice(windowStart, windowEnd);
  let cut: number | null = null;
  for (const match of window.matchAll(pattern)) {
    cut = match.index + match[0].length;
  }
  return cut !== null && cut >= maxLength * 0.4 ? windowStart + cut : null;
}

function lastWhitespace(text: string, windowStart: number, windowEnd: number): number | null {
  // Include the character just past the window: a space there means the window ends on a whole word.
  for (let i = Math.min(windowEnd, text.length - 1); i > windowStart; i--) {
    if (/\s/.test(text[i])) return i;
  }
  return null;
}

function trimRange(text: string, start: number, end: number): [number, number] | null {
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return start < end ? [start, end] : null;
}
