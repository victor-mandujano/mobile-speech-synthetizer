import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { pickTextFile, type PickedTextFile } from '@/files/pick-text-file';
import { useReadAloud } from '@/speech/use-read-aloud';
import { chunkText } from '@/text/chunk-text';
import { toSpeakableText } from '@/text/markdown-to-speech';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; file: PickedTextFile }
  | { status: 'error'; name: string | null; message: string };

export default function HomeScreen() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const readAloud = useReadAloud();
  const file = state.status === 'loaded' ? state.file : null;
  // Markdown is shown and read as speakable text, so chunk offsets match what is on screen.
  const speakableText = useMemo(
    () => (file ? toSpeakableText(file.text, file.format) : ''),
    [file],
  );
  const chunks = useMemo(() => (speakableText ? chunkText(speakableText) : []), [speakableText]);

  async function pick() {
    const previous = state;
    readAloud.stop();
    setState({ status: 'loading' });
    const result = await pickTextFile();
    if (result.kind === 'canceled') {
      setState(previous);
    } else if (result.kind === 'picked') {
      setState({ status: 'loaded', file: result.file });
    } else {
      setState({ status: 'error', name: result.name, message: result.message });
    }
  }

  const loading = state.status === 'loading';
  const speech = readAloud.state;
  const reading = speech.phase !== 'idle';

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: loading }}
        disabled={loading}
        onPress={pick}
        style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonDimmed]}
      >
        <Text style={styles.buttonText}>Pick a .txt or .md file</Text>
      </Pressable>

      {state.status === 'idle' && (
        <View style={styles.centered}>
          <Text style={styles.hint}>
            Choose a text or Markdown file from your phone to see its text.
          </Text>
          <Link href="/speech-spike" style={styles.link}>
            Try on-device speech
          </Link>
        </View>
      )}

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel="Loading file" size="large" />
        </View>
      )}

      {state.status === 'error' && (
        <View style={styles.centered} accessibilityRole="alert">
          {state.name && <Text style={styles.fileName}>{state.name}</Text>}
          <Text style={styles.error}>{state.message}</Text>
        </View>
      )}

      {state.status === 'loaded' && (
        <View style={styles.reader}>
          <Text style={styles.fileName} numberOfLines={1}>
            {state.file.name}
          </Text>
          <View style={styles.player}>
            <Pressable
              accessibilityRole="button"
              onPress={reading ? readAloud.stop : () => readAloud.play(chunks)}
              style={({ pressed }) => [styles.playButton, pressed && styles.buttonDimmed]}
            >
              <Text style={styles.buttonText}>{reading ? 'Stop' : 'Play'}</Text>
            </Pressable>
            <View style={styles.playerStatus}>
              {speech.phase === 'preparing' && (
                <ActivityIndicator accessibilityLabel="Preparing speech" />
              )}
              {reading && (
                <Text style={styles.progress}>
                  Sentence {speech.chunkIndex + 1} of {speech.chunkCount}
                </Text>
              )}
              {speech.phase === 'idle' && speech.error && (
                <Text style={styles.error} accessibilityRole="alert">
                  {speech.error}
                </Text>
              )}
            </View>
          </View>
          <ScrollView style={styles.textBox} contentContainerStyle={styles.textContent}>
            <Text style={styles.text} selectable>
              {speakableText}
            </Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    padding: 16,
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
    fontSize: 16,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
  },
  hint: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  link: {
    marginTop: 16,
    fontSize: 16,
    color: '#208AEF',
  },
  error: {
    color: '#C62828',
    fontSize: 16,
    textAlign: 'center',
  },
  reader: {
    flex: 1,
    gap: 8,
  },
  fileName: {
    fontSize: 18,
    fontWeight: '600',
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    alignItems: 'center',
    backgroundColor: '#208AEF',
    borderRadius: 8,
    minWidth: 96,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  playerStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progress: {
    fontSize: 14,
    opacity: 0.7,
  },
  textBox: {
    flex: 1,
  },
  textContent: {
    paddingBottom: 24,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
});
