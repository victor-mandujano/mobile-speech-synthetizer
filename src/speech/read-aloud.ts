import type { TextChunk } from '@/text/chunk-text';

export type ReadAloudState =
  | { phase: 'idle'; error: string | null }
  /** Waiting for a chunk's audio: at the start, or when synthesis falls behind playback. */
  | { phase: 'preparing'; chunkIndex: number; chunkCount: number }
  | { phase: 'playing'; chunkIndex: number; chunkCount: number };

/** The audio player, reduced to what the controller needs. */
export type ChunkPlayer = {
  play(uri: string): void;
  stop(): void;
};

export type ReadAloudDeps = {
  /** Synthesizes `text` into a WAV file named `fileName` and resolves with its URI. */
  synthesize(text: string, fileName: string): Promise<string>;
  /** Removes a WAV file that is no longer needed. Must not throw. */
  deleteFile(uri: string): void;
  player: ChunkPlayer;
  onChange(state: ReadAloudState): void;
};

/**
 * Reads a document aloud chunk by chunk: synthesizes the next chunk while the
 * current one plays, and plays the chunks back to back.
 *
 * The owner calls `chunkFinished()` when the player reports the end of a chunk.
 */
export class ReadAloudController {
  private state: ReadAloudState = { phase: 'idle', error: null };
  /** Bumped by every start and stop, so work from an earlier run is ignored when it completes. */
  private run = 0;
  private chunks: TextChunk[] = [];
  private audio = new Map<number, Promise<string>>();
  private playingUri: string | null = null;

  constructor(private readonly deps: ReadAloudDeps) {}

  getState(): ReadAloudState {
    return this.state;
  }

  start(chunks: TextChunk[]): void {
    this.stop();
    if (chunks.length === 0) return;

    this.chunks = chunks;
    void this.playChunk(this.run, 0);
  }

  stop(): void {
    this.run++;
    this.deps.player.stop();
    this.releasePlaying();
    this.discardPending();
    this.chunks = [];
    if (this.state.phase !== 'idle') {
      this.setState({ phase: 'idle', error: null });
    }
  }

  chunkFinished(): void {
    if (this.state.phase !== 'playing') return;
    const next = this.state.chunkIndex + 1;
    this.releasePlaying();
    void this.playChunk(this.run, next);
  }

  private async playChunk(run: number, index: number): Promise<void> {
    const chunkCount = this.chunks.length;
    if (index >= chunkCount) {
      this.setState({ phase: 'idle', error: null });
      return;
    }

    this.setState({ phase: 'preparing', chunkIndex: index, chunkCount });
    let uri: string;
    try {
      uri = await this.audioFor(run, index);
    } catch (cause) {
      if (run !== this.run) return;
      this.stop();
      this.setState({ phase: 'idle', error: describe(cause) });
      return;
    }
    if (run !== this.run) return;

    this.audio.delete(index);
    this.playingUri = uri;
    this.deps.player.play(uri);
    this.setState({ phase: 'playing', chunkIndex: index, chunkCount });

    if (index + 1 < chunkCount) {
      // Synthesize ahead; a failure surfaces when that chunk's turn comes.
      this.audioFor(run, index + 1).catch(() => undefined);
    }
  }

  private audioFor(run: number, index: number): Promise<string> {
    let audio = this.audio.get(index);
    if (!audio) {
      audio = this.deps.synthesize(this.chunks[index].text, `read-aloud-${run}-${index}.wav`);
      this.audio.set(index, audio);
    }
    return audio;
  }

  private releasePlaying(): void {
    if (this.playingUri) {
      this.deps.deleteFile(this.playingUri);
      this.playingUri = null;
    }
  }

  private discardPending(): void {
    // Synthesized but never played: delete each file once its synthesis settles.
    for (const audio of this.audio.values()) {
      audio.then(
        (uri) => this.deps.deleteFile(uri),
        () => undefined,
      );
    }
    this.audio.clear();
  }

  private setState(state: ReadAloudState): void {
    this.state = state;
    this.deps.onChange(state);
  }
}

function describe(cause: unknown): string {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return `Could not synthesize speech: ${detail}`;
}
