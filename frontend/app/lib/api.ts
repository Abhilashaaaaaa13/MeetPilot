import type { AgentResponse, SendMessagePayload } from "../types/chat";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function sendChatMessage({
  text,
  userId,
  file,
}: SendMessagePayload): Promise<AgentResponse> {
  const formData = new FormData();
  formData.append("text", text);
  formData.append("user_id", userId);
  if (file) {
    formData.append("file", file);
  }

  const response = await fetch(`${API_BASE_URL}/response`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(
      errorBody?.detail ?? `Request failed with status ${response.status}`
    );
  }

  return response.json();
}
