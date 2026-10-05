import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { AppError } from '../errors/AppError.js';
import { createLogger } from '../logger.js';
import type { GeneratedAudio, VoiceOptions, VoiceService } from './VoiceService.js';

const run = promisify(execFile);
const log = createLogger('voice:say');

/**
 * macOS speech synthesis via `say`, converted to mp3 with ffmpeg.
 *
 * Chosen for V1 because it is free, local, offline and needs no account — the
 * alternative was no narration at all, which made every video feel
 * unfinished. It is a synthetic voice and sounds like one; the point is that
 * the pipeline is complete and the provider is swappable, not that this is
 * the final voice.
 */
export class MacSayVoiceService implements VoiceService {
  readonly name = 'mac-say';
  readonly available = process.platform === 'darwin';

  constructor(
    private readonly defaultVoice: string,
    private readonly defaultRate: number,
  ) {}

  async generateSpeech(text: string, options: VoiceOptions): Promise<GeneratedAudio> {
    if (!this.available) {
      throw AppError.internal('The local voice provider only runs on macOS.');
    }

    const spoken = text.trim();
    if (!spoken) throw AppError.badRequest('There is nothing to speak.');

    const voice = options.voice ?? this.defaultVoice;
    const rate = options.rate ?? this.defaultRate;
    const outputPath = options.outputPath;
    const aiffPath = `${outputPath}.aiff`;

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    try {
      // Text goes through argv rather than a shell, so punctuation and quotes
      // in narration cannot be interpreted as shell syntax.
      await run('say', ['-v', voice, '-r', String(rate), '-o', aiffPath, spoken]);
      await run('ffmpeg', ['-v', 'error', '-i', aiffPath, '-codec:a', 'libmp3lame', '-q:a', '4', outputPath, '-y']);
    } catch (error) {
      throw AppError.internal(
        `Local speech synthesis failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await fs.rm(aiffPath, { force: true });
    }

    const durationSeconds = await probeDuration(outputPath);
    log.info(`${path.basename(outputPath)} — ${durationSeconds.toFixed(1)}s (${voice})`);

    return { path: outputPath, durationSeconds, voice, provider: this.name };
  }
}

/** Reads the real duration back, which is what the video must be timed to. */
export async function probeDuration(filePath: string): Promise<number> {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds)) {
    throw AppError.internal(`Could not read the duration of ${filePath}`);
  }
  return seconds;
}
