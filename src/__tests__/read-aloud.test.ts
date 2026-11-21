import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ReadAloudController, type ReadAloudState } from '@/speech/read-aloud';
import { chunkText } from '@/text/chunk-text';

type Pending = {
  text: string;
  fileName: string;
  resolve(uri: string): void;
  reject(e: Error): void;
};

function setup() {
  const pending: Pending[] = [];
  const states: ReadAloudState[] = [];
  const deps = {
    synthesize: jest.fn(
      (text: string, fileName: string) =>
        new Promise<string>((resolve, reject) => {
          pending.push({ text, fileName, resolve, reject });
        }),
    ),
    deleteFile: jest.fn<(uri: string) => void>(),
    player: { play: jest.fn<(uri: string) => void>(), stop: jest.fn<() => void>() },
    onChange: (state: ReadAloudState) => states.push(state),
  };
  const controller = new ReadAloudController(deps);
  return { controller, deps, pending, states };
}

/** Lets awaited promises inside the controller settle. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

const chunks = chunkText('One. Two. Three.');

describe('ReadAloudController', () => {
  let t: ReturnType<typeof setup>;

  beforeEach(() => {
    t = setup();
  });

  it('starts idle', () => {
    expect(t.controller.getState()).toEqual({ phase: 'idle', error: null });
  });

  it('synthesizes the first chunk, plays it, and synthesizes the next one ahead', async () => {
    t.controller.start(chunks);
    expect(t.controller.getState()).toEqual({ phase: 'preparing', chunkIndex: 0, chunkCount: 3 });
    expect(t.pending.map((p) => p.text)).toEqual(['One.']);

    t.pending[0].resolve('file:///0.wav');
    await flush();

    expect(t.deps.player.play).toHaveBeenCalledWith('file:///0.wav');
    expect(t.controller.getState()).toEqual({ phase: 'playing', chunkIndex: 0, chunkCount: 3 });
    expect(t.pending.map((p) => p.text)).toEqual(['One.', 'Two.']);
  });

  it('plays the chunks back to back and ends idle', async () => {
    t.controller.start(chunks);
    t.pending[0].resolve('file:///0.wav');
    await flush();
    t.pending[1].resolve('file:///1.wav');
    await flush();

    t.controller.chunkFinished();
    await flush();
    expect(t.deps.player.play).toHaveBeenLastCalledWith('file:///1.wav');
    expect(t.deps.deleteFile).toHaveBeenCalledWith('file:///0.wav');
    expect(t.controller.getState()).toEqual({ phase: 'playing', chunkIndex: 1, chunkCount: 3 });

    t.pending[2].resolve('file:///2.wav');
    t.controller.chunkFinished();
    await flush();
    t.controller.chunkFinished();
    await flush();

    expect(t.deps.player.play).toHaveBeenCalledTimes(3);
    expect(t.deps.deleteFile).toHaveBeenCalledWith('file:///2.wav');
    expect(t.controller.getState()).toEqual({ phase: 'idle', error: null });
    expect(t.deps.synthesize).toHaveBeenCalledTimes(3);
  });

  it('waits in preparing when synthesis falls behind playback', async () => {
    t.controller.start(chunks);
    t.pending[0].resolve('file:///0.wav');
    await flush();

    t.controller.chunkFinished();
    await flush();
    expect(t.controller.getState()).toEqual({ phase: 'preparing', chunkIndex: 1, chunkCount: 3 });

    t.pending[1].resolve('file:///1.wav');
    await flush();
    expect(t.deps.player.play).toHaveBeenLastCalledWith('file:///1.wav');
  });

  it('stops immediately and ignores synthesis that finishes afterwards', async () => {
    t.controller.start(chunks);
    t.pending[0].resolve('file:///0.wav');
    await flush();

    t.controller.stop();
    expect(t.deps.player.stop).toHaveBeenCalled();
    expect(t.controller.getState()).toEqual({ phase: 'idle', error: null });
    expect(t.deps.deleteFile).toHaveBeenCalledWith('file:///0.wav');

    t.pending[1].resolve('file:///1.wav');
    await flush();
    expect(t.deps.player.play).toHaveBeenCalledTimes(1);
    expect(t.deps.deleteFile).toHaveBeenCalledWith('file:///1.wav');

    t.controller.chunkFinished();
    await flush();
    expect(t.deps.player.play).toHaveBeenCalledTimes(1);
  });

  it('restarting uses fresh file names so an old run cannot overwrite them', async () => {
    t.controller.start(chunks);
    t.controller.start(chunks);
    expect(t.pending[0].fileName).not.toBe(t.pending[1].fileName);

    t.pending[0].resolve('file:///old.wav');
    t.pending[1].resolve('file:///new.wav');
    await flush();
    expect(t.deps.player.play).toHaveBeenCalledTimes(1);
    expect(t.deps.player.play).toHaveBeenCalledWith('file:///new.wav');
    expect(t.deps.deleteFile).toHaveBeenCalledWith('file:///old.wav');
  });

  it('reports a synthesis error and stops', async () => {
    t.controller.start(chunks);
    t.pending[0].reject(new Error('model missing'));
    await flush();

    expect(t.controller.getState()).toEqual({
      phase: 'idle',
      error: 'Could not synthesize speech: model missing',
    });
    expect(t.deps.player.play).not.toHaveBeenCalled();
  });

  it('does nothing for an empty document', () => {
    t.controller.start([]);
    expect(t.deps.synthesize).not.toHaveBeenCalled();
    expect(t.controller.getState()).toEqual({ phase: 'idle', error: null });
  });
});
