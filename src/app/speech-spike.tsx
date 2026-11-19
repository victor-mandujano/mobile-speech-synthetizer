import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { synthesizeToWav, type SynthesisResult } from '@/speech/piper';
import { PIPER_VOICE } from '@/speech/voice';

const SPIKE_SENTENCE =
  'Hello from Repo Reader. This sentence was synthesized on your phone by a Piper voice, with no network connection.';

type Phase = 'idle' | 'synthesizing' | 'error';

export default function SpeechSpikeScreen() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<SynthesisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPlaying = status.playing;

  async function play() {
    setPhase('synthesizing');
    setError(null);
    try {
      const synthesis = await synthesizeToWav(SPIKE_SENTENCE);
      setResult(synthesis);
      setPhase('idle');
      player.replace({ uri: synthesis.wavUri });
      player.play();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPhase('error');
    }
  }

  function stop() {
    player.pause();
    void player.seekTo(0);
  }

  const busy = phase === 'synthesizing';

  return (
    <View style={styles.container}>
      <Text style={styles.sentence}>{SPIKE_SENTENCE}</Text>
      <Text style={styles.caption}>Voice: {PIPER_VOICE.folder}</Text>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={isPlaying ? stop : play}
        style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonDimmed]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{isPlaying ? 'Stop' : 'Play'}</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>Error: {error}</Text> : null}

      {result ? (
        <View style={styles.metrics}>
          {result.modelLoadMs !== null ? <Text>Voice load: {result.modelLoadMs} ms</Text> : null}
          <Text>Synthesis: {result.synthesisMs} ms</Text>
          <Text>
            Audio: {result.audioSeconds.toFixed(2)} s at {result.sampleRate} Hz
          </Text>
          <Text>Real-time factor: {result.realTimeFactor.toFixed(3)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    padding: 24,
  },
  sentence: {
    fontSize: 18,
  },
  caption: {
    opacity: 0.6,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingVertical: 14,
  },
  buttonDimmed: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  error: {
    color: '#C62828',
  },
  metrics: {
    gap: 4,
  },
});
