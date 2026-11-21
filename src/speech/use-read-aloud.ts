import { useAudioPlayer } from 'expo-audio';
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';

import type { TextChunk } from '@/text/chunk-text';

import { synthesizeToWav } from './piper';
import { ReadAloudController, type ReadAloudState } from './read-aloud';

function deleteFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best effort: the cache directory is cleaned up by the OS anyway.
  }
}

/** Reads text chunks aloud with the bundled Piper voice. Playback stops when the screen unmounts. */
export function useReadAloud() {
  const player = useAudioPlayer(null);
  const [state, setState] = useState<ReadAloudState>({ phase: 'idle', error: null });
  // Created once: `useAudioPlayer(null)` keeps returning the same player.
  const [controller] = useState(
    () =>
      new ReadAloudController({
        synthesize: async (text, fileName) => (await synthesizeToWav(text, fileName)).wavUri,
        deleteFile,
        player: {
          play: (uri) => {
            player.replace({ uri });
            player.play();
          },
          stop: () => {
            try {
              player.pause();
            } catch {
              // The player is already released when the screen unmounts.
            }
          },
        },
        onChange: setState,
      }),
  );

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) controller.chunkFinished();
    });
    return () => {
      subscription.remove();
      controller.stop();
    };
  }, [player, controller]);

  return {
    state,
    play: (chunks: TextChunk[]) => controller.start(chunks),
    stop: () => controller.stop(),
  };
}
