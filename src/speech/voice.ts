/**
 * The Piper voice bundled into the app.
 *
 * Kept free of React Native imports so the `with-piper-voice` config plugin
 * (which runs in Node during prebuild) can share it with the app code.
 */
export const PIPER_VOICE = {
  /** Folder name under the native `assets/models/` directory. Must not contain dots. */
  folder: 'vits-piper-en_US-lessac-medium-int8',
  /** sherpa-onnx's packaged build of Piper's en_US "lessac" medium voice, int8-quantized. */
  archiveUrl:
    'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-lessac-medium-int8.tar.bz2',
  archiveSha256: 'f1c6d0295cf16087b05f80fdca5b44daca5cd78e2c425d419a42ba34929805f9',
  /** espeak-ng dictionaries to keep; every other language's `*_dict` is pruned to save ~17 MB. */
  espeakDictionaries: ['en_dict'],
} as const;

/** Asset path the sherpa-onnx native module resolves (relative to the native assets root). */
export const PIPER_VOICE_ASSET_PATH = `models/${PIPER_VOICE.folder}`;
