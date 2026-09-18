#=============== Imports =============#

from notion_client import Client
from fastmcp import FastMCP
from auth.token import get_valid_token

#=========== Connection ==========#

mcp = FastMCP("Notion")

#=========== Tools ================#

@mcp.tool()
def notion_create_page(user_id: str, title: str, content: str, database_id: str) -> dict:
    """Create a Notion page with a title and a text block, on behalf of user_id."""
    notion = Client(auth=get_valid_token(user_id, "notion"))
    page = notion.pages.create(
        parent={"database_id": database_id},
        properties={"Name": {"title": [{"text": {"content": title}}]}},
        children=[{
            "object": "block",
            "type": "paragraph",
            "paragraph": {"rich_text": [{"type": "text", "text": {"content": content}}]},
        }],
    )
    return {"page_id": page["id"], "url": page.get("url")}


@mcp.tool()
def notion_add_action_items(user_id: str, page_title: str, action_items: list[str], database_id: str) -> dict:
    """Create a Notion page with a checklist of action items, on behalf of user_id."""
    notion = Client(auth=get_valid_token(user_id, "notion"))
    children = [{
        "object": "block",
        "type": "to_do",
        "to_do": {"rich_text": [{"type": "text", "text": {"content": item}}], "checked": False},
    } for item in action_items]

    page = notion.pages.create(
        parent={"database_id": database_id},
        properties={"Name": {"title": [{"text": {"content": page_title}}]}},
        children=children,
    )
    return {"page_id": page["id"], "url": page.get("url")}


if __name__ == "__main__":
    mcp.run()