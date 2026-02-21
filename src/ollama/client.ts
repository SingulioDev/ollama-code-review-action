/**
 * Ollama API client
 */

import type {
  OllamaRequest,
  OllamaResponse,
  OllamaError,
  OllamaHealthResponse,
  OllamaMessage,
} from './types.js';
import type { OllamaConfig } from '../types/config.js';

export class OllamaClient {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: OllamaConfig) {
    this.baseUrl = config.api_url.replace(/\/$/, '');
    this.apiKey = config.api_key;
    this.model = config.model;
    this.temperature = config.temperature;
    this.maxTokens = config.max_tokens;
  }

  /**
   * Check if the Ollama API is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as OllamaHealthResponse;
      return data.status === 'ok' || response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Send a chat completion request
   */
  async chatCompletion(
    messages: OllamaMessage[]
  ): Promise<OllamaResponse> {
    const requestBody: OllamaRequest = {
      model: this.model,
      messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = (await response.json()) as OllamaError;
      throw new Error(
        `Ollama API error: ${error.error?.message || response.statusText}`
      );
    }

    return (await response.json()) as OllamaResponse;
  }

  /**
   * Send a simple prompt and get response
   */
  async prompt(systemPrompt: string, userPrompt: string): Promise<string> {
    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.chatCompletion(messages);
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from Ollama');
    }

    return content;
  }

  /**
   * Send a review request with code context
   */
  async reviewCode(
    systemPrompt: string,
    fileContent: string,
    filePath: string,
    additionalContext?: string
  ): Promise<string> {
    let userPrompt = `File: ${filePath}\n\n\`\`\`\n${fileContent}\n\`\`\``;

    if (additionalContext) {
      userPrompt += `\n\nAdditional context:\n${additionalContext}`;
    }

    return this.prompt(systemPrompt, userPrompt);
  }

  /**
   * Send a batch review request for multiple files
   */
  async reviewBatch(
    systemPrompt: string,
    files: Array<{ path: string; content: string }>
  ): Promise<string> {
    const filesContext = files
      .map((file) => {
        return `File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``;
      })
      .join('\n\n---\n\n');

    return this.prompt(systemPrompt, filesContext);
  }

  /**
   * Generate a fix for an issue
   */
  async generateFix(
    issueDescription: string,
    fileContent: string,
    filePath: string
  ): Promise<string> {
    const systemPrompt = `You are a code fix generator. Given an issue description and code, generate the minimal fix needed.
Return ONLY the fixed code without explanations.`;

    const userPrompt = `Issue: ${issueDescription}\n\nFile: ${filePath}\n\n\`\`\`\n${fileContent}\n\`\`\`\n\nProvide the fixed code:`;

    return this.prompt(systemPrompt, userPrompt);
  }

  /**
   * Parse a structured response (JSON)
   */
  async promptStructured<T>(
    systemPrompt: string,
    userPrompt: string
  ): Promise<T> {
    const enhancedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code fences, just raw JSON.`;

    const response = await this.prompt(enhancedSystemPrompt, userPrompt);

    // Strip markdown code fences if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      return JSON.parse(cleaned) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse Ollama response as JSON: ${error instanceof Error ? error.message : String(error)}\nResponse: ${response}`
      );
    }
  }

  /**
   * Get request headers
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }
}
