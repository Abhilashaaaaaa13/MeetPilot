#=============== Imports ================#

import os
import sys
import traceback

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from langgraph.types import Command

from utils.fileReader import extract_text_from_file
from utils.meeting_docs import split_meeting_text
from utils.actionBlocks import normalize_reply, confirmation_message

from agent.graph import build_graph
from agent.confirmation import classify_confirmation_reply

from auth.token import init_db
from auth.routes import router as oauth_router

from mcp_tools.notion import mcp as notion_mcp
from mcp_tools.gmail import mcp as gmail_mcp
from mcp_tools.calendar import mcp as calendar_mcp
from mcp_tools.github import mcp as github_mcp
from mcp_tools.jira import mcp as jira_mcp
from mcp_tools.slack import mcp as slack_mcp


#============= Connections ============#

app = FastAPI(title="MeetPilot API", version="1.0.0")
agent_graph = build_graph()

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(oauth_router)

app.mount("/mcp/notion", notion_mcp.http_app())
app.mount("/mcp/gmail", gmail_mcp.http_app())
app.mount("/mcp/calendar", calendar_mcp.http_app())
app.mount("/mcp/github", github_mcp.http_app())
app.mount("/mcp/jira", jira_mcp.http_app())
app.mount("/mcp/slack", slack_mcp.http_app())


#============= Helpers ===============#

def _format_result(result: dict, fallback_query: str, thread_id: str) -> dict:
    """
    If the graph paused on interrupt(), result contains '__interrupt__'
    instead of a normal final state.
    """
    if "__interrupt__" in result:
        payload = result["__interrupt__"][0].value  # {"tool": ..., "args": {...}}
        return {
            "status": "awaiting_confirmation",
            "thread_id": thread_id,
            "pending_tool": payload["tool"],
            "pending_args": payload["args"],
            "message": confirmation_message(payload["tool"], payload["args"]),
        }

    return {
        "status": "done",
        "query": result.get("query", fallback_query),
        "response": normalize_reply(result.get("response", "")),
        "messages": result.get("messages", []),
        "tool_calls": result.get("tool_calls", []),
    }


def _agent_error(exc: Exception) -> HTTPException:
    traceback.print_exc()
    message = str(exc)
    if "rate_limit_exceeded" in message or "Error code: 413" in message or "Error code: 429" in message:
        return HTTPException(
            status_code=429,
            detail="The AI model limit was reached. Try a shorter message, or wait a minute and try again.",
        )
    return HTTPException(status_code=500, detail=f"Agent execution failed: {message}")


def build_query(text: str, file: Optional[UploadFile]) -> str:
    """
    No file: just the typed text.
    File with Summary / Next steps (Gemini-style notes): send only the notes
    to the agent, not the whole transcript.
    Any other file: send the full text, like before.
    """
    if file is None:
        return text.strip()

    file_text = extract_text_from_file(file)
    meeting = split_meeting_text(file_text)

    if meeting.kind == "notes":
        notes = meeting.notes_for_llm()
        print(f"[upload] kind=notes original_chars={len(file_text)} sent_chars={len(notes)}")
        return (text + "\n\n" + notes).strip()

    print(f"[upload] kind=raw original_chars={len(file_text)} sent_chars={len(file_text)}")
    return (text + "\n\n" + file_text).strip()


def run_agent(query: str, user_id: str):
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query text and/or file content cannot be empty.")
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id cannot be empty.")

    thread_id = user_id
    config = {"configurable": {"thread_id": thread_id}}

    try:
        result = agent_graph.invoke(
            {
                "query": query,
                "user_id": user_id,
                "intent": "",       # no longer set by keyword classification -- kept for schema compat
                "response": "",
                "messages": [],
                "tool_calls": [],
                "pending_tool": None,
                "confirmation_decision": None,
                "modified_args": None,
            },
            config=config,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise _agent_error(exc) from exc

    return _format_result(result, query, thread_id)


def confirm_agent(user_id: str, reply_text: str):
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id cannot be empty.")

    thread_id = user_id
    config = {"configurable": {"thread_id": thread_id}}

    snapshot = agent_graph.get_state(config)
    pending = snapshot.values.get("pending_tool") if snapshot and snapshot.values else None

    if not pending:
        raise HTTPException(status_code=400, detail="No pending confirmation for this user.")

    decision = classify_confirmation_reply(pending["name"], pending["args"], reply_text)

    if decision["decision"] == "unrelated":
        agent_graph.invoke(Command(resume={"decision": "reject"}), config=config)
        return run_agent(reply_text, user_id)

    try:
        result = agent_graph.invoke(Command(resume=decision), config=config)
    except Exception as exc:
        raise _agent_error(exc) from exc

    return _format_result(result, reply_text, thread_id)


#============= Routes ===============#

@app.get("/")
def home():
    return {"message": "Backend is running", "status": "ok"}


@app.post("/response")
def get_response(
    text: str = Form(""),
    user_id: str = Form(...),
    file: Optional[UploadFile] = File(None),
):
    return run_agent(build_query(text, file), user_id)


@app.post("/agent")
def agent_entry(
    text: str = Form(""),
    user_id: str = Form(...),
    file: Optional[UploadFile] = File(None),
):
    return run_agent(build_query(text, file), user_id)


@app.post("/agent/confirm")
def agent_confirm(
    user_id: str = Form(...),
    reply: str = Form(...),
):
    """
    Call this after /agent returns status: 'awaiting_confirmation', once
    the user has replied (approve, reject, ask for a change, or unrelated).
    """
    return confirm_agent(user_id, reply)