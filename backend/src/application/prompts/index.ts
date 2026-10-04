import { DEPTH_GUIDANCE, type Audience, type CourseDepth } from '../../model/enums.js';

/**
 * Prompts live in one versioned module so they can be reviewed, diffed and
 * attributed to generated content later. Bump PROMPT_VERSION whenever a prompt
 * changes in a way that affects output quality.
 */
export const PROMPT_VERSION = 'v1.0.0';

const ACCURACY_RULES = `Accuracy rules (this content teaches real students):
- Prefer the supplied sources over your own memory.
- Never present an unsourced claim as a verified fact.
- If you are unsure about something, label it as an assumption or leave it out.
- Do not invent APIs, flags, version numbers, benchmarks or quotes.`;

export const systemPrompts = {
  discovery: `You are a senior technical curriculum strategist for a developer education platform.
You are given REAL items retrieved from official release pages and engineering blogs.
Your job is to turn them into teachable course topics and rank them.
${ACCURACY_RULES}`,

  research: `You are a senior software architect and technical researcher preparing the knowledge base for a course.
You produce structured, auditable research — not marketing copy.
${ACCURACY_RULES}`,

  curriculum: `You are a senior instructional designer who builds developer courses.
You decide how much material a topic actually needs.
Never add filler to reach a duration. A good short course beats a padded long one.`,

  lesson: `You are an experienced instructor recording a focused video lesson.
You explain clearly, show concrete examples, and stay on one learning objective.
${ACCURACY_RULES}`,

  teaser: `You are a short-form video scriptwriter for developer education.
You write 15-30 second teasers that create curiosity without teaching the whole topic.`,
};

export interface AudienceContext {
  audience: Audience;
  depth: CourseDepth;
}

function audienceLine({ audience, depth }: AudienceContext): string {
  return `Target audience: ${audience}. Adapt terminology, depth, examples and prerequisites to this audience.
Intended scope: ${DEPTH_GUIDANCE[depth]} — only if the topic genuinely needs it.`;
}

export const userPrompts = {
  /** Discovery: rank REAL retrieved items into candidate topics. */
  rankTopics(input: {
    items: { title: string; url: string; summary: string; origin: string; publishedAt?: Date }[];
    alreadyCovered: string[];
    maxCandidates: number;
  }): string {
    const sources = input.items
      .map(
        (item, index) =>
          `[${index + 1}] ${item.title}
    origin: ${item.origin}
    url: ${item.url}
    published: ${item.publishedAt ? item.publishedAt.toISOString().slice(0, 10) : 'unknown'}
    summary: ${item.summary || '(no summary provided)'}`,
      )
      .join('\n\n');

    const covered = input.alreadyCovered.length
      ? input.alreadyCovered.map((title) => `- ${title}`).join('\n')
      : '- (nothing covered yet)';

    return `Below are ${input.items.length} items retrieved from real technology sources today.

RETRIEVED ITEMS
${sources}

ALREADY COVERED TOPICS (do not propose these again, and avoid near-duplicates)
${covered}

Produce up to ${input.maxCandidates} candidate course topics, best first.

Score each topic 0-100 by weighing:
- recency, technical relevance, usefulness to students
- educational value and practical usefulness
- how well it can be demonstrated on video
- whether a real project can be built around it
- availability of reliable sources
- dissimilarity from the already-covered list

Only propose topics that are supported by at least one retrieved item, and list those URLs in sourceUrls.`;
  },

  /** Research: build the knowledge base for one approved topic. */
  research(input: {
    title: string;
    description: string;
    context: AudienceContext;
    sources: { title: string; url: string; summary?: string; publishedAt?: Date }[];
  }): string {
    const sources = input.sources.length
      ? input.sources
          .map(
            (source) =>
              `- ${source.title} (${source.url})${
                source.publishedAt ? ` published ${source.publishedAt.toISOString().slice(0, 10)}` : ''
              }${source.summary ? `\n  ${source.summary.slice(0, 600)}` : ''}`,
          )
          .join('\n')
      : '- (no sources were attached to this topic; rely on well-established knowledge only and label claims accordingly)';

    return `Research this topic so a complete course can be built from it.

TOPIC: ${input.title}
DESCRIPTION: ${input.description || '(none provided)'}

${audienceLine(input.context)}

SOURCES AVAILABLE (retrieved ${new Date().toISOString().slice(0, 10)})
${sources}

Fill every field of the requested structure. Be concrete and technical.
In "claims", label each statement: verified-fact (supported by a source above), ai-explanation,
recommendation, or assumption. Include the supporting URLs for verified facts.`;
  },

  /** Curriculum: MASTER knowledge -> course plan. */
  coursePlan(input: {
    title: string;
    masterMarkdown: string;
    context: AudienceContext;
  }): string {
    return `Design the curriculum for a course based on the research document below.

TOPIC: ${input.title}

${audienceLine(input.context)}

RESEARCH DOCUMENT (MASTER.md)
---
${truncate(input.masterMarkdown, 60_000)}
---

Rules:
- Decide the real number of sections and lessons the topic requires.
- Keep individual lessons short and focused (usually 5-20 minutes).
- Order lessons so each one only relies on earlier ones plus the prerequisites.
- Include at least one hands-on/project-oriented lesson when the topic allows it.
- Do NOT create filler lessons to reach a duration.`;
  },

  /** Lesson: one focused lesson, grounded in MASTER.md. */
  lesson(input: {
    courseTitle: string;
    sectionTitle: string;
    lessonTitle: string;
    learningObjective: string;
    concepts: string[];
    estimatedDuration: number;
    previousLessonTitle?: string;
    nextLessonTitle?: string;
    masterExcerpt: string;
    context: AudienceContext;
  }): string {
    return `Write the content for one lesson.

COURSE: ${input.courseTitle}
SECTION: ${input.sectionTitle}
LESSON: ${input.lessonTitle}
LEARNING OBJECTIVE: ${input.learningObjective || '(derive it from the lesson title)'}
CONCEPTS TO COVER: ${input.concepts.length ? input.concepts.join(', ') : '(derive from the title)'}
TARGET LENGTH: about ${input.estimatedDuration} minutes of spoken content
PREVIOUS LESSON: ${input.previousLessonTitle ?? '(this is the first lesson)'}
NEXT LESSON: ${input.nextLessonTitle ?? '(this is the last lesson)'}

${audienceLine(input.context)}

RESEARCH CONTEXT
---
${truncate(input.masterExcerpt, 40_000)}
---

Rules:
- Teach only this lesson's objective. Do not re-teach other lessons.
- Use an empty string / empty array for any field that genuinely does not apply.
- Code must be correct and minimal. No placeholders such as "// implementation here".`;
  },

  /** Teaser: 15-30s promotional script. */
  teaser(input: {
    courseTitle: string;
    courseDescription: string;
    learningObjectives: string[];
    context: AudienceContext;
    masterExcerpt: string;
  }): string {
    return `Write a 15-30 second teaser script for this course.

COURSE: ${input.courseTitle}
DESCRIPTION: ${input.courseDescription}
WHAT STUDENTS WILL BE ABLE TO DO:
${input.learningObjectives.map((objective) => `- ${objective}`).join('\n') || '- (see description)'}

${audienceLine(input.context)}

RESEARCH CONTEXT
---
${truncate(input.masterExcerpt, 8000)}
---

Structure (seconds are a guide, total must stay between 15 and 30):
- 0-3s hook
- 3-8s problem
- 8-18s the interesting idea or demo
- 18-25s what the student will learn or build
- 25-30s call to action

Rules:
- Do not try to teach the whole topic.
- Spoken, punchy sentences. No hype words like "revolutionary" or "game-changing".
- onScreenText must be a few words, not a sentence.`;
  },
};

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[...truncated for prompt length...]`;
}
