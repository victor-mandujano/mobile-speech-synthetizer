import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';

import { detectTextFormat, type TextFormat } from '@/text/markdown-to-speech';

/** Files bigger than this are rejected before reading, to keep the UI responsive. */
export const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024;

export type PickedTextFile = {
  name: string;
  text: string;
  format: TextFormat;
};

/**
 * MIME types offered in the picker. Android often labels .md files as
 * application/octet-stream, so that is included and checked by extension after picking.
 */
export const PICKER_TYPES = [
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/octet-stream',
];

const TEXT_EXTENSIONS = /\.(txt|text|md|markdown|mdown|mkd|mkdn)$/i;
const NOT_TEXT_MESSAGE = 'This is not a text file. Pick a .txt or .md file.';

export type PickTextFileResult =
  | { kind: 'canceled' }
  | { kind: 'picked'; file: PickedTextFile }
  | { kind: 'error'; name: string | null; message: string };

/**
 * Opens the system file picker filtered to .txt and .md files, then reads the picked file.
 * Never throws: every failure is returned as a user-facing message.
 */
export async function pickTextFile(): Promise<PickTextFileResult> {
  let name: string | null = null;
  try {
    const result = await getDocumentAsync({ type: PICKER_TYPES, copyToCacheDirectory: true });
    if (result.canceled || result.assets.length === 0) {
      return { kind: 'canceled' };
    }

    const asset = result.assets[0];
    name = asset.name;

    if (asset.mimeType && !asset.mimeType.startsWith('text/') && !TEXT_EXTENSIONS.test(name)) {
      return { kind: 'error', name, message: NOT_TEXT_MESSAGE };
    }
    if (asset.size !== undefined && asset.size > MAX_TEXT_FILE_BYTES) {
      return { kind: 'error', name, message: 'This file is too large to read (over 5 MB).' };
    }

    const text = await new File(asset.uri).text();
    return validateText(name, text, detectTextFormat(name, asset.mimeType));
  } catch {
    return { kind: 'error', name, message: 'Could not read this file. Try picking it again.' };
  }
}

export function validateText(
  name: string,
  text: string,
  format: TextFormat = 'plain',
): PickTextFileResult {
  // A NUL character never appears in real text files; it means binary content.
  if (text.includes('\u0000')) {
    return { kind: 'error', name, message: NOT_TEXT_MESSAGE };
  }
  if (text.trim().length === 0) {
    return { kind: 'error', name, message: 'This file is empty.' };
  }
  return { kind: 'picked', file: { name, text, format } };
}
