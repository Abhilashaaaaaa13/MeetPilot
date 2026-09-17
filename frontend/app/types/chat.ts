export type ChatRole = "user" | "assistant";

export interface ChatAttachment {
  name: string;
  size: number;
  type: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  attachment?: ChatAttachment;
  createdAt: number;
}

export interface AgentResponse {
  query: string;
  intent: string;
  response: string;
  messages: unknown[];
  tool_calls: unknown[];
}

export interface SendMessagePayload {
  text: string;
  userId: string;
  file?: File | null;
}
