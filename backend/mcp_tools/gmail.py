#============== Imports =============#

import base64
from email.mime.text import MIMEText
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from fastmcp import FastMCP
from auth.token import get_valid_token

#=============== Connection ============#

mcp = FastMCP("Gmail")

#================== Tools ===============#

@mcp.tool()
def gmail_send_email(user_id: str, to: str, subject: str, body: str) -> dict:
    """Send an email via Gmail, on behalf of user_id."""
    creds = Credentials(token=get_valid_token(user_id, "google"))
    gmail = build("gmail", "v1", credentials=creds)

    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    sent = gmail.users().messages().send(userId="me", body={"raw": raw}).execute()
    return {"message_id": sent["id"]}


if __name__ == "__main__":
    mcp.run()