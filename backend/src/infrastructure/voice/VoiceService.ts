/**
 * Voice abstraction (spec §11).
 *
 * Business code depends only on this interface, so the provider can change
 * without touching generation logic. V1 ships a local implementation because
 * it costs nothing and needs no account; ElevenLabs slots in behind the same
 * interface when a key exists.
 */
export interface VoiceService {
  readonly name: string;
  /** True when this provider can actually produce audio right now. */
  readonly available: boolean;
  generateSpeech(text: string, options?: VoiceOptions): Promise<GeneratedAudio>;
}

export interface VoiceOptions {
  /** Provider-specific voice id or name. */
  voice?: string;
  /** Words per minute, where the provider supports it. */
  rate?: number;
  /** Absolute path the audio should be written to (.mp3). */
  outputPath: string;
}

export interface GeneratedAudio {
  path: string;
  durationSeconds: number;
  voice: string;
  provider: string;
}
