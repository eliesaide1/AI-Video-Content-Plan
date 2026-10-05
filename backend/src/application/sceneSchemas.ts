import { z } from 'zod';
import type { JsonSchema } from '../infrastructure/ai/index.js';

/**
 * The scene model (spec §9).
 *
 * A teaser beat only carries a sentence, which is why a teaser video can only
 * ever assert things: "manual review = slow" on a card. A scene carries the
 * REAL material — the commands someone types, the output they get back, the
 * before and after numbers — so the renderer can SHOW the problem and the fix
 * instead of describing them.
 *
 * The AI chooses the scene type and fills in the content. It never decides how
 * a scene looks; the Remotion components own that.
 */

const base = {
  durationSeconds: z.number().min(2).max(25),
  narration: z.string().max(900).default(''),
};

/** Opening card: the promise, with the numbers that earn the click. */
export const titleSceneZ = z.object({
  type: z.literal('title'),
  ...base,
  headline: z.string().max(200),
  subhead: z.string().max(240).default(''),
  chips: z.array(z.string().max(40)).max(3).default([]),
});

/** The problem, made concrete: the painful steps, and what they cost today. */
export const problemSceneZ = z.object({
  type: z.literal('problem'),
  ...base,
  headline: z.string().max(200),
  /** The actual manual steps someone performs today. */
  painSteps: z.array(z.string().max(140)).min(2).max(8),
  costLabel: z.string().max(60).default(''),
  costValue: z.string().max(40).default(''),
});

/** A real terminal: commands the viewer types, and what comes back. */
export const terminalSceneZ = z.object({
  type: z.literal('terminal'),
  ...base,
  title: z.string().max(140).default(''),
  lines: z
    .array(
      z.object({
        command: z.string().max(400),
        output: z.array(z.string().max(220)).max(12).default([]),
      }),
    )
    .min(1)
    .max(5),
});

/** Real code, with the lines that matter highlighted. */
export const codeSceneZ = z.object({
  type: z.literal('code'),
  ...base,
  filename: z.string().max(120).default(''),
  language: z.string().max(24).default('typescript'),
  code: z.string().max(3000),
  highlightLines: z.array(z.number().int().min(1)).max(8).default([]),
});

/** Before and after, side by side, with the measured numbers. */
export const comparisonSceneZ = z.object({
  type: z.literal('comparison'),
  ...base,
  headline: z.string().max(200).default(''),
  before: z.object({
    label: z.string().max(60),
    value: z.string().max(40),
    detail: z.string().max(140).default(''),
  }),
  after: z.object({
    label: z.string().max(40),
    value: z.string().max(24),
    detail: z.string().max(90).default(''),
  }),
});

/** What the viewer walks away with. */
export const outcomeSceneZ = z.object({
  type: z.literal('outcome'),
  ...base,
  headline: z.string().max(200),
  bullets: z.array(z.string().max(140)).min(1).max(5),
});

export const ctaSceneZ = z.object({
  type: z.literal('cta'),
  ...base,
  headline: z.string().max(120),
  courseTitle: z.string().max(200).default(''),
});

export const sceneZ = z.discriminatedUnion('type', [
  titleSceneZ,
  problemSceneZ,
  terminalSceneZ,
  codeSceneZ,
  comparisonSceneZ,
  outcomeSceneZ,
  ctaSceneZ,
]);
export type Scene = z.infer<typeof sceneZ>;

export const demoScriptZ = z.object({
  toolName: z.string().max(120).default(''),
  scenes: z.array(sceneZ).min(4).max(12),
});
export type DemoScript = z.infer<typeof demoScriptZ>;

/* --------------------------- JSON Schema --------------------------- */

const str = (description: string) => ({ type: 'string', description });
const num = (description: string) => ({ type: 'number', description });
const strArray = (description: string) => ({ type: 'array', description, items: { type: 'string' } });

/**
 * Anthropic's tool schema does not support discriminated unions well, so every
 * scene is one object with a `type` plus the fields that type uses. The Zod
 * union above is what actually enforces correctness.
 */
const sceneJson = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['title', 'problem', 'terminal', 'code', 'comparison', 'outcome', 'cta'],
      description: 'Which scene this is',
    },
    durationSeconds: num('How long this scene holds, 2-25 seconds'),
    narration: str('What is said out loud over this scene'),

    headline: str('title/problem/comparison/outcome/cta: the line on screen'),
    subhead: str('title only: the second line'),
    chips: strArray('title only: up to 3 very short punches, e.g. "30 MIN -> 4 MIN"'),

    painSteps: strArray(
      'problem only: the actual manual steps someone performs today, 2-6 of them. Concrete actions, not adjectives.',
    ),
    costLabel: str('problem only: what the cost is called, e.g. "per document"'),
    costValue: str('problem only: the cost itself, e.g. "30 min"'),

    title: str('terminal only: a short caption for what is being run'),
    lines: {
      type: 'array',
      description:
        'terminal only: the real commands, in order, with the real output each produces',
      items: {
        type: 'object',
        properties: {
          command: str('The exact command typed, without the $ prompt'),
          output: strArray('The lines that come back. Empty if the command prints nothing.'),
        },
        required: ['command', 'output'],
        additionalProperties: false,
      },
    },

    filename: str('code only: the file being shown'),
    language: str('code only: language identifier'),
    code: str('code only: real, runnable code — no placeholders, no omitted imports'),
    highlightLines: {
      type: 'array',
      description: 'code only: 1-based line numbers to highlight',
      items: { type: 'number' },
    },

    before: {
      type: 'object',
      description: 'comparison only: the situation today',
      properties: {
        label: str('e.g. "By hand"'),
        value: str('The number, e.g. "30 min"'),
        detail: str('One short clarifying line'),
      },
      required: ['label', 'value', 'detail'],
      additionalProperties: false,
    },
    after: {
      type: 'object',
      description: 'comparison only: the situation with the tool',
      properties: {
        label: str('e.g. "With Codex"'),
        value: str('The number, e.g. "4 min"'),
        detail: str('One short clarifying line'),
      },
      required: ['label', 'value', 'detail'],
      additionalProperties: false,
    },

    bullets: strArray('outcome only: 1-4 things the viewer can now do'),
    courseTitle: str('cta only: the course this points at'),
  },
  required: ['type', 'durationSeconds', 'narration'],
  additionalProperties: false,
};

export const demoScriptJsonSchema: JsonSchema = {
  type: 'object',
  properties: {
    toolName: str('The tool this demo is about'),
    scenes: {
      type: 'array',
      description: 'The scenes in order',
      items: sceneJson,
    },
  },
  required: ['toolName', 'scenes'],
  additionalProperties: false,
};

/* ---------------------------- clamping ----------------------------
 * The limits above exist so scenes fit on screen, not because a 45-character
 * label is wrong. Rejecting a whole generation over one is a bad trade: it
 * throws away a minute of work and a slice of the plan's rate limit. Values
 * that overshoot are trimmed to fit instead, which is what the renderer would
 * have done anyway.
 * ------------------------------------------------------------------ */

const STRING_LIMITS: Record<string, number> = {
  narration: 900,
  headline: 200,
  subhead: 240,
  title: 140,
  costLabel: 60,
  costValue: 40,
  filename: 120,
  language: 24,
  code: 3000,
  command: 400,
  label: 60,
  value: 40,
  detail: 140,
  courseTitle: 200,
  toolName: 120,
};

const ARRAY_LIMITS: Record<string, number> = {
  chips: 3,
  painSteps: 8,
  bullets: 5,
  lines: 5,
  output: 12,
  highlightLines: 8,
};

const ITEM_LIMITS: Record<string, number> = {
  chips: 40,
  painSteps: 140,
  bullets: 140,
  output: 220,
};

function trim(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Recursively clamps strings and arrays to what the renderer can display. */
export function clampToLimits(value: unknown, key = ''): unknown {
  if (typeof value === 'string') {
    const max = STRING_LIMITS[key];
    return max ? trim(value, max) : value;
  }

  if (Array.isArray(value)) {
    const max = ARRAY_LIMITS[key];
    const itemMax = ITEM_LIMITS[key];
    const items = value.map((item) =>
      typeof item === 'string' && itemMax ? trim(item, itemMax) : clampToLimits(item, key),
    );
    return max ? items.slice(0, max) : items;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        clampToLimits(childValue, childKey),
      ]),
    );
  }

  return value;
}
