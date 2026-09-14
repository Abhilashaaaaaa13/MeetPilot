import asyncio
import os
from typing import Any, Dict, Literal

from langgraph.graph import StateGraph, END

from .llm import get_llm
from .states import AgentState

try:
    from ..mcp.notion import NotionClient
    from ..mcp.jira import JiraClient
    from ..mcp.slack import SlackClient
except ImportError:
    from mcp.notion import NotionClient
    from mcp.jira import JiraClient
    from mcp.slack import SlackClient


def classify_intent(state: AgentState) -> AgentState:
    query = state.get("query", "")
    query_lower = query.lower()

    if any(keyword in query_lower for keyword in ["slack", "notion", "jira", "ticket", "issue", "task"]):
        state["intent"] = "tooling"
    elif any(keyword in query_lower for keyword in ["summary", "summarize", "report", "update"]):
        state["intent"] = "summarize"
    else:
        state["intent"] = "general"

    return state


def _run_async(coro) -> str:
    try:
        result = asyncio.run(coro)
        return str(result)
    except NotImplementedError as exc:
        return f"Tool call skipped: {exc}"
    except Exception as exc:
        return f"Tool call failed: {exc}"


async def _call_notion(query: str) -> str:
    client = NotionClient()
    if not client.is_configured:
        return "Notion tool is not configured yet. Set NOTION_API_KEY to enable it."

    database_id = os.getenv("NOTION_DATABASE_ID", "")
    return str(await client.query_database(database_id=database_id, filter_payload={"query": query}))


async def _call_jira(query: str) -> str:
    client = JiraClient()
    if not client.is_configured:
        return "Jira tool is not configured yet. Set JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_BASE_URL to enable it."

    return str(await client.search_issues(jql=query))


async def _call_slack() -> str:
    client = SlackClient()
    if not client.is_configured:
        return "Slack tool is not configured yet. Set SLACK_BOT_TOKEN to enable it."

    channel_id = os.getenv("SLACK_CHANNEL_ID", "")
    return str(await client.get_channel_messages(channel_id=channel_id))


def call_tools(state: AgentState) -> AgentState:
    query = state.get("query", "")
    query_lower = query.lower()
    tool_calls = []

    if "notion" in query_lower:
        tool_calls.append(f"notion: {_run_async(_call_notion(query))}")

    if any(keyword in query_lower for keyword in ["jira", "ticket", "issue", "task"]):
        tool_calls.append(f"jira: {_run_async(_call_jira(query))}")

    if "slack" in query_lower:
        tool_calls.append(f"slack: {_run_async(_call_slack())}")

    if not tool_calls:
        tool_calls.append("No matching tool found for this query.")

    state["tool_calls"] = tool_calls
    return state


def generate_response(state: AgentState) -> AgentState:
    llm = get_llm()
    user_query = state.get("query", "")
    intent = state.get("intent", "general")
    tool_calls = state.get("tool_calls", [])

    system_prompt = (
        "You are MeetPilot, a helpful assistant for project coordination and workflow support. "
        "Use the user query, the detected intent, and available tooling context to respond clearly and concisely."
    )

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
