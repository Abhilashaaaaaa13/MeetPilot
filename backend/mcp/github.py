#============= Imports =============#

from github import Github
from fastmcp import FastMCP
from auth.token_store import get_valid_token

#============ Connection ============#

mcp = FastMCP("GitHub")

#=========== Tools ==================#

@mcp.tool()
def github_create_issue(user_id: str, repo: str, title: str, body: str, labels: list[str] = []) -> dict:
    """Create a GitHub issue on behalf of user_id. repo format: 'org/repo'."""
    gh = Github(get_valid_token(user_id, "github"))
    repository = gh.get_repo(repo)
    issue = repository.create_issue(title=title, body=body, labels=labels)
    return {"issue_number": issue.number, "url": issue.html_url}


if __name__ == "__main__":
    mcp.run()