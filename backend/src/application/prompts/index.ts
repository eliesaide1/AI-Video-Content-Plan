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
  discovery: `You design hands-on, project-based courses for a developer education platform.

You are given SIGNALS retrieved from real sources today: engineering write-ups, community
tutorials, trending repositories, stories developers are discussing, and occasionally a major
release. A signal is EVIDENCE that something is worth teaching. A signal is NOT a topic.

Your job is to propose course topics that a student can FOLLOW STEP BY STEP and finish with
something working that they actually benefit from — a tool they use, a feature they ship, a
skill they can apply at work the same week.

The difference you must internalise:
  SIGNAL  "vercel/next.js v16.4.0-canary.59 — misc changes, fix CI break #99581"
  TOPIC   "Add streaming AI responses to a Next.js app so users see output as it is generated"

  SIGNAL  "anthropics/claude-code v2.1.289 — fixed a deny rule on nested shell commands"
  TOPIC   "Build a pull-request review bot that comments on your team's code automatically"

  SIGNAL  "Netflix engineering: how we cut cold starts in our Java services"
  TOPIC   "Diagnose and fix slow cold starts in your own serverless functions"

Nobody will watch a course about a version number. They will watch a course that solves a
problem they have.
${ACCURACY_RULES}`,

  research: `You are a senior software architect and technical researcher preparing the knowledge base for a course.
You produce structured, auditable research — not marketing copy.
${ACCURACY_RULES}`,

  curriculum: `You are a senior instructional designer who builds hands-on developer courses.

Every course you design is a BUILD. The student starts with nothing and ends with a working
result they can use. Each section moves that build forward; each lesson is one step they can
follow on their own machine and verify before moving on.

Theory appears only where it is needed to make the next step make sense — never as its own
opening block of lectures.

You decide how much material a topic actually needs. Never add filler to reach a duration.
A good short course beats a padded long one.`,

  lesson: `You are an experienced instructor recording a focused, hands-on video lesson.

The student is following along at their keyboard. Give them something to DO, show the exact
steps, and tell them how to check it worked before moving on. Explain clearly, stay on one
learning objective, and never leave a step implied.
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
  /** Discovery: synthesise buildable course topics from today's real signals. */
  rankTopics(input: {
    items: {
      title: string;
      url: string;
      summary: string;
      origin: string;
      kind: string;
      publishedAt?: Date;
    }[];
    alreadyCovered: string[];
    maxCandidates: number;
  }): string {
    const sources = input.items
      .map(
        (item, index) =>
          `[${index + 1}] (${item.kind}) ${item.title}
    url: ${item.url}
    published: ${item.publishedAt ? item.publishedAt.toISOString().slice(0, 10) : 'unknown'}
    detail: ${item.summary || '(no summary provided)'}`,
      )
      .join('\n\n');

    const covered = input.alreadyCovered.length
      ? input.alreadyCovered.map((title) => `- ${title}`).join('\n')
      : '- (nothing covered yet)';

    return `Here are ${input.items.length} signals retrieved from real sources today.

SIGNALS
${sources}

ALREADY COVERED (do not propose these again, and avoid near-duplicates)
${covered}

Propose up to ${input.maxCandidates} course topics, best first.

HOW TO FORM A TOPIC
- Read the signals for what they reveal about what developers are doing, struggling with, or
  adopting. Then propose what someone should LEARN TO BUILD because of it.
- Phrase every title as an outcome the student reaches: "Build ...", "Add ... to your app",
  "Automate ...", "Migrate ... to ...", "Debug and fix ...".
- The best topics combine two or more signals, or apply a new capability to an everyday
  problem. A single signal rarely makes a whole course.
- For every topic state exactly what the student will have working at the end, who benefits
  from it, why it is worth learning now, and what they must already know.

REJECT OUTRIGHT — do not propose:
- A version number, release, changelog or patch note as a topic ("X v2.1.3", "what's new in X").
- Company or product announcements where the student builds nothing.
- Internal refactors, CI fixes, dependency bumps, or anything specific to one company's codebase.
- Anything that needs paid, invite-only or unavailable infrastructure to follow along.
- Vague themes with no concrete deliverable ("Understanding AI", "Intro to the cloud").

SCORE 0-100, weighing in this order:
1. Can a student follow it step by step on their own machine and finish with a working result?
2. Is that result genuinely useful to them afterwards?
3. Does it demonstrate well on video (something visibly happens)?
4. Is there a real project to build around it?
5. Recency and relevance of the underlying signals.
6. Reliability of the sources.
7. Dissimilarity from the already-covered list.

A topic that cannot be followed step by step scores below 40 no matter how interesting it is.

Every topic must cite in sourceUrls the signal URLs that justify it.`;
  },

  /** Research: build the knowledge base for one approved topic. */
  research(input: {
    title: string;
    description: string;
    whatYouWillBuild?: string;
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

    return `Research this topic so a complete hands-on course can be built from it.

TOPIC: ${input.title}
DESCRIPTION: ${input.description || '(none provided)'}
WHAT THE STUDENT WILL BUILD: ${input.whatYouWillBuild || '(derive a concrete deliverable from the topic)'}

${audienceLine(input.context)}

SOURCES AVAILABLE (retrieved ${new Date().toISOString().slice(0, 10)})
${sources}

Fill every field of the requested structure. Be concrete and technical.

Bias everything towards what is needed to BUILD the deliverable above: the setup, the moving
parts, the order they come together, what breaks in practice, and how a student verifies each
step worked. Favour things that can be shown happening on screen.

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
- Design the course as one continuous build: section 1 sets up and gets something minimal
  running, every later section adds a working piece, and the final section ships the result.
- Each lesson must be a step the student can perform and verify. Name the step in the title
  where it reads naturally ("Connect the webhook", not "Webhooks in theory").
- Keep individual lessons short and focused (usually 5-20 minutes).
- Order lessons so each one only relies on earlier ones plus the prerequisites.
- Concept-only lessons are allowed only where the next step cannot be understood without them,
  and must stay short.
- End with a lesson where the student has the finished thing working and knows how to extend it.
- Decide the real number of sections and lessons the topic requires. Do NOT create filler
  lessons to reach a duration.`;
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
- Assume the student is following along: give the concrete steps in order, and say how they
  confirm the step worked before continuing.
- Code must be correct, minimal and runnable as written. No placeholders such as
  "// implementation here" and no omitted imports.
- Use an empty string / empty array for any field that genuinely does not apply.`;
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
