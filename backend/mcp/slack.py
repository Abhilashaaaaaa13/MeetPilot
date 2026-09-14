import os
from typing import Any, Dict, Optional


class SlackClient:
    """Raw Slack MCP client placeholder.

    This client is intentionally left unconnected until the project is ready to
    integrate with Slack credentials and channel operations.
    """

    def __init__(self, token: Optional[str] = None, base_url: str = "https://slack.com/api") -> None:
        self.token = token or os.getenv("SLACK_BOT_TOKEN")
        self.base_url = base_url
        self.is_configured = bool(self.token)

    async def get_channel_messages(self, channel_id: str, limit: int = 20) -> Dict[str, Any]:
        raise NotImplementedError("Slack integration is not active yet. Add credentials and implement the API calls later.")

    async def send_message(self, channel_id: str, text: str) -> Dict[str, Any]:
        raise NotImplementedError("Slack integration is not active yet. Add credentials and implement the API calls later.")
