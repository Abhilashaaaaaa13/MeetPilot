#============= Imports =============#

from slack_sdk import WebClient
from fastmcp import FastMCP
from auth.token_store import get_valid_token

#============== Connection ==========#

mcp = FastMCP("Slack")

#============== Tools ==============#

@mcp.tool()
def slack_post_message(user_id: str, channel: str, text: str) -> dict:
    """Post a message to a Slack channel on behalf of user_id."""
    slack = WebClient(token=get_valid_token(user_id, "slack"))
    response = slack.chat_postMessage(channel=channel, text=text)
    return {"ts": response["ts"], "channel": response["channel"]}


if __name__ == "__main__":
    mcp.run()