// Chat Types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
}

// Agent Types
export interface Agent {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  icon: string;
  color: string;
  systemPrompt: string;
}

export interface AgentTask {
  id: string;
  agentId: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  input: string;
  output?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Search Types
export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
  source: string;
  aiSummary?: string;
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  history: string[];
}

// Code Types
export type CodeMode = "generate" | "review" | "explain";

export interface CodeState {
  mode: CodeMode;
  input: string;
  output: string;
  language: string;
  isLoading: boolean;
}

// Settings Types
export interface AppSettings {
  theme: "light" | "dark" | "system";
  language: "ar" | "en";
  responseStyle: "concise" | "detailed";
  enableHaptics: boolean;
}

// API Response Types
export interface AIResponse {
  content: string;
  error?: string;
}

// Manus Agent Types
export interface ManusStep {
  id: number;
  title: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
}

export interface ManusTaskState {
  status: "idle" | "planning" | "executing" | "completed" | "failed";
  steps: ManusStep[];
  currentStepIndex: number;
  finalResult?: string;
  error?: string;
}
