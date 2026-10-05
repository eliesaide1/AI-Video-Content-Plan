import { z } from 'zod';
import type { JsonSchema } from '../infrastructure/ai/index.js';

/**
 * The production kit: everything needed to record a 12-20 minute tool-test
 * video, except the recording itself.
 *
 * Modelled on how the channel actually works. Its GPT Image video is five
 * concrete tasks, each with a stated pass condition, and the description ends
 * "by the end you'll know if this model deserves a place in your work". That
 * structure — a test with a verdict — is the spine, not a tutorial.
 */

export const kitTaskZ = z.object({
  /** What the presenter asks the tool to do, in one line. */
  ask: z.string().max(220),
  /** Why this task is worth testing — the thing that usually goes wrong. */
  whyItMatters: z.string().max(300),
  /** What counts as a pass, stated so the viewer can judge it on screen. */
  passCondition: z.string().max(240),
  /** The failure mode to watch for, including unasked-for changes. */
  watchFor: z.string().max(240),
  /** Exactly what to do on camera, in order. */
  steps: z.array(z.string().max(220)).min(2).max(7),
  /** The spoken line, in Levantine Arabic. */
  narrationArabic: z.string().max(700),
});

export const productionKitZ = z.object({
  toolName: z.string().max(120),
  /** "ToolName – what it did for me", Levantine Arabic. */
  titleArabic: z.string().max(200),
  titleEnglish: z.string().max(200),
  /** Three short punches for the thumbnail. */
  thumbnailText: z.string().max(120),
  /** The spoken opening, Levantine Arabic, 20-30 seconds. */
  hookArabic: z.string().max(900),
  /** Who this is for, in the channel's words. */
  audienceNote: z.string().max(300),
  /** What the viewer should be able to decide by the end. */
  verdictQuestion: z.string().max(240),
  /** The tests, in recording order. */
  tasks: z.array(kitTaskZ).min(4).max(7),
  /** Everything to have open and ready before pressing record. */
  setupChecklist: z.array(z.string().max(200)).min(2).max(10),
  /** The closing, Levantine Arabic. */
  closingArabic: z.string().max(900),
  /** The YouTube description, Levantine Arabic, ready to paste. */
  descriptionArabic: z.string().max(2500),
  /** Minutes the finished video should run to. */
  estimatedMinutes: z.number().min(8).max(60),
});
export type ProductionKit = z.infer<typeof productionKitZ>;
export type KitTask = z.infer<typeof kitTaskZ>;

/* --------------------------- JSON Schema --------------------------- */

const str = (description: string) => ({ type: 'string', description });
const strArray = (description: string) => ({ type: 'array', description, items: { type: 'string' } });

export const productionKitJsonSchema: JsonSchema = {
  type: 'object',
  properties: {
    toolName: str('The tool being tested'),
    titleArabic: str(
      'Levantine Arabic, formatted "ToolName – what it did for me". Tool names stay in Latin script.',
    ),
    titleEnglish: str('The same title in English'),
    thumbnailText: str('Three short punches separated by " | "'),
    hookArabic: str(
      'The spoken opening in Levantine Arabic, 20-30 seconds: what you are about to try, and why the viewer should stay',
    ),
    audienceNote: str('Who this is for, e.g. business owners rather than programmers'),
    verdictQuestion: str(
      'The one question the video answers, e.g. "does this deserve a place in your work?"',
    ),
    tasks: {
      type: 'array',
      description: 'The tests, in recording order',
      items: {
        type: 'object',
        properties: {
          ask: str('What you ask the tool to do, in one line'),
          whyItMatters: str('Why this test is worth running — what usually goes wrong here'),
          passCondition: str('What counts as a pass, judged on screen'),
          watchFor: str(
            'The failure to look for, including things that changed without being asked',
          ),
          steps: strArray('Exactly what to do on camera, in order'),
          narrationArabic: str('What to say during this task, Levantine Arabic'),
        },
        required: ['ask', 'whyItMatters', 'passCondition', 'watchFor', 'steps', 'narrationArabic'],
        additionalProperties: false,
      },
    },
    setupChecklist: strArray('What to have installed, open and ready before recording'),
    closingArabic: str('The spoken verdict and call to action, Levantine Arabic'),
    descriptionArabic: str(
      'The YouTube description in Levantine Arabic, ready to paste: what the video covers, the checklist of tasks with check marks, and where the links go',
    ),
    estimatedMinutes: { type: 'number', description: 'Target runtime in minutes' },
  },
  required: [
    'toolName',
    'titleArabic',
    'titleEnglish',
    'thumbnailText',
    'hookArabic',
    'audienceNote',
    'verdictQuestion',
    'tasks',
    'setupChecklist',
    'closingArabic',
    'descriptionArabic',
    'estimatedMinutes',
  ],
  additionalProperties: false,
};
