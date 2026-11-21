import { CachesDirectoryPath } from '@dr.pogodin/react-native-fs';
import { assetModelPath } from 'react-native-sherpa-onnx';
import { createTTS, saveAudioToFile, type TtsEngine } from 'react-native-sherpa-onnx/tts';

import { audioDurationSeconds, realTimeFactor } from './metrics';
import { PIPER_VOICE_ASSET_PATH } from './voice';

export type SynthesisResult = {
  /** `file://` URI of the generated WAV, ready for an audio player. */
  wavUri: string;
  /** Time to load the voice (first call only; includes copying it out of the APK on first launch). */
  modelLoadMs: number | null;
  synthesisMs: number;
  audioSeconds: number;
  realTimeFactor: number;
  sampleRate: number;
};

let enginePromise: Promise<TtsEngine> | null = null;
let pendingModelLoadMs: number | null = null;

function getEngine(): Promise<TtsEngine> {
  if (!enginePromise) {
    const startedAt = Date.now();
    enginePromise = createTTS({
      modelPath: assetModelPath(PIPER_VOICE_ASSET_PATH),
      modelType: 'vits',
      numThreads: 2,
    }).then(
      (engine) => {
        pendingModelLoadMs = Date.now() - startedAt;
        return engine;
      },
      (error: unknown) => {
        enginePromise = null;
        throw error;
      },
    );
  }
  return enginePromise;
}

/** Synthesizes `text` with the bundled Piper voice into a WAV file in the app cache. */
export async function synthesizeToWav(text: string): Promise<SynthesisResult> {
  const engine = await getEngine();
  const modelLoadMs = pendingModelLoadMs;
  pendingModelLoadMs = null;

  const startedAt = Date.now();
  const audio = await engine.generateSpeech(text);
  const synthesisMs = Date.now() - startedAt;

  const audioSeconds = audioDurationSeconds(audio.samples.length, audio.sampleRate);
  const path = await saveAudioToFile(audio, `${CachesDirectoryPath}/piper-spike.wav`);

  return {
    wavUri: path.startsWith('file://') ? path : `file://${path}`,
    modelLoadMs,
    synthesisMs,
    audioSeconds,
    realTimeFactor: realTimeFactor(synthesisMs, audioSeconds),
    sampleRate: audio.sampleRate,
  };
}
