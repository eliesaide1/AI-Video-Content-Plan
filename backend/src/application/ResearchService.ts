import { aiService } from '../infrastructure/ai/index.js';
import { documentationFetcher } from '../infrastructure/discovery/DocumentationFetcher.js';
import { AppError } from '../infrastructure/errors/AppError.js';
import { createLogger } from '../infrastructure/logger.js';
import { contentPaths, storageService } from '../infrastructure/storage/index.js';
import {
  ResearchModel,
  ResearchStatus,
  TopicStatus,
  type ResearchDocument,
  type TopicDocument,
} from '../model/index.js';
import { renderMasterMarkdown, renderSourcesMarkdown } from './markdown.js';
import { systemPrompts, userPrompts } from './prompts/index.js';
import { researchJsonSchema, researchResultZ, type ResearchResult } from './schemas.js';
import { topicService } from './TopicService.js';

const log = createLogger('research');

/**
 * Research engine: turns an approved topic into an auditable knowledge base
 * (MASTER.md + SOURCES.md) plus structured claims stored in MongoDB.
 *
 * The markdown is written under the COURSE id, because the course is the unit
 * the rest of the pipeline and the file layout are organised around.
 */
export class ResearchService {
  async research(topic: TopicDocument, courseId: string): Promise<ResearchDocument> {
    const research = await this.upsertRunning(topic, courseId);

    try {
      await topicService.setStatus(topic, TopicStatus.Researching);

      // The tool's own docs are the only trustworthy source of commands and
      // flags. Without them the model fills the gap with plausible inventions.
      const documentation = await documentationFetcher.fetchForTool(topic.toolName, topic.toolUrl);
      if (documentation?.commands.length) {
        log.info(
          `${documentation.commands.length} verified command(s) from ${documentation.sourceUrl}`,
        );
      }

      const { value, model } = await aiService.generateStructuredOutput({
        system: systemPrompts.research,
        prompt: userPrompts.research({
          title: topic.title,
          description: topic.description,
          whatYouWillBuild: topic.whatYouWillBuild,
          toolName: topic.toolName,
          toolUrl: topic.toolUrl,
          measurableOutcome: topic.measurableOutcome,
          documentation,
          context: { audience: topic.audience, depth: topic.desiredDepth },
          sources: topic.sources.map((source) => ({
            title: source.title,
            url: source.url,
            publishedAt: source.publishedAt ?? undefined,
          })),
        }),
        schemaName: 'topic_research',
        schemaDescription: 'Structured research knowledge base for one topic',
        jsonSchema: researchJsonSchema,
        validate: (raw) => researchResultZ.parse(raw),
        temperature: 0.3,
        mock: () => mockResearch(topic.title),
      });

      const masterPath = contentPaths.master(courseId);
      const sourcesPath = contentPaths.sources(courseId);

      await storageService.save(
        masterPath,
        renderMasterMarkdown({
          topicTitle: topic.title,
          audience: topic.audience,
          depth: topic.desiredDepth,
          research: value,
          generatedBy: model,
        }),
      );

      await storageService.save(
        sourcesPath,
        renderSourcesMarkdown({
          topicTitle: topic.title,
          references: value.references,
          topicSources: topic.sources.map((source) => ({
            title: source.title,
            url: source.url,
            origin: source.origin,
            publishedAt: source.publishedAt,
          })),
        }),
      );

      // `set()` is used for the subdocument arrays so Mongoose casts the plain
      // objects produced by the AI into proper subdocuments.
      research.set({
        status: ResearchStatus.Completed,
        summary: value.executiveSummary,
        masterMarkdownPath: masterPath,
        sourcesMarkdownPath: sourcesPath,
        claims: value.claims,
        sources: value.references.map((reference) => ({
          title: reference.title,
          url: reference.url,
          origin: 'research',
          publishedAt: reference.publishedAt ? new Date(reference.publishedAt) : undefined,
          retrievedAt: new Date(),
        })),
        aiModel: model,
        // Kept so the demo can require commands to come from the docs.
        verifiedCommands: documentation?.commands ?? [],
        documentationUrl: documentation?.sourceUrl ?? null,
        error: null,
      });
      await research.save();

      await topicService.setStatus(topic, TopicStatus.Researched);
      log.info(`research completed for topic ${topic.id} -> ${masterPath}`);
      return research;
    } catch (error) {
      research.status = ResearchStatus.Failed;
      research.error = error instanceof Error ? error.message : String(error);
      await research.save();
      await topicService.setStatus(topic, TopicStatus.Approved);
      throw error;
    }
  }

  async getByTopicId(topicId: string): Promise<ResearchDocument> {
    const research = await ResearchModel.findOne({ topicId });
    if (!research) throw AppError.notFound('No research exists for this topic yet.');
    return research;
  }

  async findByCourseId(courseId: string): Promise<ResearchDocument | null> {
    return ResearchModel.findOne({ courseId });
  }

  /** Reads MASTER.md back from storage — used by curriculum/lesson/teaser steps. */
  async readMaster(research: ResearchDocument): Promise<string> {
    if (!research.masterMarkdownPath) {
      throw AppError.badRequest('This topic has no MASTER.md yet. Run research first.');
    }
    return storageService.read(research.masterMarkdownPath);
  }

  private async upsertRunning(topic: TopicDocument, courseId: string): Promise<ResearchDocument> {
    const existing = await ResearchModel.findOne({ topicId: topic._id });
    if (existing) {
      existing.status = ResearchStatus.Running;
      existing.courseId = courseId as unknown as ResearchDocument['courseId'];
      existing.error = null;
      await existing.save();
      return existing;
    }

    return ResearchModel.create({
      topicId: topic._id,
      courseId,
      status: ResearchStatus.Running,
    });
  }
}

export const researchService = new ResearchService();

/** Offline fixture so the pipeline is runnable without an API key. */
function mockResearch(title: string): ResearchResult {
  return researchResultZ.parse({
    executiveSummary: `Mock research for "${title}". Set AI_API_KEY to generate real research.`,
    whyThisMatters: 'Placeholder produced by the offline mock AI provider.',
    targetAudienceNotes: 'Placeholder.',
    prerequisites: ['Basic programming knowledge'],
    coreConcepts: [{ name: 'Core concept', explanation: 'Placeholder explanation.' }],
    terminology: [{ term: 'Placeholder', definition: 'A stand-in value.' }],
    architecture: 'Placeholder architecture description.',
    howItWorks: 'Placeholder mechanics description.',
    practicalExamples: [{ name: 'Example', explanation: 'Placeholder example.' }],
    codeConcepts: [
      {
        title: 'Placeholder snippet',
        language: 'typescript',
        code: 'export const placeholder = true;',
        explanation: 'Replaced by real output once an AI key is configured.',
      },
    ],
    useCases: ['Placeholder use case'],
    advantages: ['Placeholder advantage'],
    limitations: ['Generated by the mock provider, not real research'],
    securityConsiderations: [],
    commonMistakes: ['Shipping mock content as real course material'],
    teachingOpportunities: ['Placeholder demo'],
    exerciseIdeas: ['Placeholder exercise'],
    projectIdeas: ['Placeholder project'],
    claims: [
      {
        statement: 'This document was produced by the offline mock provider.',
        kind: 'assumption',
        sourceUrls: [],
      },
    ],
    references: [],
  });
}
