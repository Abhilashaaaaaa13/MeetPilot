import os
from pathlib import Path
from typing import Literal

from langgraph.graph import StateGraph, END

from .llm import get_llm
from .states import AgentState

from mcp.notion import notion_create_page
from mcp.jira import jira_create_ticket
from mcp.slack import slack_post_message
from mcp.github import github_create_issue
from mcp.gmail import gmail_send_email
from mcp.calendar import calendar_create_event


PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompt.md"


def _load_system_prompt() -> str:
    """Reads the '## System Prompt' section out of prompt.md."""
    text = PROMPT_PATH.read_text(encoding="utf-8")
    section = text.split("## System Prompt", 1)[1]
    section = section.split("## Intent Classification Rules", 1)[0]
    return section.strip()


def classify_intent(state: AgentState) -> AgentState:
    query = state.get("query", "")
    query_lower = query.lower()

    tooling_keywords = [
        "slack", "notion", "jira", "github", "gmail", "email",
        "calendar", "meeting", "event", "ticket", "issue", "task",
    ]

    if any(keyword in query_lower for keyword in tooling_keywords):
        state["intent"] = "tooling"
    elif any(keyword in query_lower for keyword in ["summary", "summarize", "report", "update"]):
        state["intent"] = "summarize"
    else:
        state["intent"] = "general"

    return state


def _safe_call(fn, *args, **kwargs) -> str:
    """
    Wraps a tool call so a missing OAuth connection (get_valid_token raising
    ValueError) or any other failure becomes a readable message instead of
    crashing the graph.
    """
    try:
        result = fn(*args, **kwargs)
        return str(result)
    except ValueError as exc:
        return f"Tool call skipped: {exc}"
    except Exception as exc:
        return f"Tool call failed: {exc}"


def call_tools(state: AgentState) -> AgentState:
    query = state.get("query", "")
    query_lower = query.lower()
    user_id = state.get("user_id", "")
    tool_calls = []

    # NOTE: all 6 tools below are WRITE actions. Parameters (repo name,
    # email recipient, event times, etc.) are pulled from env defaults --
    # there's no real structured-argument extraction from the query text.
    # For a production version, this is where an LLM function-calling /
    # structured-output step would parse real params ("to", "subject",
    # "database_id") out of the query. Flagging this rather than faking it.

    if "notion" in query_lower:
        tool_calls.append("notion: " + _safe_call(
            notion_create_page,
            user_id=user_id,
            title=query[:100],
            content=query,
            database_id=os.getenv("NOTION_DEFAULT_DATABASE_ID", ""),
        ))

    if any(k in query_lower for k in ["jira", "ticket", "issue", "task"]) and "github" not in query_lower:
        tool_calls.append("jira: " + _safe_call(
            jira_create_ticket,
            user_id=user_id,
            project_key=os.getenv("JIRA_DEFAULT_PROJECT_KEY", ""),
            summary=query[:100],
            description=query,
        ))

    if "slack" in query_lower:
        tool_calls.append("slack: " + _safe_call(
            slack_post_message,
            user_id=user_id,
            channel=os.getenv("SLACK_DEFAULT_CHANNEL", "#general"),
            text=query,
        ))

    if "github" in query_lower:
        tool_calls.append("github: " + _safe_call(
            github_create_issue,
            user_id=user_id,
            repo=os.getenv("GITHUB_DEFAULT_REPO", ""),
            title=query[:100],
            body=query,
        ))

    if "email" in query_lower or "gmail" in query_lower:
        tool_calls.append("gmail: " + _safe_call(
            gmail_send_email,
            user_id=user_id,
            to=os.getenv("DEFAULT_EMAIL_RECIPIENT", ""),
            subject=query[:100],
            body=query,
        ))

    if "calendar" in query_lower or "meeting" in query_lower or "event" in query_lower:
        tool_calls.append("calendar: " + _safe_call(
            calendar_create_event,
            user_id=user_id,
            summary=query[:100],
            start_time=os.getenv("DEFAULT_EVENT_START", ""),
            end_time=os.getenv("DEFAULT_EVENT_END", ""),
        ))

    if not tool_calls:
        tool_calls.append("No matching tool found for this query.")

    state["tool_calls"] = tool_calls
    return state


def generate_response(state: AgentState) -> AgentState:
    llm = get_llm()
    user_query = state.get("query", "")
    intent = state.get("intent", "general")
    tool_calls = state.get("tool_calls", [])

    system_prompt = _load_system_prompt()
    tool_context = "\n".join(tool_calls) if tool_calls else "No tools were called."

    response = llm.invoke(
        [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Intent: {intent}\nTool results: {tool_context}\nUser query: {user_query}",
            },
        ]
    )

    answer = response.content if hasattr(response, "content") else str(response)
    state["response"] = answer
    state["messages"] = [user_query, answer]
    state.setdefault("tool_calls", [])
    return state


def route_after_classify(state: AgentState) -> Literal["call_tools", "generate_response"]:
    return "call_tools" if state.get("intent") == "tooling" else "generate_response"


def build_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("classify_intent", classify_intent)
    workflow.add_node("call_tools", call_tools)
    workflow.add_node("generate_response", generate_response)

    workflow.set_entry_point("classify_intent")
    workflow.add_conditional_edges(
        "classify_intent",
        route_after_classify,
        {"call_tools": "call_tools", "generate_response": "generate_response"},
    )
    workflow.add_edge("call_tools", "generate_response")
    workflow.add_edge("generate_response", END)

    return workflow.compile()