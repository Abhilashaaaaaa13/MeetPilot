import type { ChatMessage as ChatMessageType } from "../types/chat";

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-gray-100 text-gray-900 rounded-bl-sm"
        }`}
      >
        {message.attachment && (
          <div
            className={`mb-1 flex items-center gap-1 text-xs ${
              isUser ? "text-blue-100" : "text-gray-500"
            }`}
          >
            <span>📎</span>
            <span className="truncate">{message.attachment.name}</span>
          </div>
        )}
        {message.text}
      </div>
    </div>
  );
}
