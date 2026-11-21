import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/index';
import { pickTextFile, type PickTextFileResult } from '@/files/pick-text-file';
import type { ReadAloudState } from '@/speech/read-aloud';

jest.mock('@/files/pick-text-file', () => ({
  pickTextFile: jest.fn(),
}));

const mockReadAloud = {
  state: { phase: 'idle', error: null } as ReadAloudState,
  play: jest.fn(),
  stop: jest.fn(),
};

jest.mock('@/speech/use-read-aloud', () => ({
  useReadAloud: () => mockReadAloud,
}));

const mockedPick = jest.mocked(pickTextFile);

function deferred() {
  let resolve!: (value: PickTextFileResult) => void;
  const promise = new Promise<PickTextFileResult>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function pressPick() {
  await fireEvent.press(screen.getByRole('button', { name: 'Pick a .txt file' }));
}

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadAloud.state = { phase: 'idle', error: null };
  });

  it('starts with the pick button and a hint', async () => {
    await render(<HomeScreen />);
    expect(screen.getByRole('button', { name: 'Pick a .txt file' })).toBeTruthy();
    expect(screen.getByText(/Choose a plain text file/)).toBeTruthy();
  });

  it('shows a loading indicator while the file is read', async () => {
    const pending = deferred();
    mockedPick.mockReturnValue(pending.promise);

    await render(<HomeScreen />);
    // Not awaited: the press only settles once the pick resolves.
    const press = pressPick();

    expect(await screen.findByLabelText('Loading file')).toBeTruthy();
    expect(screen.queryByText(/Choose a plain text file/)).toBeNull();
    pending.resolve({ kind: 'canceled' });
    await press;
    expect(await screen.findByText(/Choose a plain text file/)).toBeTruthy();
  });

  it('shows the picked file name and text', async () => {
    mockedPick.mockResolvedValue({
      kind: 'picked',
      file: { name: 'notes.txt', text: 'Hello world.\nSecond line.' },
    });

    await render(<HomeScreen />);
    await pressPick();

    expect(await screen.findByText('notes.txt')).toBeTruthy();
    expect(screen.getByText('Hello world.\nSecond line.')).toBeTruthy();
  });

  it('keeps the current file when the picker is cancelled', async () => {
    mockedPick.mockResolvedValueOnce({
      kind: 'picked',
      file: { name: 'notes.txt', text: 'Hello world.' },
    });
    mockedPick.mockResolvedValueOnce({ kind: 'canceled' });

    await render(<HomeScreen />);
    await pressPick();
    expect(await screen.findByText('notes.txt')).toBeTruthy();

    await pressPick();
    expect(await screen.findByText('notes.txt')).toBeTruthy();
    expect(screen.getByText('Hello world.')).toBeTruthy();
  });

  it('shows the error message for an unreadable file', async () => {
    mockedPick.mockResolvedValue({
      kind: 'error',
      name: 'photo.txt',
      message: 'This is not a plain text file. Pick a .txt file.',
    });

    await render(<HomeScreen />);
    await pressPick();

    expect(
      await screen.findByText('This is not a plain text file. Pick a .txt file.'),
    ).toBeTruthy();
    expect(screen.getByText('photo.txt')).toBeTruthy();
  });

  describe('reading aloud', () => {
    beforeEach(() => {
      mockedPick.mockResolvedValue({
        kind: 'picked',
        file: { name: 'notes.txt', text: 'First sentence. Second sentence.' },
      });
    });

    it('plays the chunked file text', async () => {
      await render(<HomeScreen />);
      await pressPick();
      await fireEvent.press(await screen.findByRole('button', { name: 'Play' }));

      expect(mockReadAloud.play).toHaveBeenCalledWith([
        expect.objectContaining({ index: 0, text: 'First sentence.' }),
        expect.objectContaining({ index: 1, text: 'Second sentence.' }),
      ]);
    });

    it('shows progress and a Stop button while reading', async () => {
      mockReadAloud.state = { phase: 'playing', chunkIndex: 1, chunkCount: 2 };
      await render(<HomeScreen />);
      await pressPick();

      expect(await screen.findByText('Sentence 2 of 2')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
      expect(mockReadAloud.stop).toHaveBeenCalled();
    });

    it('shows a spinner while the next sentence is prepared', async () => {
      mockReadAloud.state = { phase: 'preparing', chunkIndex: 0, chunkCount: 2 };
      await render(<HomeScreen />);
      await pressPick();

      expect(await screen.findByLabelText('Preparing speech')).toBeTruthy();
    });

    it('shows a synthesis error', async () => {
      mockReadAloud.state = { phase: 'idle', error: 'Could not synthesize speech: boom' };
      await render(<HomeScreen />);
      await pressPick();

      expect(await screen.findByText('Could not synthesize speech: boom')).toBeTruthy();
    });

    it('stops reading when another file is picked', async () => {
      await render(<HomeScreen />);
      await pressPick();
      expect(mockReadAloud.stop).toHaveBeenCalled();
    });
  });
});
