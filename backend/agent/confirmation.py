from typing import Optional
from langchain_core.tools import tool

from .llm import get_llm


@tool
def record_confirmation_decision(decision: str, modified_args: Optional[dict] = None) -> str:
    """Record how the user responded to a pending tool-call confirmation.

    decision must be exactly one of:
    - "approve": user agreed to proceed as-is
    - "reject": user declined / cancelled the action
    - "modify": user wants to proceed but with different argument values
                (put ONLY the changed fields in modified_args)
    - "unrelated": user's reply doesn't address the pending confirmation at all
    """
    ...  # schema only


def classify_confirmation_reply(pending_tool_name: str, pending_args: dict, reply_text: str) -> dict:
    llm = get_llm()

    try:
        llm_with_tool = llm.bind_tools([record_confirmation_decision], tool_choice="record_confirmation_decision")
    except TypeError:
        llm_with_tool = llm.bind_tools([record_confirmation_decision])

    messages = [
        {
            "role": "system",
            "content": (
                "You are classifying a user's reply to a pending action confirmation. "
                "Call record_confirmation_decision exactly once with the correct decision."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Pending action: {pending_tool_name}\n"
                f"Pending arguments: {pending_args}\n\n"
                f"User's reply: {reply_text}"
            ),
        },
    ]

    response = llm_with_tool.invoke(messages)
    tool_calls = getattr(response, "tool_calls", None)

    if tool_calls:
        args = tool_calls[0]["args"]
        return {
            "decision": args.get("decision", "unrelated"),
            "modified_args": args.get("modified_args"),
        }

    return {"decision": "unrelated", "modified_args": None}