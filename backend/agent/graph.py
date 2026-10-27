import os
import re
from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo

from langgraph.graph import StateGraph, END
from langgraph.types import interrupt
from langgraph.checkpoint.memory import MemorySaver

from .llm import get_llm
from .states import AgentState
from .prompt import build_prompt
from .cache import make_key, get_cached, set_cached
from agent.tool_schema import get_available_schemas, TOOL_REGISTRY

from auth.token import get_connected_services


USER_TIMEZONE = os.environ.get("DEFAULT_TIMEZONE", "Asia/Kolkata")
SERVICE_ALIASES = {"google": ["gmail", "google_calendar"]}

NOTION_TOOL = "notion_create_page_schema"
NOTION_ID = re.compile(
    r"[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}"
)
NOTION_LOCATION_HELP = (
    "I can't create the Notion page yet because no Notion location is set. "
    "Add NOTION_DEFAULT_PARENT_ID (a Notion database ID or its link) to the backend .env file, "
    "share that database with your integration, and restart the server."
)


def _today() -> str:
    try:
        return datetime.now(ZoneInfo(USER_TIMEZONE)).strftime("%Y-%m-%d (%A)")
    except Exception:
        return datetime.now().strftime("%Y-%m-%d (%A)")


def _expand_services(connected: list[str]) -> list[str]:
    expanded = []
    for service in connected:
        expanded.extend(SERVICE_ALIASES.get(service, [service]))
    return expanded


def _system_prompt(connected: list[str]) -> str:
    return build_prompt(_today(), USER_TIMEZONE, _expand_services(connected))


def _model_name(llm) -> str:
    return str(getattr(llm, "model_name", None) or getattr(llm, "model", None) or "unknown")


def _notion_id(value) -> str | None:
    match = NOTION_ID.search(str(value or ""))
    return match.group(0) if match else None


def _finalize(result: dict) -> dict:
    pending = result.get("pending_tool")
    if not pending:
        return result

    name = pending["name"]
    args = dict(pending["args"])

    if name == NOTION_TOOL:
        parent = _notion_id(args.get("database_id")) or _notion_id(os.environ.get("NOTION_DEFAULT_PARENT_ID"))
        if not parent:
            return {"pending_tool": None, "response": NOTION_LOCATION_HELP}
        args["database_id"] = parent

    return {**result, "pending_tool": {"name": name, "args": args}}


def _safe_call(fn, *args, **kwargs) -> str:
    try:
        result = fn(*args, **kwargs)
        return str(result)
    except ValueError as exc:
        return f"Tool call skipped: {exc}"
    except Exception as exc:
        return f"Tool call failed: {exc}"


def decide_tool(state: AgentState) -> dict:
    user_id = state.user_id
    query = state.query

    connected = get_connected_services(user_id)
    schemas = get_available_schemas(connected)

    if not schemas:
        return {"pending_tool": None}

    system_prompt = _system_prompt(connected)
    llm = get_llm()

    key = make_key(
        user_id=user_id,
        query=query,
        connected=_expand_services(connected),
        current_date=_today(),
        model_name=_model_name(llm),
        system_prompt=system_prompt,
    )

    cached = get_cached(key)
    if cached is not None:
        return _finalize(cached)

    llm_with_tools = llm.bind_tools(schemas) if hasattr(llm, "bind_tools") else llm
    response = llm_with_tools.invoke([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": query},
    ])

    tool_calls = getattr(response, "tool_calls", None)
    if tool_calls:
        call = tool_calls[0]
        result = {"pending_tool": {"name": call["name"], "args": call["args"]}}
        set_cached(key, result)
        return _finalize(result)

    content = getattr(response, "content", "") or ""
    result = {"pending_tool": None, "response": content}
    if content:
        set_cached(key, result)
    return result


def request_confirmation(state: AgentState) -> dict:
    pending = state.pending_tool
    decision_payload = interrupt({"tool": pending["name"], "args": pending["args"]})

    return {
        "confirmation_decision": decision_payload.get("decision", "reject"),
        "modified_args": decision_payload.get("modified_args"),
    }


def execute_tool(state: AgentState) -> dict:
    pending = state.pending_tool
    decision = state.confirmation_decision or "reject"
    user_id = state.user_id

    if decision == "reject":
        return {"tool_calls": [f"Cancelled: {pending['name']} was not executed (user declined)."]}

    args = dict(pending["args"])
    if decision == "modify" and state.modified_args:
        args.update(state.modified_args)

    tool_meta = TOOL_REGISTRY[pending["name"]]
    result = _safe_call(tool_meta["fn"], user_id=user_id, **args)
    return {"tool_calls": [f"{pending['name']}: {result}"]}


def route_after_decide(state: AgentState) -> Literal["request_confirmation", "generate_response"]:
    return "request_confirmation" if state.pending_tool else "generate_response"


def generate_response(state: AgentState) -> dict:
    if state.response and not state.tool_calls:
        return {"messages": [state.query, state.response], "tool_calls": []}

    llm = get_llm()
    system_prompt = _system_prompt(get_connected_services(state.user_id))
    tool_context = "\n".join(state.tool_calls) if state.tool_calls else "No tools were called."

    response = llm.invoke([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Tool results: {tool_context}\nUser query: {state.query}"},
    ])

    answer = response.content if hasattr(response, "content") else str(response)
    return {"response": answer, "messages": [state.query, answer]}


def build_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("decide_tool", decide_tool)
    workflow.add_node("request_confirmation", request_confirmation)
    workflow.add_node("execute_tool", execute_tool)
    workflow.add_node("generate_response", generate_response)

    workflow.set_entry_point("decide_tool")
    workflow.add_conditional_edges(
        "decide_tool",
        route_after_decide,
        {"request_confirmation": "request_confirmation", "generate_response": "generate_response"},
    )
    workflow.add_edge("request_confirmation", "execute_tool")
    workflow.add_edge("execute_tool", "generate_response")
    workflow.add_edge("generate_response", END)

    checkpointer = MemorySaver()
    return workflow.compile(checkpointer=checkpointer)