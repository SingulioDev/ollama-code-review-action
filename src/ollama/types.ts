/**
 * Ollama API types
 */

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface OllamaResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OllamaChoice[];
  usage?: OllamaUsage;
}

export interface OllamaChoice {
  index: number;
  message: OllamaMessage;
  finish_reason: string | null;
}

export interface OllamaUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OllamaError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

export interface OllamaHealthResponse {
  status: string;
  model?: string;
}
