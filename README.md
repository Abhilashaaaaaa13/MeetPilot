# MeetPilot
 
MeetPilot is an AI agent that takes a summarized meeting transcript (as text
and/or an uploaded PDF/Word/text file) and performs the follow-up actions
implied by it, creating a Jira ticket, posting a Slack update, adding a
Notion page, opening a GitHub issue, sending a Gmail follow-up, or scheduling
a Google Calendar event, using each user's own connected accounts via OAuth.
 
Every write action is proposed by the LLM, then held for explicit human
confirmation before it actually runs.

---
 
## How it works, end to end
 
1. A user connects their accounts (Notion, Slack, Jira, GitHub, Gmail,
   Calendar) once, via OAuth, no API keys are ever handled by the user.
2. They submit a meeting transcript (text and/or a file) to the agent.
3. The LangGraph agent decides, using real LLM function-calling
   (`bind_tools`), whether an action is warranted and which tool + arguments
   to use, but only from the set of tools the user has actually connected.
4. Before anything executes, the graph pauses (`interrupt()`) and the
   pending action is shown back to the user for confirmation.
5. The user's reply approve, reject, ask for a change, or something
   unrelated is classified by a small LLM call and the graph resumes
   accordingly.
6. Once approved, the real MCP tool function runs, using that specific
   user's stored OAuth token.

---

## Technology Stack

1. Python
2. TypeScript
3. Langchain
4. LangGraph
5. FastAPI
6. Next.js
7. Tailwind CSS
8. MCP Servers
