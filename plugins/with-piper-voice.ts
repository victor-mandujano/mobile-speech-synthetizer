/// <reference types="node" />

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { type ConfigPlugin, withDangerousMod } from 'expo/config-plugins';

import { PIPER_VOICE } from '../src/speech/voice.ts';

/**
 * Downloads the Piper voice (once, cached in `assets/models/`, which is gitignored)
 * and copies it into the generated Android project's `app/src/main/assets/models/`,
 * where react-native-sherpa-onnx finds it with `assetModelPath('models/<folder>')`.
 *
 * react-native-sherpa-onnx does not ship an Expo config plugin, so this keeps the
 * voice bundling inside Continuous Native Generation (no hand-edited `android/`).
 */
const withPiperVoice: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const cacheDir = path.join(
        cfg.modRequest.projectRoot,
        'assets',
        'models',
        PIPER_VOICE.folder,
      );
      await ensureVoiceDownloaded(cacheDir);

      const target = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets',
        'models',
        PIPER_VOICE.folder,
      );
      rmSync(target, { recursive: true, force: true });
      mkdirSync(path.dirname(target), { recursive: true });
      cpSync(cacheDir, target, { recursive: true });
      return cfg;
    },
  ]);

async function ensureVoiceDownloaded(cacheDir: string): Promise<void> {
  if (existsSync(path.join(cacheDir, 'tokens.txt'))) {
    return;
  }

  const response = await fetch(PIPER_VOICE.archiveUrl);
  if (!response.ok) {
    throw new Error(
      `Piper voice download failed: HTTP ${response.status} for ${PIPER_VOICE.archiveUrl}`,
    );
  }
  const archive = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash('sha256').update(archive).digest('hex');
  if (sha256 !== PIPER_VOICE.archiveSha256) {
    throw new Error(
      `Piper voice checksum mismatch: expected ${PIPER_VOICE.archiveSha256}, got ${sha256}`,
    );
  }

  const workDir = mkdtempSync(path.join(tmpdir(), 'piper-voice-'));
  try {
    const archivePath = path.join(workDir, 'voice.tar.bz2');
    writeFileSync(archivePath, archive);
    execFileSync('tar', ['-xjf', archivePath, '-C', workDir]);

    const extracted = path.join(workDir, PIPER_VOICE.folder);
    pruneEspeakDictionaries(path.join(extracted, 'espeak-ng-data'));

    rmSync(cacheDir, { recursive: true, force: true });
    mkdirSync(path.dirname(cacheDir), { recursive: true });
    cpSync(extracted, cacheDir, { recursive: true });
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function pruneEspeakDictionaries(espeakDir: string): void {
  const keep = new Set<string>(PIPER_VOICE.espeakDictionaries);
  for (const name of readdirSync(espeakDir)) {
    if (name.endsWith('_dict') && !keep.has(name)) {
      rmSync(path.join(espeakDir, name));
    }
  }
}

export default withPiperVoice;
