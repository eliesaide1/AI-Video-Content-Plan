/**
 * AI provider abstraction.
 *
 * Business services in /application depend ONLY on this interface, so swapping
 * or adding a provider later never touches generation logic.
 */
export interface AIService {
  readonly name: string;
  generateText(request: TextRequest): Promise<AIResult<string>>;
  generateStructuredOutput<T>(request: StructuredRequest<T>): Promise<AIResult<T>>;
}

export interface TextRequest {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** Used by the mock provider so the app is runnable without an API key. */
  mock?: () => string;
}

export interface StructuredRequest<T> {
  prompt: string;
  system?: string;
  /** Name of the structure we want back (becomes the tool name). */
  schemaName: string;
  schemaDescription?: string;
  /** JSON Schema describing the expected object. */
  jsonSchema: JsonSchema;
  /** Runtime validation — AI output is never trusted blindly. */
  validate: (raw: unknown) => T;
  maxTokens?: number;
  temperature?: number;
  mock?: () => T;
}

export interface AIResult<T> {
  value: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export type JsonSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
};
