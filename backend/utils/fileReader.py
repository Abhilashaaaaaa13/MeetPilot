import io
from fastapi import UploadFile, HTTPException


def extract_text_from_file(file: UploadFile) -> str:
    filename = (file.filename or "").lower()
    raw = file.file.read()

    if filename.endswith(".txt"):
        return raw.decode("utf-8", errors="ignore")

    if filename.endswith(".pdf"):
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(raw))
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    if filename.endswith(".docx"):
        from docx import Document
        doc = Document(io.BytesIO(raw))
        return "\n".join(p.text for p in doc.paragraphs)

    raise HTTPException(status_code=400, detail=f"Unsupported file type: {filename}")