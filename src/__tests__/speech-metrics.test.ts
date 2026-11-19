import { describe, expect, it } from '@jest/globals';

import { audioDurationSeconds, realTimeFactor } from '@/speech/metrics';

describe('audioDurationSeconds', () => {
  it('divides samples by sample rate', () => {
    expect(audioDurationSeconds(44_100, 22_050)).toBe(2);
  });

  it('rejects a non-positive sample rate', () => {
    expect(() => audioDurationSeconds(100, 0)).toThrow(RangeError);
  });
});

describe('realTimeFactor', () => {
  it('is synthesis seconds per audio second', () => {
    expect(realTimeFactor(500, 2)).toBe(0.25);
  });

  it('rejects empty audio', () => {
    expect(() => realTimeFactor(500, 0)).toThrow(RangeError);
  });
});
