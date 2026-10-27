import json
import re
from datetime import datetime

FENCE_OPEN = "```meetpilot-action"
_BLOCK_RE = re.compile(r"```meetpilot-action\s*(.*?)```", re.DOTALL)

_BODY_FIELD = {"notion": "content", "jira": "description", "github": "body"}
_PLAIN_TEXT_SERVICES = {"notion", "jira"}

MAX_BLOCKS = 10
CUT_OFF_NOTE = "Some actions were cut off or couldn't be read. Reply \u201ccontinue\u201d to get the rest."
DEFAULT_NOTION_LOCATION = "Your default Notion database"

_NOTION_ID = re.compile(
    r"[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}"
)
_ODD_CHARS = str.maketrans({
    "\u202f": " ",
    "\u00a0": " ",
    "\u2009": " ",
    "\u200b": "",
    "\u2010": "-",
    "\u2011": "-",
    "\u2212": "-",
})


def _tidy(text: str) -> str:
    return text.translate(_ODD_CHARS)


def _deep_tidy(value):
    if isinstance(value, str):
        return _tidy(value)
    if isinstance(value, list):
        return [_deep_tidy(item) for item in value]
    if isinstance(value, dict):
        return {key: _deep_tidy(item) for key, item in value.items()}
    return value


def _plain(text: str) -> str:
    text = re.sub(r"(?<=\S)[ \t]+[-*]\s*\[[ xX]?\]\s+", "\n\u2022 ", str(text))
    lines = []
    for line in text.splitlines():
        line = re.sub(r"^\s*[-*\u2022]\s*\[[ xX]?\]\s*", "\u2022 ", line)
        line = re.sub(r"^\s*[-*]\s+", "\u2022 ", line)
        line = re.sub(r"^\s*#{1,6}\s*", "", line)
        line = line.replace("**", "").replace("`", "")
        lines.append(line.rstrip())
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def _sentence(step: str) -> str:
    return step[:1].upper() + step[1:]


def _loads(raw: str) -> dict | None:
    raw = raw.strip()
    for candidate in (raw, re.sub(r",\s*([}\]])", r"\1", raw)):
        try:
            value = json.loads(candidate)
            return value if isinstance(value, dict) else None
        except json.JSONDecodeError:
            continue
    return None


def _title_key(block: dict) -> tuple:
    title = re.sub(r"\W+", " ", str(block.get("title", "")).lower()).strip()
    return (block.get("service"), block.get("action"), title)


def _clean_block(block: dict | None) -> dict | None:
    if not block or not block.get("service") or not block.get("action"):
        return None

    block = _deep_tidy(block)
    service = block["service"]
    args = dict(block.get("args") or {})
    missing = list(dict.fromkeys(block.get("missing") or []))

    for key in [k for k, v in args.items() if v is None or v == ""]:
        del args[key]
        if key not in missing:
            missing.append(key)

    if service == "notion":
        if not _NOTION_ID.search(str(args.get("parent_page_or_database") or "")):
            args["parent_page_or_database"] = DEFAULT_NOTION_LOCATION
        missing = [m for m in missing if m not in ("parent_page_or_database", "database_id", "parent")]

    subtasks = [str(s).strip() for s in (block.get("subtasks") or []) if str(s).strip()]

    body_key = _BODY_FIELD.get(service)
    if body_key and service in _PLAIN_TEXT_SERVICES and args.get(body_key):
        args[body_key] = _plain(args[body_key])

    if subtasks and body_key:
        body = str(args.get(body_key, ""))
        absent = [s for s in subtasks if s.lower() not in body.lower()]
        if absent:
            if service in _PLAIN_TEXT_SERVICES:
                steps = "\n".join(f"{i}. {_sentence(s)}" for i, s in enumerate(absent, 1))
                args[body_key] = f"{body}\n\nSteps:\n{steps}".strip()
            else:
                checklist = "\n".join(f"- [ ] {s}" for s in absent)
                args[body_key] = f"{body}\n\n{checklist}".strip()

    cleaned = {**block, "args": args, "missing": missing, "status": block.get("status") or "proposed"}
    if subtasks:
        cleaned["subtasks"] = subtasks
    else:
        cleaned.pop("subtasks", None)
    return cleaned


def _render(block: dict) -> str:
    return f"{FENCE_OPEN}\n{json.dumps(block, ensure_ascii=False)}\n```"


def normalize_reply(text: str, max_blocks: int = MAX_BLOCKS) -> str:
    if not text:
        return text
    text = _tidy(text)
    if FENCE_OPEN not in text:
        return text

    out: list[str] = []
    seen: set[tuple] = set()
    kept = 0
    problems = 0
    cursor = 0

    for match in _BLOCK_RE.finditer(text):
        out.append(text[cursor:match.start()])
        cursor = match.end()

        block = _clean_block(_loads(match.group(1)))
        if block is None:
            problems += 1
            continue

        key = _title_key(block)
        if key in seen:
            continue
        seen.add(key)

        if kept >= max_blocks:
            problems += 1
            continue
        kept += 1
        out.append(_render(block))

    tail = text[cursor:]
    cut_at = tail.find(FENCE_OPEN)
    if cut_at != -1:
        out.append(tail[:cut_at])
        problems += 1
    else:
        out.append(tail)

    result = re.sub(r"\n{3,}", "\n\n", "".join(out)).strip()
    if problems:
        result += f"\n\n{CUT_OFF_NOTE}"
    return result


def _short(value, limit: int = 90) -> str:
    value = re.sub(r"\s+", " ", str(value or "")).strip()
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "\u2026"


def _when(value) -> str:
    try:
        return datetime.fromisoformat(str(value)).strftime("%d %b %Y, %I:%M %p")
    except ValueError:
        return _short(value)


def confirmation_message(tool: str, args: dict) -> str:
    args = args or {}

    if tool == "notion_create_page_schema":
        what = f"create a Notion page titled \u201c{_short(args.get('title'))}\u201d"
    elif tool == "jira_create_ticket_schema":
        what = (
            f"create a Jira {args.get('issue_type') or 'Task'} in project "
            f"{_short(args.get('project_key'))}: \u201c{_short(args.get('summary'))}\u201d"
        )
    elif tool == "slack_post_message_schema":
        what = f"post a message in the Slack channel {_short(args.get('channel'))}"
    elif tool == "github_create_issue_schema":
        what = f"create a GitHub issue in {_short(args.get('repo'))}: \u201c{_short(args.get('title'))}\u201d"
    elif tool == "gmail_send_email_schema":
        what = f"send an email to {_short(args.get('to'))} with the subject \u201c{_short(args.get('subject'))}\u201d"
    elif tool == "calendar_create_event_schema":
        what = (
            f"add \u201c{_short(args.get('summary'))}\u201d to your calendar, "
            f"from {_when(args.get('start_time'))} to {_when(args.get('end_time'))}"
        )
    else:
        what = tool.replace("_schema", "").replace("_", " ")

    return f"I'm about to {what}. Reply Yes to go ahead, No to cancel, or tell me what to change."