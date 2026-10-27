import os
import re
from dataclasses import dataclass

CHUNK_CHARS = int(os.environ.get("CHUNK_CHARS", "900"))
OVERLAP_LINES = int(os.environ.get("CHUNK_OVERLAP_LINES", "1"))

TRANSCRIPT_MARKER = re.compile(r"^\W*Transcript\W*$", re.IGNORECASE)
TIMESTAMP_LINE = re.compile(r"^\d{1,2}:\d{2}:\d{2}$")
INLINE_TIMESTAMP = re.compile(r"\((\d{1,2}:\d{2}:\d{2})\)")
DATE_LINE = re.compile(r"^[A-Z][a-z]{2,8}\.? \d{1,2}, \d{4}$")
TRANSCRIPT_TITLE = re.compile(r"^.*\s-\s*Transcript$", re.IGNORECASE)

NOISE = re.compile(
    r"(let us know what you think|updated the decisions section|you should review gemini|"
    r"how is the quality of|take a short survey|did the screenshots in this section|"
    r"get tips and learn how gemini)",
    re.IGNORECASE,
)

SECTION_HEADINGS = {
    "summary": "summary",
    "meeting summary": "summary",
    "decisions": "decisions",
    "key decisions": "decisions",
    "next steps": "next_steps",
    "action items": "next_steps",
    "suggested next steps": "next_steps",
    "details": "details",
}


@dataclass
class Chunk:
    text: str
    source: str
    timestamp: str


@dataclass
class MeetingDoc:
    kind: str
    title: str
    date: str
    invited: str
    summary: str
    decisions: str
    next_steps: str
    details: str
    transcript: str

    def notes_for_llm(self) -> str:
        blocks = []
        head = []
        if self.title:
            head.append(f"Title: {self.title}")
        if self.date:
            head.append(f"Date: {self.date}")
        if self.invited:
            head.append(f"Invited: {self.invited}")
        if head:
            blocks.append("MEETING\n" + "\n".join(head))
        if self.summary:
            blocks.append("SUMMARY\n" + self.summary)
        if self.decisions:
            blocks.append("DECISIONS\n" + self.decisions)
        if self.next_steps:
            blocks.append("NEXT STEPS\n" + self.next_steps)
        return "\n\n".join(blocks)

    def index_chunks(self) -> list[Chunk]:
        return chunk_details(self.details) + chunk_transcript(self.transcript)


def _normalize(line: str) -> str:
    return re.sub(r"[^\w\s]", "", line).strip().lower()


def _split_long(text: str, limit: int) -> list[str]:
    if len(text) <= limit:
        return [text]
    pieces: list[str] = []
    current = ""
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if current and len(current) + 1 + len(sentence) > limit:
            pieces.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        pieces.append(current)
    final: list[str] = []
    for piece in pieces:
        while len(piece) > limit:
            final.append(piece[:limit])
            piece = piece[limit:]
        final.append(piece)
    return final


def chunk_transcript(transcript: str, limit: int = CHUNK_CHARS, overlap_lines: int = OVERLAP_LINES) -> list[Chunk]:
    chunks: list[Chunk] = []
    buffer: list[str] = []
    fresh = 0
    size = 0
    current_ts = ""
    chunk_ts = ""

    def flush():
        nonlocal buffer, fresh, size, chunk_ts
        chunks.append(Chunk("\n".join(buffer), "transcript", chunk_ts))
        buffer = buffer[-overlap_lines:] if overlap_lines else []
        fresh = 0
        size = sum(len(item) + 1 for item in buffer)
        chunk_ts = current_ts

    for raw in transcript.splitlines():
        line = raw.strip()
        if not line:
            continue
        if TIMESTAMP_LINE.match(line):
            current_ts = line
            continue
        if DATE_LINE.match(line) or TRANSCRIPT_TITLE.match(line):
            continue
        for piece in _split_long(line, limit):
            if fresh and size + len(piece) + 1 > limit:
                flush()
            if not buffer:
                chunk_ts = current_ts
            buffer.append(piece)
            fresh += 1
            size += len(piece) + 1

    if fresh:
        chunks.append(Chunk("\n".join(buffer), "transcript", chunk_ts))
    return chunks


def chunk_details(details: str, limit: int = CHUNK_CHARS * 2) -> list[Chunk]:
    chunks: list[Chunk] = []
    for line in details.splitlines():
        line = line.strip()
        if not line:
            continue
        found = INLINE_TIMESTAMP.search(line)
        timestamp = found.group(1) if found else ""
        for piece in _split_long(line, limit):
            chunks.append(Chunk(piece, "notes", timestamp))
    return chunks


def _parse_header(lines: list[str]) -> tuple[str, str, str]:
    title = ""
    date = ""
    invited = ""
    for line in lines:
        lowered = line.lower()
        if lowered.startswith("invited"):
            invited = re.sub(r"^invited\s*", "", line, flags=re.IGNORECASE)
        elif lowered.startswith(("attachments", "meeting records")):
            continue
        elif not date and DATE_LINE.match(line):
            date = line
        elif _normalize(line) == "notes":
            continue
        elif not title:
            title = line
    return title, date, invited


def split_meeting_text(text: str) -> MeetingDoc:
    lines = [line.strip() for line in text.splitlines()]

    marker = next((i for i, line in enumerate(lines) if TRANSCRIPT_MARKER.match(line)), None)
    notes_lines = lines if marker is None else lines[:marker]
    transcript_lines = [] if marker is None else lines[marker + 1 :]

    sections: dict[str, list[str]] = {
        "header": [],
        "summary": [],
        "decisions": [],
        "next_steps": [],
        "details": [],
    }
    seen: set[str] = set()
    current = "header"

    for line in notes_lines:
        if not line or NOISE.search(line):
            continue
        key = SECTION_HEADINGS.get(_normalize(line))
        if key and key not in seen:
            seen.add(key)
            current = key
            continue
        sections[current].append(line)

    kind = "notes" if (sections["summary"] or sections["next_steps"]) else "raw"

    if kind == "raw" and marker is None:
        transcript_lines = [line for line in lines if line]

    title, date, invited = _parse_header(sections["header"]) if kind == "notes" else ("", "", "")

    return MeetingDoc(
        kind=kind,
        title=title,
        date=date,
        invited=invited,
        summary="\n".join(sections["summary"]),
        decisions="\n".join(sections["decisions"]),
        next_steps="\n".join(sections["next_steps"]),
        details="\n".join(sections["details"]),
        transcript="\n".join(line for line in transcript_lines if line),
    )