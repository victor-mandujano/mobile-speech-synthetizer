import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';

import { MAX_TEXT_FILE_BYTES, pickTextFile, validateText } from '@/files/pick-text-file';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

const mockText = jest.fn<() => Promise<string>>();

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ text: mockText })),
}));

const mockedGetDocument = jest.mocked(getDocumentAsync);

function pickedAsset(overrides: Partial<{ name: string; size: number; mimeType: string }> = {}) {
  return {
    canceled: false as const,
    assets: [
      {
        uri: 'file:///cache/DocumentPicker/notes.txt',
        name: 'notes.txt',
        size: 12,
        mimeType: 'text/plain',
        lastModified: 0,
        ...overrides,
      },
    ],
  };
}

describe('pickTextFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the picker filtered to plain text and copies to cache', async () => {
    mockedGetDocument.mockResolvedValue({ canceled: true, assets: null });
    await pickTextFile();
    expect(mockedGetDocument).toHaveBeenCalledWith({
      type: 'text/plain',
      copyToCacheDirectory: true,
    });
  });

  it('returns canceled when the user backs out', async () => {
    mockedGetDocument.mockResolvedValue({ canceled: true, assets: null });
    await expect(pickTextFile()).resolves.toEqual({ kind: 'canceled' });
  });

  it('reads the picked file', async () => {
    mockedGetDocument.mockResolvedValue(pickedAsset());
    mockText.mockResolvedValue('Hello world.');

    await expect(pickTextFile()).resolves.toEqual({
      kind: 'picked',
      file: { name: 'notes.txt', text: 'Hello world.' },
    });
    expect(File).toHaveBeenCalledWith('file:///cache/DocumentPicker/notes.txt');
  });

  it('rejects a non-text MIME type without reading it', async () => {
    mockedGetDocument.mockResolvedValue(
      pickedAsset({ name: 'a.pdf', mimeType: 'application/pdf' }),
    );
    const result = await pickTextFile();
    expect(result).toMatchObject({ kind: 'error', name: 'a.pdf' });
    expect(mockText).not.toHaveBeenCalled();
  });

  it('rejects files over the size limit', async () => {
    mockedGetDocument.mockResolvedValue(pickedAsset({ size: MAX_TEXT_FILE_BYTES + 1 }));
    const result = await pickTextFile();
    expect(result).toMatchObject({ kind: 'error', message: expect.stringContaining('too large') });
  });

  it('turns a read failure into an error message', async () => {
    mockedGetDocument.mockResolvedValue(pickedAsset());
    mockText.mockRejectedValue(new Error('EACCES'));
    await expect(pickTextFile()).resolves.toEqual({
      kind: 'error',
      name: 'notes.txt',
      message: 'Could not read this file. Try picking it again.',
    });
  });
});

describe('validateText', () => {
  it('rejects empty or whitespace-only files', () => {
    expect(validateText('a.txt', '  \n\t ')).toEqual({
      kind: 'error',
      name: 'a.txt',
      message: 'This file is empty.',
    });
  });

  it('rejects binary content', () => {
    expect(validateText('a.txt', 'PK\u0003\u0004\u0000\u0000')).toMatchObject({ kind: 'error' });
  });

  it('accepts ordinary text', () => {
    expect(validateText('a.txt', 'Hi.')).toEqual({
      kind: 'picked',
      file: { name: 'a.txt', text: 'Hi.' },
    });
  });
});
