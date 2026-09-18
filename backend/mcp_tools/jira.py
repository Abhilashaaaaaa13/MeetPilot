#====================== Imports ====================#

from jira import JIRA
from fastmcp import FastMCP
from auth.token import get_valid_token
import os

#======= Connection =======#

mcp = FastMCP("Jira")

#============ Tools ============#
@mcp.tool()
def jira_create_ticket(user_id: str, project_key: str, summary: str, description: str, issue_type: str = "Task") -> dict:
    """Create a Jira ticket on behalf of user_id."""
    token = get_valid_token(user_id, "jira")
    jira = JIRA(server=os.environ["JIRA_SERVER"], token_auth=token)

    issue = jira.create_issue(fields={
        "project": {"key": project_key},
        "summary": summary,
        "description": description,
        "issuetype": {"name": issue_type},
    })
    return {"ticket_key": issue.key, "url": f"{os.environ['JIRA_SERVER']}/browse/{issue.key}"}


if __name__ == "__main__":
    mcp.run()