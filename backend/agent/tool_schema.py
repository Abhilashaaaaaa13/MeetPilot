from langchain_core.tools import tool

from mcp_tools.notion import notion_create_page
from mcp_tools.jira import jira_create_ticket
from mcp_tools.slack import slack_post_message
from mcp_tools.github import github_create_issue
from mcp_tools.gmail import gmail_send_email
from mcp_tools.calendar import calendar_create_event


@tool
def notion_create_page_schema(title: str, content: str, database_id: str) -> str:
    """Create a Notion page with a title and a text block, for a follow-up
    note or action-item log from the meeting."""
    ...  # schema only -- never executed


@tool
def jira_create_ticket_schema(project_key: str, summary: str, description: str, issue_type: str = "Task") -> str:
    """Create a Jira ticket for an action item or bug discussed in the meeting."""
    ...


@tool
def slack_post_message_schema(channel: str, text: str) -> str:
    """Post a message to a Slack channel, e.g. a meeting summary or update."""
    ...


@tool
def github_create_issue_schema(repo: str, title: str, body: str) -> str:
    """Create a GitHub issue for a bug or task discussed in the meeting."""
    ...


@tool
def gmail_send_email_schema(to: str, subject: str, body: str) -> str:
    """Send a follow-up email, e.g. a meeting summary to attendees."""
    ...


@tool
def calendar_create_event_schema(summary: str, start_time: str, end_time: str) -> str:
    """Schedule a follow-up meeting or reminder on Google Calendar.
    start_time/end_time must be ISO 8601 datetime strings."""
    ...


TOOL_REGISTRY = {
    "notion_create_page_schema": {"fn": notion_create_page, "service": "notion"},
    "jira_create_ticket_schema": {"fn": jira_create_ticket, "service": "jira"},
    "slack_post_message_schema": {"fn": slack_post_message, "service": "slack"},
    "github_create_issue_schema": {"fn": github_create_issue, "service": "github"},
    "gmail_send_email_schema": {"fn": gmail_send_email, "service": "google"},
    "calendar_create_event_schema": {"fn": calendar_create_event, "service": "google"},
}

ALL_SCHEMAS = {
    "notion_create_page_schema": notion_create_page_schema,
    "jira_create_ticket_schema": jira_create_ticket_schema,
    "slack_post_message_schema": slack_post_message_schema,
    "github_create_issue_schema": github_create_issue_schema,
    "gmail_send_email_schema": gmail_send_email_schema,
    "calendar_create_event_schema": calendar_create_event_schema,
}


def get_available_schemas(connected_services: list[str]) -> list:
    """Filters schemas down to only the services this user has connected."""
    return [
        ALL_SCHEMAS[name]
        for name, meta in TOOL_REGISTRY.items()
        if meta["service"] in connected_services
    ]