import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';

/** Files bigger than this are rejected before reading, to keep the UI responsive. */
export const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024;

export type PickedTextFile = {
  name: string;
  text: string;
};

export type PickTextFileResult =
  | { kind: 'canceled' }
  | { kind: 'picked'; file: PickedTextFile }
  | { kind: 'error'; name: string | null; message: string };

/**
 * Opens the system file picker filtered to plain text, then reads the picked file.
 * Never throws: every failure is returned as a user-facing message.
 */
export async function pickTextFile(): Promise<PickTextFileResult> {
  let name: string | null = null;
  try {
    const result = await getDocumentAsync({ type: 'text/plain', copyToCacheDirectory: true });
    if (result.canceled || result.assets.length === 0) {
      return { kind: 'canceled' };
    }

    const asset = result.assets[0];
    name = asset.name;

    if (asset.mimeType && !asset.mimeType.startsWith('text/')) {
      return { kind: 'error', name, message: 'This is not a plain text file. Pick a .txt file.' };
    }
    if (asset.size !== undefined && asset.size > MAX_TEXT_FILE_BYTES) {
      return { kind: 'error', name, message: 'This file is too large to read (over 5 MB).' };
    }

    const text = await new File(asset.uri).text();
    return validateText(name, text);
  } catch {
    return { kind: 'error', name, message: 'Could not read this file. Try picking it again.' };
  }
}

export function validateText(name: string, text: string): PickTextFileResult {
  // A NUL character never appears in real text files; it means binary content.
  if (text.includes('\u0000')) {
    return { kind: 'error', name, message: 'This is not a plain text file. Pick a .txt file.' };
  }
  if (text.trim().length === 0) {
    return { kind: 'error', name, message: 'This file is empty.' };
  }
  return { kind: 'picked', file: { name, text } };
}
