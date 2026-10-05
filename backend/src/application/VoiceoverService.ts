import path from 'node:path';
import { config } from '../infrastructure/config.js';
import { AppError } from '../infrastructure/errors/AppError.js';
import { createLogger } from '../infrastructure/logger.js';
import { contentPaths, storageService } from '../infrastructure/storage/index.js';
import { voiceService } from '../infrastructure/voice/index.js';

const log = createLogger('voiceover');

export interface VoiceoverResult {
  scenesPath: string;
  audioDir: string;
  clips: number;
  totalSeconds: number;
  provider: string;
  voice: string;
}

/** Breathing room after a line finishes before the scene cuts. */
const TAIL_PADDING_SECONDS = 0.6;

/**
 * Narrates a demo script.
 *
 * The important detail is timing: a scene's written duration is a guess, and
 * the narration is however long it actually is. Rather than clip the audio,
 * each scene is stretched to fit its own line plus a short tail. The video
 * then follows the voice instead of the voice chasing the video.
 */
export class VoiceoverService {
  async generateForDemo(courseId: string): Promise<VoiceoverResult> {
    const scenesPath = contentPaths.demoScenes(courseId);
    if (!(await storageService.exists(scenesPath))) {
      throw AppError.badRequest('Generate the demo scenes before adding voice.');
    }

    const script = JSON.parse(await storageService.read(scenesPath)) as {
      scenes: { narration?: string; durationSeconds: number; audioPath?: string }[];
    };

    let clips = 0;
    let provider = voiceService.name;
    let voice = '';

    for (const [index, scene] of script.scenes.entries()) {
      const narration = (scene.narration ?? '').trim();
      if (!narration) continue;

      const relativePath = contentPaths.sceneAudio(courseId, index + 1);
      const absolutePath = path.join(config.storage.generatedRoot, relativePath);

      const audio = await voiceService.generateSpeech(narration, { outputPath: absolutePath });

      // The scene lasts as long as the line takes, never less.
      const required = audio.durationSeconds + TAIL_PADDING_SECONDS;
      if (required > scene.durationSeconds) {
        log.info(
          `scene ${index + 1}: ${scene.durationSeconds}s → ${required.toFixed(1)}s to fit narration`,
        );
      }
      scene.durationSeconds = Math.max(scene.durationSeconds, Number(required.toFixed(2)));
      scene.audioPath = relativePath;

      provider = audio.provider;
      voice = audio.voice;
      clips += 1;
    }

    const totalSeconds = script.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
    await storageService.save(
      scenesPath,
      `${JSON.stringify({ ...script, totalSeconds, voiceProvider: provider, voice }, null, 2)}\n`,
    );

    log.info(`course ${courseId}: ${clips} clip(s), ${totalSeconds.toFixed(0)}s total (${provider})`);

    return {
      scenesPath,
      audioDir: `courses/${courseId}/audio`,
      clips,
      totalSeconds: Number(totalSeconds.toFixed(2)),
      provider,
      voice,
    };
  }

  /**
   * Narrates the three cards that get cut into a screen recording.
   *
   * Arabic, because that is what the presenter speaks — the macOS voice is
   * picked per language, since reading Arabic with an English voice produces
   * nothing usable.
   */
  async generateForKit(courseId: string): Promise<{ clips: { segment: string; path: string; seconds: number }[] }> {
    const kitPath = contentPaths.productionKitJson(courseId);
    if (!(await storageService.exists(kitPath))) {
      throw AppError.badRequest('Generate the production kit before narrating it.');
    }

    const kit = JSON.parse(await storageService.read(kitPath)) as {
      hookArabic: string;
      verdictQuestion: string;
      tasks: { ask: string }[];
      closingArabic: string;
    };

    const lines: { segment: string; text: string }[] = [
      { segment: 'intro', text: kit.hookArabic },
      {
        segment: 'scoreboard',
        // Reading the test list aloud is what makes the scoreboard a moment
        // rather than a wall of text.
        text: kit.tasks.map((task, index) => `${index + 1}. ${task.ask}`).join('. '),
      },
      { segment: 'outro', text: kit.verdictQuestion },
    ];

    const clips: { segment: string; path: string; seconds: number }[] = [];

    for (const line of lines) {
      if (!line.text?.trim()) continue;
      const relativePath = contentPaths.segmentAudio(courseId, line.segment);
      const absolutePath = path.join(config.storage.generatedRoot, relativePath);
      const audio = await voiceService.generateSpeech(line.text, {
        outputPath: absolutePath,
        voice: config.voice.apiKey ? undefined : config.voice.localVoiceArabic,
      });
      clips.push({ segment: line.segment, path: relativePath, seconds: audio.durationSeconds });
    }

    log.info(`kit narration for ${courseId}: ${clips.map((c) => `${c.segment} ${c.seconds.toFixed(1)}s`).join(', ')}`);
    return { clips };
  }
}

export const voiceoverService = new VoiceoverService();
