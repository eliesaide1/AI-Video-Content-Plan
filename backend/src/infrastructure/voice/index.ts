import { config } from '../config.js';
import { createLogger } from '../logger.js';
import { ElevenLabsVoiceService } from './ElevenLabsVoiceService.js';
import { MacSayVoiceService } from './MacSayVoiceService.js';
import type { VoiceService } from './VoiceService.js';

const log = createLogger('voice');

function createVoiceService(): VoiceService {
  if (config.voice.apiKey) {
    log.info(`voice provider: elevenlabs (${config.voice.voiceId})`);
    return new ElevenLabsVoiceService(
      config.voice.apiKey,
      config.voice.voiceId,
      config.voice.model,
    );
  }

  log.info(`voice provider: mac-say (${config.voice.localVoice}) — set VOICE_API_KEY for ElevenLabs`);
  return new MacSayVoiceService(config.voice.localVoice, config.voice.localRate);
}

export const voiceService: VoiceService = createVoiceService();
export type { VoiceService, VoiceOptions, GeneratedAudio } from './VoiceService.js';
