import os


def _env(name: str) -> str:

    return os.environ.get(name, "")


OAUTH_PROVIDERS = {
    "notion": {
        "client_id": _env("NOTION_CLIENT_ID"),
        "client_secret": _env("NOTION_CLIENT_SECRET"),
        "auth_url": "https://api.notion.com/v1/oauth/authorize",
        "token_url": "https://api.notion.com/v1/oauth/token",
        "scopes": "",  
        "extra_auth_params": {"owner": "user"},
    },
    "google": {  # shared by gmail_mcp.py and calendar_mcp.py
        "client_id": _env("GOOGLE_CLIENT_ID"),
        "client_secret": _env("GOOGLE_CLIENT_SECRET"),
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "scopes": "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar",
        "extra_auth_params": {"access_type": "offline", "prompt": "consent"},
    },
    "github": {
        "client_id": _env("GITHUB_CLIENT_ID"),
        "client_secret": _env("GITHUB_CLIENT_SECRET"),
        "auth_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "scopes": "repo",
        "extra_auth_params": {},
    },
    "jira": {
        "client_id": _env("JIRA_CLIENT_ID"),
        "client_secret": _env("JIRA_CLIENT_SECRET"),
        "auth_url": "https://auth.atlassian.com/authorize",
        "token_url": "https://auth.atlassian.com/oauth/token",
        "scopes": "read:jira-work write:jira-work offline_access",
        "extra_auth_params": {"audience": "api.atlassian.com", "prompt": "consent"},
    },
    "slack": {
        "client_id": _env("SLACK_CLIENT_ID"),
        "client_secret": _env("SLACK_CLIENT_SECRET"),
        "auth_url": "https://slack.com/oauth/v2/authorize",
        "token_url": "https://slack.com/api/oauth.v2.access",
        "scopes": "chat:write,channels:read",
        "extra_auth_params": {},
    },
}

REDIRECT_BASE_URL = os.environ.get("REDIRECT_BASE_URL", "http://localhost:8000")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# Display names for the sidebar's MCP server toggles. Gmail + Calendar share
# a single "google" OAuth connection, so they surface as one toggle.
MCP_SERVICE_NAMES = {
    "notion": "Notion",
    "google": "Google (Gmail & Calendar)",
    "github": "GitHub",
    "jira": "Jira",
    "slack": "Slack",
}