import type { Audience, CourseDepth, CourseLevel } from '../model/enums.js';
import { PROMPT_VERSION } from './prompts/index.js';
import type { CoursePlan, LessonContent, ResearchResult, TeaserScript } from './schemas.js';

/**
 * Markdown writers.
 *
 * Markdown is the human-readable, editable artefact; JSON is what the program
 * consumes. These functions are pure (data in, string out) so they are trivial
 * to test and never touch the filesystem themselves.
 */

const FENCE = '```';

function bullets(items: string[], emptyNote = '_None identified._'): string {
  if (!items.length) return emptyNote;
  return items.map((item) => `- ${item}`).join('\n');
}

function section(title: string, body: string): string {
  return `## ${title}\n\n${body.trim() || '_Not applicable for this topic._'}\n`;
}

function codeBlock(language: string, code: string): string {
  return `${FENCE}${language || 'text'}\n${code.trim()}\n${FENCE}`;
}

const CLAIM_LABELS: Record<string, string> = {
  'verified-fact': 'Verified fact',
  'ai-explanation': 'AI explanation',
  recommendation: 'Recommendation',
  assumption: 'Assumption',
};

export function renderMasterMarkdown(input: {
  topicTitle: string;
  audience: Audience;
  depth: CourseDepth;
  research: ResearchResult;
  generatedBy: string;
}): string {
  const { research } = input;
  const parts: string[] = [];

  parts.push(`# ${input.topicTitle}`);
  parts.push(
    [
      `> Research knowledge base — generated ${new Date().toISOString()}`,
      `> Audience: ${input.audience} · Intended scope: ${input.depth}`,
      `> Model: ${input.generatedBy} · Prompts: ${PROMPT_VERSION}`,
      '>',
      '> Claims in this document are labelled by confidence. Anything not marked',
      '> **Verified fact** has not been confirmed against a primary source.',
    ].join('\n'),
  );

  parts.push(section('Executive Summary', research.executiveSummary));
  parts.push(section('Why This Matters', research.whyThisMatters));
  parts.push(
    section('Target Audience', `${input.audience}\n\n${research.targetAudienceNotes}`),
  );
  parts.push(section('Prerequisites', bullets(research.prerequisites)));

  parts.push(
    section(
      'Core Concepts',
      research.coreConcepts.length
        ? research.coreConcepts
            .map((concept) => `### ${concept.name}\n\n${concept.explanation}`)
            .join('\n\n')
        : '_None identified._',
    ),
  );

  parts.push(
    section(
      'Terminology',
      research.terminology.length
        ? research.terminology.map((entry) => `- **${entry.term}** — ${entry.definition}`).join('\n')
        : '_None identified._',
    ),
  );

  parts.push(section('Architecture', research.architecture));
  parts.push(section('How It Works', research.howItWorks));

  parts.push(
    section(
      'Practical Examples',
      research.practicalExamples.length
        ? research.practicalExamples
            .map((example) => `### ${example.name}\n\n${example.explanation}`)
            .join('\n\n')
        : '_None identified._',
    ),
  );

  parts.push(
    section(
      'Code Concepts',
      research.codeConcepts.length
        ? research.codeConcepts
            .map(
              (concept) =>
                `### ${concept.title}\n\n${codeBlock(concept.language, concept.code)}\n\n${concept.explanation}`,
            )
            .join('\n\n')
        : '_None identified._',
    ),
  );

  parts.push(section('Use Cases', bullets(research.useCases)));
  parts.push(section('Advantages', bullets(research.advantages)));
  parts.push(section('Limitations', bullets(research.limitations)));
  parts.push(section('Security Considerations', bullets(research.securityConsiderations)));
  parts.push(section('Common Mistakes', bullets(research.commonMistakes)));
  parts.push(section('Teaching Opportunities', bullets(research.teachingOpportunities)));
  parts.push(section('Exercise Ideas', bullets(research.exerciseIdeas)));
  parts.push(section('Project Ideas', bullets(research.projectIdeas)));

  parts.push(
    section(
      'Claims & Confidence',
      research.claims.length
        ? research.claims
            .map((claim) => {
              const label = CLAIM_LABELS[claim.kind] ?? claim.kind;
              const sources = claim.sourceUrls.length
                ? ` _(${claim.sourceUrls.join(', ')})_`
                : '';
              return `- **${label}:** ${claim.statement}${sources}`;
            })
            .join('\n')
        : '_No claims recorded._',
    ),
  );

  parts.push(
    section(
      'References',
      research.references.length
        ? research.references
            .map(
              (reference) =>
                `- [${reference.title}](${reference.url})${
                  reference.publishedAt ? ` — published ${reference.publishedAt}` : ''
                }${reference.note ? `\n  ${reference.note}` : ''}`,
            )
            .join('\n')
        : '_No references recorded._',
    ),
  );

  return `${parts.join('\n\n')}\n`;
}

export function renderSourcesMarkdown(input: {
  topicTitle: string;
  references: ResearchResult['references'];
  topicSources: { title: string; url: string; origin?: string | null; publishedAt?: Date | null }[];
}): string {
  const retrievedAt = new Date().toISOString();
  const lines: string[] = [`# Sources — ${input.topicTitle}`, '', `Retrieved: ${retrievedAt}`, ''];

  lines.push('## Sources used by research', '');
  if (input.references.length) {
    for (const reference of input.references) {
      lines.push(
        `- [${reference.title}](${reference.url})`,
        `  - retrieved: ${retrievedAt}`,
        `  - published: ${reference.publishedAt || 'unknown'}`,
        `  - note: ${reference.note || '—'}`,
      );
    }
  } else {
    lines.push('_None recorded._');
  }

  lines.push('', '## Discovery sources attached to the topic', '');
  if (input.topicSources.length) {
    for (const source of input.topicSources) {
      lines.push(
        `- [${source.title}](${source.url})`,
        `  - origin: ${source.origin || 'unknown'}`,
        `  - published: ${source.publishedAt ? source.publishedAt.toISOString() : 'unknown'}`,
      );
    }
  } else {
    lines.push('_The topic was entered manually without sources._');
  }

  return `${lines.join('\n')}\n`;
}

export function renderCourseMarkdown(input: {
  plan: CoursePlan;
  audience: Audience;
  estimatedDurationMinutes: number;
}): string {
  const parts: string[] = [];
  const hours = (input.estimatedDurationMinutes / 60).toFixed(1);

  parts.push(`# ${input.plan.title}`);
  parts.push(
    [
      `**Level:** ${input.plan.level}`,
      `**Audience:** ${input.audience}`,
      `**Estimated Duration:** ${input.estimatedDurationMinutes} minutes (~${hours} h)`,
      `**Sections:** ${input.plan.sections.length}`,
      `**Lessons:** ${input.plan.sections.reduce((total, s) => total + s.lessons.length, 0)}`,
    ].join('  \n'),
  );
  parts.push(section('Description', input.plan.description));
  parts.push(section('Learning Objectives', bullets(input.plan.learningObjectives)));
  parts.push(section('Prerequisites', bullets(input.plan.prerequisites)));

  input.plan.sections.forEach((planSection, sectionIndex) => {
    const sectionNumber = sectionIndex + 1;
    const lessonLines = planSection.lessons
      .map(
        (lesson, lessonIndex) =>
          `### Lesson ${lessonIndex + 1} — ${lesson.title}\n\n` +
          `**Estimated Duration:** ${lesson.estimatedDuration} minutes  \n` +
          `**Objective:** ${lesson.learningObjective || '—'}  \n` +
          `**Concepts:** ${lesson.concepts.length ? lesson.concepts.join(', ') : '—'}`,
      )
      .join('\n\n');

    parts.push(
      `## Section ${sectionNumber} — ${planSection.title}\n\n${planSection.description}\n\n${lessonLines}\n`,
    );
  });

  return `${parts.join('\n\n')}\n`;
}

export function renderLessonMarkdown(input: {
  courseTitle: string;
  sectionTitle: string;
  sectionOrder: number;
  lessonOrder: number;
  estimatedDuration: number;
  content: LessonContent;
}): string {
  const { content } = input;
  const parts: string[] = [];

  parts.push(`# Lesson ${input.lessonOrder} — ${content.title}`);
  parts.push(
    [
      `**Course:** ${input.courseTitle}`,
      `**Section ${input.sectionOrder}:** ${input.sectionTitle}`,
      `**Estimated Duration:** ${input.estimatedDuration} minutes`,
    ].join('  \n'),
  );

  parts.push(section('Learning Objective', content.learningObjective));
  if (content.concepts.length) parts.push(section('Concepts', bullets(content.concepts)));
  parts.push(section('Instructor Explanation', content.instructorExplanation));

  if (content.examples.length) {
    parts.push(
      section(
        'Examples',
        content.examples
          .map((example) => `### ${example.name}\n\n${example.explanation}`)
          .join('\n\n'),
      ),
    );
  }
  if (content.demonstration.trim()) parts.push(section('Demonstration', content.demonstration));
  if (content.code.length) {
    parts.push(
      section(
        'Code',
        content.code
          .map(
            (snippet) =>
              `### ${snippet.title}\n\n${codeBlock(snippet.language, snippet.code)}\n\n${snippet.explanation}`,
          )
          .join('\n\n'),
      ),
    );
  }
  if (content.visualSuggestions.length) {
    parts.push(section('Visual Suggestions', bullets(content.visualSuggestions)));
  }
  if (content.commonMistakes.length) {
    parts.push(section('Common Mistakes', bullets(content.commonMistakes)));
  }
  if (content.summary.trim()) parts.push(section('Summary', content.summary));
  if (content.studentExercise.trim()) {
    parts.push(section('Student Exercise', content.studentExercise));
  }
  if (content.nextLessonTransition.trim()) {
    parts.push(section('Next Lesson Transition', content.nextLessonTransition));
  }

  return `${parts.join('\n\n')}\n`;
}

export function renderTeaserMarkdown(input: {
  courseTitle: string;
  level: CourseLevel;
  audience: Audience;
  script: TeaserScript;
}): string {
  const beats = input.script.beats
    .map(
      (beat) =>
        `### ${beat.startSecond}-${beat.endSecond}s — ${beat.label}\n\n` +
        `**Narration:** ${beat.narration}\n\n` +
        `**On screen:** ${beat.onScreenText || '—'}`,
    )
    .join('\n\n');

  return (
    `# Teaser — ${input.courseTitle}\n\n` +
    `**Duration:** ${input.script.durationSeconds}s  \n` +
    `**Audience:** ${input.audience}  \n` +
    `**Level:** ${input.level}\n\n` +
    `${section('Hook', input.script.hook)}\n` +
    `## Beats\n\n${beats}\n\n` +
    `${section('Call To Action', input.script.callToAction)}`
  );
}
