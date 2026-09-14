import os
import sys

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

try:
    from .agent.graph import build_graph
except ImportError:
    current_dir = os.path.dirname(__file__)
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    from agent.graph import build_graph

#============= Environment ============#

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

#============= Connections ============#

app = FastAPI(title="MeetPilot API", version="1.0.0")
agent_graph = build_graph()


#============= Classes ==============#

class TextRequest(BaseModel):
    text: str


#============= Helpers ===============#

def run_agent(query: str):
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query text cannot be empty.")

    try:
        result = agent_graph.invoke({"query": query})
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


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/login")
def get_auth():
    return {"message": "Login route is ready"}


@app.post("/response")
def get_response(request: TextRequest):
    return run_agent(request.text)


@app.post("/agent")
def agent_entry(request: TextRequest):
    return run_agent(request.text)
