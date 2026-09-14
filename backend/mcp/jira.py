import os
from typing import Any, Dict, Optional


class JiraClient:
    """Raw Jira MCP client placeholder.

    This client is intentionally left blank until the Jira instance URL, email,
    API token, and issue-search logic are ready to be connected.
    """

    def __init__(
        self,
        email: Optional[str] = None,
        api_token: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> None:
        self.email = email or os.getenv("JIRA_EMAIL")
        self.api_token = api_token or os.getenv("JIRA_API_TOKEN")
        self.base_url = base_url or os.getenv("JIRA_BASE_URL")
        self.is_configured = bool(self.email and self.api_token and self.base_url)

    async def get_issue(self, issue_key: str) -> Dict[str, Any]:
        raise NotImplementedError("Jira integration is not active yet. Configure the project URL and credentials before enabling issue lookup.")

    async def search_issues(self, jql: str) -> Dict[str, Any]:
        raise NotImplementedError("Jira integration is not active yet. Configure the project URL and credentials before enabling issue search.")
