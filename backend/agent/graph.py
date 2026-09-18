from typing import Literal

from langgraph.graph import StateGraph, END
from langgraph.types import interrupt
from langgraph.checkpoint.memory import MemorySaver

from .llm import get_llm
from .states import AgentState
from agent.tool_schema import get_available_schemas, TOOL_REGISTRY
from .prompt import SYSTEM_PROMPT

from auth.token import get_connected_services


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

    llm = get_llm()
    llm_with_tools = llm.bind_tools(schemas)
    response = llm_with_tools.invoke([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": query},
    ])

    tool_calls = getattr(response, "tool_calls", None)
    if tool_calls:
        # NOTE: only the first tool call is handled per turn.
        call = tool_calls[0]
        return {"pending_tool": {"name": call["name"], "args": call["args"]}}

    return {"pending_tool": None, "response": getattr(response, "content", "") or ""}



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
    # If decide_tool already produced a plain-text answer (no tool needed), keep it.
    if state.response and not state.tool_calls:
        return {"messages": [state.query, state.response], "tool_calls": []}

    llm = get_llm()
    tool_context = "\n".join(state.tool_calls) if state.tool_calls else "No tools were called."

    response = llm.invoke([
        {"role": "system", "content": SYSTEM_PROMPT},
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

    # NOTE: MemorySaver is in-process only -- lost on restart.
    checkpointer = MemorySaver()
    return workflow.compile(checkpointer=checkpointer)