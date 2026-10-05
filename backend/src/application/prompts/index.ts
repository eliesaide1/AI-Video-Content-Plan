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

THE SHAPE THAT WORKS BEST
The strongest topic is a specific free tool, run on a real project, with a surprising
measurable result. Here is a real example of the format, broken into its parts:

  "Graphify — I ran it on a whole project and the result shocked me"
    TOOL         Graphify, free and open source (github.com/safishamsi/graphify)
    WHAT IT DOES turns any project folder into a knowledge graph an AI can search,
                 instead of re-reading raw files every time
    CREDIBILITY  it implements the idea Karpathy has been advocating
    RESULT       about 70% fewer tokens, answers roughly 27x faster
    PROOF        the presenter runs it on a complete real project, on camera

Four parts make that work, and you should aim for all four:
  1. A NAMED TOOL the viewer can install today, ideally free or open source.
  2. A REAL PROJECT it is applied to — not a toy example.
  3. A CREDIBILITY ANCHOR: a known engineer, a company running it, or an established idea.
  4. A MEASURABLE RESULT with an actual number. The number is the hook.

A topic with all four is the best thing you can propose. Prefer a tool nobody has covered yet
over a famous one everybody already knows.

PACKAGE EVERY TOPIC AS A VIDEO
A topic is not finished until you can see it on a thumbnail. For each one also write the
title, the thumbnail text and the spoken hook, so a human can judge in two seconds whether it
would get watched. Taking the same real example apart:

  TITLE (ar)  "Graphify – جربتها على مشروع كامل وانصدمت بالنتيجة"
  TITLE (en)  "Graphify — I ran it on a whole project and the result shocked me"
  THUMBNAIL   "70% LESS TOKENS | 27X FASTER | FREE"
  HOOK        "Everyone re-feeds their whole codebase to the AI every time.
               I turned mine into a graph instead — watch what happened to the token count."

What makes that work:
- First person and specific. "I ran it on a whole project", not "a guide to knowledge graphs".
- Curiosity plus a result. The viewer knows what they will see AND wants to know the number.
- The number lives in the thumbnail, because that is what stops the scroll.
- The hook names the thing everybody does wrong, then promises proof.

Honesty rules, which matter more than the click:
- Never promise a number the sources do not support. If measurableOutcome is empty, the
  thumbnail sells the capability instead ("RUNS OFFLINE | NO API KEY | FREE").
- Never imply a result the viewer will not actually reach by following along.
- No "nobody is talking about this", no fake urgency, no invented authority.

The difference you must internalise:
  SIGNAL  "vercel/next.js v16.4.0-canary.59 — misc changes, fix CI break #99581"
  TOPIC   "Add streaming AI responses to a Next.js app so users see output as it is generated"

  SIGNAL  "anthropics/claude-code v2.1.289 — fixed a deny rule on nested shell commands"
  TOPIC   "Build a pull-request review bot that comments on your team's code automatically"

  SIGNAL  "Netflix engineering: how we cut cold starts in our Java services"
  TOPIC   "Diagnose and fix slow cold starts in your own serverless functions"

Nobody will watch a course about a version number. They will watch a course that hands them a
tool, shows it working on something real, and proves it was worth their time.
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
- Look hardest at the "new-tool" and "tool-launch" signals. Those are free tools that did not
  exist a few months ago, and "here is a new free tool, watch it work on a real project" is the
  format we want most.
- For a tool-centric topic, fill in toolName, toolUrl and isFreeOrOpenSource, and say in
  whatYouWillBuild what real project the viewer applies it to.
- measurableOutcome is the hook. Take the number from the signals — a README's own benchmark,
  a star count, a stated speedup, a cost saving. If the signals contain no number, leave it
  empty. NEVER invent a number; a fabricated benchmark in educational content is unforgivable.
- credibilityAnchor is why a viewer should believe it: the known engineer behind the idea, a
  company using it, or the established technique it implements. Leave empty if there is none.
- Non-tool topics are still allowed when the signals point at a real problem worth solving,
  but they need a strong reason to beat a good tool topic.
- Phrase every title as an outcome the viewer reaches: "Build ...", "Add ... to your app",
  "Automate ...", "Run ... on your own hardware", "Cut ... by ...".
- The best topics combine two or more signals, or apply a new capability to an everyday
  problem.
- For every topic state exactly what the student will have working at the end, who benefits
  from it, why it is worth learning now, and what they must already know.
- Write videoTitleArabic, videoTitleEnglish, thumbnailText and hookLine for every topic,
  following the packaging rules above. The Arabic title should read like spoken Levantine, with
  tool names left in Latin script.

REJECT OUTRIGHT — do not propose:
- A version number, release, changelog or patch note as a topic ("X v2.1.3", "what's new in X").
- Company or product announcements where the student builds nothing.
- Internal refactors, CI fixes, dependency bumps, or anything specific to one company's codebase.
- Anything that needs paid, invite-only or unavailable infrastructure to follow along.
- Vague themes with no concrete deliverable ("Understanding AI", "Intro to the cloud").

SCORE 0-100, weighing in this order:
1. Can a viewer follow it step by step on their own machine and finish with a working result?
2. Is that result genuinely useful to them afterwards?
3. Does it demonstrate well on video (something visibly happens, with a number at the end)?
4. Is it built around a specific free tool they can install today?
5. Recency: is this tool or technique new enough that few people have covered it?
6. Reliability of the sources.
7. Dissimilarity from the already-covered list.

Calibration:
- All four parts of the winning shape (free tool + real project + credibility + a real number): 85-95.
- A free tool applied to a real project, but no hard number: 70-84.
- A genuinely useful build with no specific tool behind it: 55-69.
- Cannot be followed step by step to a working result: below 40, no matter how interesting.

Every topic must cite in sourceUrls the signal URLs that justify it.`;
  },

  /** Research: build the knowledge base for one approved topic. */
  research(input: {
    title: string;
    description: string;
    whatYouWillBuild?: string;
    toolName?: string;
    toolUrl?: string;
    measurableOutcome?: string;
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
${
  input.toolName
    ? `TOOL AT THE CENTRE: ${input.toolName}${input.toolUrl ? ` (${input.toolUrl})` : ''}
Research the tool itself as well as the topic: how to install it, how to run it on a real
project, what its own documentation claims, where it breaks, and what it does NOT do.
${input.measurableOutcome ? `CLAIMED RESULT TO VERIFY: ${input.measurableOutcome} — say plainly whether the sources support this number, and how a viewer could measure it themselves.` : ''}`
    : ''
}

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
