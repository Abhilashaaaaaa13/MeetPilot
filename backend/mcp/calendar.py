#============= Imports ============#

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from fastmcp import FastMCP
from auth.token_store import get_valid_token
 
#================ Connection ===============#
 
mcp = FastMCP("Calendar")
 
#============= Tools ==============#

@mcp.tool()
def calendar_create_event(user_id: str, summary: str, start_time: str, end_time: str, attendees: list[str] = []) -> dict:
    """Create a Google Calendar event on behalf of user_id. start_time/end_time are ISO 8601 strings."""
    creds = Credentials(token=get_valid_token(user_id, "google"))
    calendar = build("calendar", "v3", credentials=creds)
 
    event_body = {
        "summary": summary,
        "start": {"dateTime": start_time},
        "end": {"dateTime": end_time},
        "attendees": [{"email": a} for a in attendees],
    }
    event = calendar.events().insert(calendarId="primary", body=event_body, sendUpdates="all").execute()
    return {"event_id": event["id"], "htmlLink": event.get("htmlLink")}
 
 
if __name__ == "__main__":
    mcp.run()
 
