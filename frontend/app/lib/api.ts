const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface McpConnection {
  id: string;
  name: string;
  connected: boolean;
}

export interface AgentDoneResponse {
  status: "done";
  query: string;
  response: string;
  messages: string[];
  tool_calls: string[];
}

export interface AgentAwaitingConfirmationResponse {
  status: "awaiting_confirmation";
  thread_id: string;
  pending_tool: string;
  pending_args: Record<string, unknown>;
  message: string;
}

export type AgentResponse = AgentDoneResponse | AgentAwaitingConfirmationResponse;

export async function getConnections(userId: string): Promise<McpConnection[]> {
  const res = await fetch(`${API_BASE}/connections?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error("Failed to load MCP connections.");
  return res.json();
}

export function getConnectUrl(service: string, userId: string): string {
  return `${API_BASE}/connect/${service}?user_id=${encodeURIComponent(userId)}`;
}

export async function disconnectService(service: string, userId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/connect/${service}?user_id=${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to disconnect.");
}

export async function sendChatMessage({
  text,
  userId,
  file,
}: {
  text: string;
  userId: string;
  file: File | null;
}): Promise<AgentResponse> {
  const form = new FormData();
  form.append("text", text);
  form.append("user_id", userId);
  if (file) form.append("file", file);

  const res = await fetch(`${API_BASE}/agent`, { method: "POST", body: form });
  if (!res.ok) throw new Error("Agent request failed.");
  return res.json();
}

// NEW: call this instead of sendChatMessage when the thread is awaiting confirmation.
export async function sendConfirmation({
  userId,
  reply,
}: {
  userId: string;
  reply: string;
}): Promise<AgentResponse> {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("reply", reply);

  const res = await fetch(`${API_BASE}/agent/confirm`, { method: "POST", body: form });
  if (!res.ok) throw new Error("Confirmation request failed.");
  return res.json();
}