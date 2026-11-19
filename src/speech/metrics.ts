/** Length in seconds of `sampleCount` mono samples at `sampleRate` Hz. */
export function audioDurationSeconds(sampleCount: number, sampleRate: number): number {
  if (sampleRate <= 0) {
    throw new RangeError(`sampleRate must be positive, got ${sampleRate}`);
  }
  return sampleCount / sampleRate;
}

/**
 * Real-time factor: seconds spent synthesizing per second of audio produced.
 * Below 1 means the device synthesizes faster than it can be played back.
 */
export function realTimeFactor(synthesisMs: number, audioSeconds: number): number {
  if (audioSeconds <= 0) {
    throw new RangeError(`audioSeconds must be positive, got ${audioSeconds}`);
  }
  return synthesisMs / 1000 / audioSeconds;
}
