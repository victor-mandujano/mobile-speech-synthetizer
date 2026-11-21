import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SpeechSpikeScreen from '@/app/speech-spike';
import { synthesizeToWav } from '@/speech/piper';

const mockPlayer = {
  replace: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
};

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => ({ playing: false }),
}));

jest.mock('@/speech/piper', () => ({
  synthesizeToWav: jest.fn(),
}));

const mockedSynthesize = jest.mocked(synthesizeToWav);

describe('SpeechSpikeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('synthesizes the sentence, plays the WAV and shows the real-time factor', async () => {
    mockedSynthesize.mockResolvedValue({
      wavUri: 'file:///cache/piper-spike.wav',
      modelLoadMs: 1200,
      synthesisMs: 800,
      audioSeconds: 4,
      realTimeFactor: 0.2,
      sampleRate: 22_050,
    });

    await render(<SpeechSpikeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));

    expect(await screen.findByText('Real-time factor: 0.200')).toBeTruthy();
    expect(mockedSynthesize).toHaveBeenCalledWith(
      expect.stringContaining('Hello from Repo Reader'),
    );
    expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: 'file:///cache/piper-spike.wav' });
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it('shows the error when synthesis fails', async () => {
    mockedSynthesize.mockRejectedValue(new Error('model not found'));

    await render(<SpeechSpikeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));

    expect(await screen.findByText('Error: model not found')).toBeTruthy();
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });
});
