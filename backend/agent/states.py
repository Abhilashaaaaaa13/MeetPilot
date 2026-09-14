from typing import TypedDict, Annotated


class AgentState(TypedDict):
    query: str
    intent: str
    response: str
    messages: list[str]
    tool_calls: list[str]


class WorkflowMemory(TypedDict):
    thread_id: str
    last_intent: str
    last_response: str
    context_summary: str
    metadata: dict


class AgentContext(TypedDict):
    user_id: str
    conversation_id: str
    session_id: str
    metadata: dict
    memories: Annotated[list[WorkflowMemory], "persisted conversational memory"]
