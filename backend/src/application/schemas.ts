import { z } from 'zod';
import type { JsonSchema } from '../infrastructure/ai/index.js';

/**
 * Structured AI outputs.
 *
 * Every AI call whose result is consumed by code has a pair here:
 *   - a JSON Schema sent to the provider (so it returns the right shape), and
 *   - a Zod schema used to validate what actually came back.
 *
 * We never parse free-form natural language into program state.
 */

/* ----------------------------- json helpers ----------------------------- */

const str = (description: string) => ({ type: 'string', description });
const num = (description: string) => ({ type: 'number', description });
const strArray = (description: string) => ({
  type: 'array',
  description,
  items: { type: 'string' },
});
const obj = (
  properties: Record<string, unknown>,
  required: string[],
  description?: string,
): JsonSchema => ({
  type: 'object',
  ...(description ? { description } : {}),
  properties,
  required,
  additionalProperties: false,
});
const objArray = (description: string, item: JsonSchema) => ({
  type: 'array',
  description,
  items: item,
});

/* ------------------------- 1. topic ranking ------------------------- */

export const rankedTopicZ = z.object({
  title: z.string().min(3).max(300),
  description: z.string().max(4000).default(''),
  category: z.string().max(80).default('general'),
  /** The concrete thing the student has working at the end. */
  whatYouWillBuild: z.string().max(1000).default(''),
  /** The specific tool the topic is built around, '' if it is not tool-centric. */
  toolName: z.string().max(120).default(''),
  toolUrl: z.string().max(500).default(''),
  /** Whether that tool is free / open source — a paywalled tool is a weak topic. */
  isFreeOrOpenSource: z.boolean().default(false),
  /** The surprising, quantified payoff: "70% fewer tokens, answers 27x faster". */
  measurableOutcome: z.string().max(500).default(''),
  /** Who or what makes this credible: a known person, company, or established idea. */
  credibilityAnchor: z.string().max(500).default(''),

  /* --- how the topic would actually appear as a video --- */
  /** The title as it would sit under the thumbnail, in Arabic. */
  videoTitleArabic: z.string().max(200).default(''),
  /** The same title in English. */
  videoTitleEnglish: z.string().max(200).default(''),
  /** Three short punches for the thumbnail, e.g. "125B | ONE GPU | 100 tok/s". */
  thumbnailText: z.string().max(120).default(''),
  /** The spoken opener, first five seconds. */
  hookLine: z.string().max(400).default(''),
  /** Who gets value from it, in plain words. */
  whoBenefits: z.string().max(500).default(''),
  /** Why it is worth learning now, grounded in the signals. */
  whyNow: z.string().max(1000).default(''),
  prerequisites: z.array(z.string()).default([]),
  score: z.number().min(0).max(100),
  rankingReasons: z.array(z.string()).default([]),
  sourceUrls: z.array(z.string()).default([]),
  suggestedAudience: z
    .enum([
      'junior-developers',
      'intermediate-developers',
      'advanced-developers',
      'non-technical-users',
      'students',
      'business-users',
    ])
    .default('intermediate-developers'),
  suggestedDepth: z.enum(['short', 'medium', 'large']).default('medium'),
});
export type RankedTopic = z.infer<typeof rankedTopicZ>;

export const rankedTopicsZ = z.object({ topics: z.array(rankedTopicZ).min(1) });
export type RankedTopics = z.infer<typeof rankedTopicsZ>;

const rankedTopicJson = obj(
  {
    title: str(
      'An outcome the student reaches, e.g. "Build a pull-request review bot that comments on your team\'s code". Never a version number, release or changelog.',
    ),
    description: str('2-4 sentences: the problem this solves and how the course solves it'),
    category: str('e.g. ai-agents, frontend, devops, databases, security'),
    whatYouWillBuild: str(
      'The concrete artefact the student has working at the end, in one or two sentences. Must be something they can run on their own machine.',
    ),
    toolName: str(
      'The specific tool this topic is built around, exactly as its authors name it. Empty string only if the topic genuinely is not about a tool.',
    ),
    toolUrl: str('Where to get that tool (repository or official page). Empty string if none.'),
    isFreeOrOpenSource: {
      type: 'boolean',
      description:
        'True only if someone can install and use the tool without paying. Guess conservatively.',
    },
    measurableOutcome: str(
      'The quantified payoff, with the number: "cuts token usage by about 70%", "answers 27x faster", "drops cold starts from 4s to 300ms". Empty string if the signals do not support a number — never invent one.',
    ),
    credibilityAnchor: str(
      'Why a viewer should believe this matters: a known engineer who advocated the idea, a company using it in production, or an established technique it implements. Empty string if there is none.',
    ),
    videoTitleArabic: str(
      'The video title in Arabic, written the way a Levantine creator speaks (not formal MSA). First person, curiosity plus result. Keep tool names, product names and technical terms in Latin script. Example style: "Graphify – جربتها على مشروع كامل وانصدمت بالنتيجة".',
    ),
    videoTitleEnglish: str('The same title in English, equally click-worthy and equally honest.'),
    thumbnailText: str(
      'Three short punches separated by " | ", all caps where natural, that read in under a second on a phone. Put the number in it. Example: "125B | ONE GPU | 100 TOK/S".',
    ),
    hookLine: str(
      'The first five seconds, spoken aloud. State the claim nobody believes, then promise the proof. Two sentences maximum. Example: "Everyone says you need an H100 for this. I ran it on a 4090 — here is the benchmark."',
    ),
    whoBenefits: str('Who gets value from this and how, in plain words'),
    whyNow: str('Why this is worth learning now, grounded in the signals provided'),
    prerequisites: strArray('What the student must already know before starting'),
    score: num(
      '0-100. Below 40 if a student cannot follow it step by step to a working result.',
    ),
    rankingReasons: strArray('3-5 concrete reasons for the score'),
    sourceUrls: strArray('URLs from the provided signals that justify this topic'),
    suggestedAudience: {
      type: 'string',
      enum: [
        'junior-developers',
        'intermediate-developers',
        'advanced-developers',
        'non-technical-users',
        'students',
        'business-users',
      ],
      description: 'Audience this topic best suits',
    },
    suggestedDepth: {
      type: 'string',
      enum: ['short', 'medium', 'large'],
      description: 'How much material the topic genuinely needs',
    },
  },
  [
    'title',
    'description',
    'category',
    'whatYouWillBuild',
    'toolName',
    'toolUrl',
    'isFreeOrOpenSource',
    'measurableOutcome',
    'credibilityAnchor',
    'videoTitleArabic',
    'videoTitleEnglish',
    'thumbnailText',
    'hookLine',
    'whoBenefits',
    'whyNow',
    'prerequisites',
    'score',
    'rankingReasons',
    'sourceUrls',
    'suggestedAudience',
    'suggestedDepth',
  ],
);

export const rankedTopicsJsonSchema: JsonSchema = obj(
  { topics: objArray('The candidate topics, best first', rankedTopicJson) },
  ['topics'],
);

/* --------------------------- 2. research --------------------------- */

const namedExplanationZ = z.object({
  name: z.string(),
  explanation: z.string(),
});
const codeConceptZ = z.object({
  title: z.string(),
  language: z.string().default('text'),
  code: z.string(),
  explanation: z.string().default(''),
});
export const claimZ = z.object({
  statement: z.string(),
  kind: z.enum(['verified-fact', 'ai-explanation', 'recommendation', 'assumption']),
  sourceUrls: z.array(z.string()).default([]),
});
const referenceZ = z.object({
  title: z.string(),
  url: z.string(),
  note: z.string().default(''),
  publishedAt: z.string().default(''),
});

export const researchResultZ = z.object({
  executiveSummary: z.string(),
  whyThisMatters: z.string(),
  targetAudienceNotes: z.string().default(''),
  prerequisites: z.array(z.string()).default([]),
  coreConcepts: z.array(namedExplanationZ).default([]),
  terminology: z.array(z.object({ term: z.string(), definition: z.string() })).default([]),
  architecture: z.string().default(''),
  howItWorks: z.string().default(''),
  practicalExamples: z.array(namedExplanationZ).default([]),
  codeConcepts: z.array(codeConceptZ).default([]),
  useCases: z.array(z.string()).default([]),
  advantages: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  securityConsiderations: z.array(z.string()).default([]),
  commonMistakes: z.array(z.string()).default([]),
  teachingOpportunities: z.array(z.string()).default([]),
  exerciseIdeas: z.array(z.string()).default([]),
  projectIdeas: z.array(z.string()).default([]),
  claims: z.array(claimZ).default([]),
  references: z.array(referenceZ).default([]),
});
export type ResearchResult = z.infer<typeof researchResultZ>;

const namedExplanationJson = obj(
  { name: str('Concept name'), explanation: str('Clear explanation for the target audience') },
  ['name', 'explanation'],
);

export const researchJsonSchema: JsonSchema = obj(
  {
    executiveSummary: str('5-10 sentence summary of the topic'),
    whyThisMatters: str('Why this matters to the target audience right now'),
    targetAudienceNotes: str('How depth/terminology should be adapted for this audience'),
    prerequisites: strArray('What a student must already know'),
    coreConcepts: objArray('The concepts a student must understand', namedExplanationJson),
    terminology: objArray(
      'Key terms',
      obj({ term: str('Term'), definition: str('Short definition') }, ['term', 'definition']),
    ),
    architecture: str('How the technology is structured (markdown allowed)'),
    howItWorks: str('Step-by-step explanation of the mechanics'),
    practicalExamples: objArray('Real, concrete examples', namedExplanationJson),
    codeConcepts: objArray(
      'Code-level concepts worth demonstrating',
      obj(
        {
          title: str('What the snippet shows'),
          language: str('Language identifier, e.g. typescript'),
          code: str('Short, correct, runnable-in-spirit snippet'),
          explanation: str('What the snippet teaches'),
        },
        ['title', 'language', 'code', 'explanation'],
      ),
    ),
    useCases: strArray('Practical use cases'),
    advantages: strArray('Advantages'),
    limitations: strArray('Limitations and trade-offs'),
    securityConsiderations: strArray('Security concerns, empty if not relevant'),
    commonMistakes: strArray('Mistakes learners typically make'),
    teachingOpportunities: strArray('Things that demo well on video'),
    exerciseIdeas: strArray('Student exercises'),
    projectIdeas: strArray('Final project ideas'),
    claims: objArray(
      'Technical claims, each labelled by confidence class. Never label an unsourced claim as verified-fact.',
      obj(
        {
          statement: str('The claim'),
          kind: {
            type: 'string',
            enum: ['verified-fact', 'ai-explanation', 'recommendation', 'assumption'],
            description: 'verified-fact only when a provided source supports it',
          },
          sourceUrls: strArray('Supporting source URLs'),
        },
        ['statement', 'kind', 'sourceUrls'],
      ),
    ),
    references: objArray(
      'Sources used, official/primary first',
      obj(
        {
          title: str('Source title'),
          url: str('Source URL'),
          note: str('Why this source matters'),
          publishedAt: str('Publication date if known, else empty string'),
        },
        ['title', 'url', 'note', 'publishedAt'],
      ),
    ),
  },
  [
    'executiveSummary',
    'whyThisMatters',
    'targetAudienceNotes',
    'prerequisites',
    'coreConcepts',
    'terminology',
    'architecture',
    'howItWorks',
    'practicalExamples',
    'codeConcepts',
    'useCases',
    'advantages',
    'limitations',
    'securityConsiderations',
    'commonMistakes',
    'teachingOpportunities',
    'exerciseIdeas',
    'projectIdeas',
    'claims',
    'references',
  ],
);

/* ------------------------- 3. course plan ------------------------- */

export const plannedLessonZ = z.object({
  title: z.string(),
  learningObjective: z.string().default(''),
  estimatedDuration: z.number().min(1).max(90),
  concepts: z.array(z.string()).default([]),
});
export const plannedSectionZ = z.object({
  title: z.string(),
  description: z.string().default(''),
  lessons: z.array(plannedLessonZ).min(1),
});
export const coursePlanZ = z.object({
  title: z.string(),
  description: z.string(),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  learningObjectives: z.array(z.string()).default([]),
  prerequisites: z.array(z.string()).default([]),
  sections: z.array(plannedSectionZ).min(1),
});
export type CoursePlan = z.infer<typeof coursePlanZ>;

export const coursePlanJsonSchema: JsonSchema = obj(
  {
    title: str('Course title'),
    description: str('What the course covers'),
    level: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced'],
      description: 'Course level',
    },
    learningObjectives: strArray('What the student will be able to do afterwards'),
    prerequisites: strArray('Required prior knowledge'),
    sections: objArray(
      'Sections in teaching order',
      obj(
        {
          title: str('Section title'),
          description: str('What this section covers'),
          lessons: objArray(
            'Lessons in order. Keep each lesson short and focused.',
            obj(
              {
                title: str('Lesson title'),
                learningObjective: str('One sentence: what the lesson teaches'),
                estimatedDuration: num('Minutes, typically 5-20. Never pad to hit a target.'),
                concepts: strArray('Concepts covered in this lesson'),
              },
              ['title', 'learningObjective', 'estimatedDuration', 'concepts'],
            ),
          ),
        },
        ['title', 'description', 'lessons'],
      ),
    ),
  },
  ['title', 'description', 'level', 'learningObjectives', 'prerequisites', 'sections'],
);

/* ------------------------ 4. lesson content ------------------------ */

export const lessonContentZ = z.object({
  title: z.string(),
  learningObjective: z.string().default(''),
  concepts: z.array(z.string()).default([]),
  instructorExplanation: z.string(),
  examples: z.array(namedExplanationZ).default([]),
  demonstration: z.string().default(''),
  code: z.array(codeConceptZ).default([]),
  visualSuggestions: z.array(z.string()).default([]),
  commonMistakes: z.array(z.string()).default([]),
  summary: z.string().default(''),
  studentExercise: z.string().default(''),
  nextLessonTransition: z.string().default(''),
});
export type LessonContent = z.infer<typeof lessonContentZ>;

export const lessonContentJsonSchema: JsonSchema = obj(
  {
    title: str('Lesson title'),
    learningObjective: str('What the student will be able to do after this lesson'),
    concepts: strArray('Concepts taught'),
    instructorExplanation: str(
      'The spoken teaching content, in markdown. This is the core of the lesson.',
    ),
    examples: objArray('Worked examples', namedExplanationJson),
    demonstration: str('What to demonstrate on screen, empty string if not applicable'),
    code: objArray(
      'Code used in the lesson, empty array if not applicable',
      obj(
        {
          title: str('What the code shows'),
          language: str('Language identifier'),
          code: str('The code'),
          explanation: str('Line-level or block-level explanation'),
        },
        ['title', 'language', 'code', 'explanation'],
      ),
    ),
    visualSuggestions: strArray('Diagram/visual ideas for the renderer'),
    commonMistakes: strArray('Mistakes to warn about'),
    summary: str('Short recap'),
    studentExercise: str('A concrete exercise, empty string if not applicable'),
    nextLessonTransition: str('One or two sentences leading into the next lesson'),
  },
  [
    'title',
    'learningObjective',
    'concepts',
    'instructorExplanation',
    'examples',
    'demonstration',
    'code',
    'visualSuggestions',
    'commonMistakes',
    'summary',
    'studentExercise',
    'nextLessonTransition',
  ],
);

/* -------------------------- 5. teaser script -------------------------- */

export const teaserScriptZ = z.object({
  hook: z.string(),
  durationSeconds: z.number().min(15).max(30),
  callToAction: z.string(),
  beats: z
    .array(
      z.object({
        label: z.enum(['hook', 'problem', 'idea', 'outcome', 'call-to-action']),
        startSecond: z.number().min(0),
        endSecond: z.number().min(0),
        narration: z.string(),
        onScreenText: z.string().default(''),
      }),
    )
    .min(3),
});
export type TeaserScript = z.infer<typeof teaserScriptZ>;

export const teaserJsonSchema: JsonSchema = obj(
  {
    hook: str('The first line, designed to stop the scroll'),
    durationSeconds: num('Total duration, between 15 and 30'),
    callToAction: str('Final line inviting the student to the full course'),
    beats: objArray(
      'Beats in order: hook, problem, idea, outcome, call-to-action',
      obj(
        {
          label: {
            type: 'string',
            enum: ['hook', 'problem', 'idea', 'outcome', 'call-to-action'],
            description: 'Which beat this is',
          },
          startSecond: num('Start time in seconds'),
          endSecond: num('End time in seconds'),
          narration: str('What is said out loud — short, spoken language'),
          onScreenText: str('Short on-screen text, a few words'),
        },
        ['label', 'startSecond', 'endSecond', 'narration', 'onScreenText'],
      ),
    ),
  },
  ['hook', 'durationSeconds', 'callToAction', 'beats'],
);
