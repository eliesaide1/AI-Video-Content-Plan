import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../errors/AppError.js';
import { createLogger } from '../logger.js';
import { probeDuration } from './MacSayVoiceService.js';
import type { GeneratedAudio, VoiceOptions, VoiceService } from './VoiceService.js';

const log = createLogger('voice:elevenlabs');

/**
 * ElevenLabs text-to-speech.
 *
 * Used when VOICE_API_KEY is set. This is the path to a cloned voice: point
 * VOICE_ID at your own voice in the ElevenLabs dashboard and nothing else in
 * the pipeline changes.
 */
export class ElevenLabsVoiceService implements VoiceService {
  readonly name = 'elevenlabs';
  readonly available = true;

  constructor(
    private readonly apiKey: string,
    private readonly defaultVoiceId: string,
    private readonly modelId: string,
  ) {}

  async generateSpeech(text: string, options: VoiceOptions): Promise<GeneratedAudio> {
    const spoken = text.trim();
    if (!spoken) throw AppError.badRequest('There is nothing to speak.');

    const voiceId = options.voice ?? this.defaultVoiceId;
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: spoken,
          model_id: this.modelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      if (response.status === 401) {
        throw AppError.upstream('ElevenLabs rejected VOICE_API_KEY.');
      }
      if (response.status === 429) {
        throw AppError.upstream('ElevenLabs rate limit or quota reached.');
      }
      throw AppError.upstream(`ElevenLabs returned ${response.status}.`, detail.slice(0, 300));
    }

    await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
    await fs.writeFile(options.outputPath, Buffer.from(await response.arrayBuffer()));

    const durationSeconds = await probeDuration(options.outputPath);
    log.info(`${path.basename(options.outputPath)} — ${durationSeconds.toFixed(1)}s (${voiceId})`);

    return { path: options.outputPath, durationSeconds, voice: voiceId, provider: this.name };
  }
}
