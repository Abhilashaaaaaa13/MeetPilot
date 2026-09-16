#=============== Imports ================#

import os
import sys

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, File, Form, UploadFile
from typing import Optional

from utils.fileReader import extract_text_from_file

from .agent.graph import build_graph

from .auth.token import init_db
from .auth.routes import router as oauth_router


from .mcp.notion import mcp as notion_mcp
from .mcp.gmail import mcp as gmail_mcp
from .mcp.calendar import mcp as calendar_mcp
from .mcp.github import mcp as github_mcp
from .mcp.jira import mcp as jira_mcp
from .mcp.slack import mcp as slack_mcp


#============= Environment ============#

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

#============= Connections ============#

app = FastAPI(title="MeetPilot API", version="1.0.0")
agent_graph = build_graph()

init_db()  

app.include_router(oauth_router)

app.mount("/mcp/notion", notion_mcp.http_app())
app.mount("/mcp/gmail", gmail_mcp.http_app())
app.mount("/mcp/calendar", calendar_mcp.http_app())
app.mount("/mcp/github", github_mcp.http_app())
app.mount("/mcp/jira", jira_mcp.http_app())
app.mount("/mcp/slack", slack_mcp.http_app())


#============= Helpers ===============#

def run_agent(query: str, user_id: str):
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query text and/or file content cannot be empty.")
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id cannot be empty.")

    try:
        result = agent_graph.invoke({"query": query, "user_id": user_id})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {exc}") from exc

    return {
        "query": result.get("query", query),
        "intent": result.get("intent", "general"),
        "response": result.get("response", ""),
        "messages": result.get("messages", []),
        "tool_calls": result.get("tool_calls", []),
    }


#============= Routes ===============#

@app.get("/")
def home():
    return {"message": "Backend is running", "status": "ok"}


@app.post("/login")
def get_auth():
    return {"message": "Login route is ready"}


@app.post("/response")
def get_response(
    text: str = Form(""),
    user_id: str = Form(...),
    file: Optional[UploadFile] = File(None),
):
    combined_query = text
    if file is not None:
        combined_query = (text + "\n\n" + extract_text_from_file(file)).strip()
    return run_agent(combined_query, user_id)


@app.post("/agent")
def agent_entry(
    text: str = Form(""),
    user_id: str = Form(...),
    file: Optional[UploadFile] = File(None),
):
    combined_query = text
    if file is not None:
        combined_query = (text + "\n\n" + extract_text_from_file(file)).strip()
    return run_agent(combined_query, user_id)