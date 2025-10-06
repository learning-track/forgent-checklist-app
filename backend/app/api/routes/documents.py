import aiofiles
import io
import langid
import os
import PyPDF2

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from app.api.routes.bypass_auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.models import Document, User

router = APIRouter()


def detect_language(text: str) -> str:
    """
    Detect the language of the given text using langid.
    Returns 'de' for German, 'en' for English, or 'de' as default.
    """
    if not text or len(text.strip()) < 10:
        return "de"  # Default to German for very short text

    try:
        # Use langid to detect language
        detected_lang, confidence = langid.classify(text)

        # Map detected language codes to our supported languages
        if detected_lang in ["de", "german"]:
            return "de"
        elif detected_lang in ["en", "english"]:
            return "en"
        else:
            # For other languages, default to German
            return "de"
    except Exception as e:
        print(f"Language detection error: {e}")
        return "de"  # Default to German on error


class DocumentResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    language: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentUpload(BaseModel):
    language: str = "de"


class DocumentUpdate(BaseModel):
    original_filename: str


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Check file size
    file_content = await file.read()
    if len(file_content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")

    # Save file
    filename = f"{current_user.id}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(file_content)

    # Extract text content from PDF
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        content = ""
        for page in pdf_reader.pages:
            content += page.extract_text() + "\n"
    except Exception as e:
        content = ""

    # Automatically detect language from extracted text
    detected_language = detect_language(content)

    # Create database record
    db_document = Document(
        filename=filename,
        original_filename=file.filename,
        file_path=file_path,
        file_size=len(file_content),
        mime_type=file.content_type,
        language=detected_language,
        content=content,
        owner_id=current_user.id,
    )

    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    return db_document


@router.get("/", response_model=List[DocumentResponse])
async def get_documents(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    documents = db.query(Document).filter(Document.owner_id == current_user.id).all()
    return documents


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.owner_id == current_user.id)
        .first()
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return document


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.owner_id == current_user.id)
        .first()
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file from filesystem
    if os.path.exists(document.file_path):
        os.remove(document.file_path)

    db.delete(document)
    db.commit()

    return {"message": "Document deleted successfully"}


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    document_update: DocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.owner_id == current_user.id)
        .first()
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Update the original filename
    document.original_filename = document_update.original_filename

    db.commit()
    db.refresh(document)

    return document
