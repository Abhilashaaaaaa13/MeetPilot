from typing import TypedDict, Annotated, Optional
from langgraph.graph.message import add_messages
from pydantic import BaseModel


class AgentState(BaseModel):
    query: str
    intent: str
    response: str
    messages: Annotated[list, add_messages]
    tool_calls: list[str]
    user_id: str
    pending_tool: Optional[dict] = None         
    confirmation_decision: Optional[str] = None  
    modified_args: Optional[dict] = None        


class WorkflowMemory(BaseModel):
    thread_id: str
    last_intent: str
    last_response: str
    context_summary: str
    metadata: dict


class AgentContext(BaseModel):
    user_id: str
    conversation_id: str
    session_id: str
    metadata: dict
    memories: Annotated[list[WorkflowMemory], "persisted conversational memory"]