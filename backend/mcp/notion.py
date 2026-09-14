import os
from typing import Any, Dict, Optional


class NotionClient:
    """Raw Notion MCP client placeholder.

    This client is intentionally left inactive until the team adds the Notion API
    key, workspace configuration, and page/database query logic.
    """

    def __init__(self, token: Optional[str] = None, base_url: str = "https://api.notion.com/v1") -> None:
        self.token = token or os.getenv("NOTION_API_KEY")
        self.base_url = base_url
        self.is_configured = bool(self.token)

    async def get_database(self, database_id: str) -> Dict[str, Any]:
        raise NotImplementedError("Notion integration is not active yet. Configure the API key and implement the database calls later.")

    async def query_database(self, database_id: str, filter_payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        raise NotImplementedError("Notion integration is not active yet. Configure the API key and implement the database calls later.")
