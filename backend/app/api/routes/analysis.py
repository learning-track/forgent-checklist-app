from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from typing import List, Optional

from app.analysis_queue import analysis_queue
from app.api.routes.bypass_auth import get_current_user
from app.core.database import get_db
from app.models.models import (
    Analysis,
    Document,
    Checklist,
    User,
    AnalysisResult,
    ChecklistItem,
    AnalysisDocument,
)


router = APIRouter()


class AnalysisCreate(BaseModel):
    name: str
    checklist_id: int
    document_ids: List[int]
    ai_model: str = "claude-3.5-sonnet"


class AnalysisResponse(BaseModel):
    id: int
    name: str
    status: str
    ai_model: str
    processing_time: Optional[float] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AnalysisResultResponse(BaseModel):
    id: int
    checklist_item_id: int
    document_id: Optional[int] = None  # Which document this result came from
    document_name: Optional[str] = None  # Document filename
    document_url: Optional[str] = None  # Document URL for viewing
    question_text: Optional[str] = None  # The original checklist question
    answer: Optional[str] = None
    condition_result: Optional[bool] = None
    confidence_score: Optional[float] = None
    evidence: Optional[str] = None
    page_references: List[int] = []

    @field_validator("page_references", mode="before")
    @classmethod
    def convert_page_references(cls, v):
        """Convert page_references to integers, handling both string and int formats"""
        if not v:
            return []

        result = []
        for item in v:
            if isinstance(item, int):
                result.append(item)
            elif isinstance(item, str):
                # Try to extract integer from strings like "page 1", "section 2.1"
                import re

                numbers = re.findall(r"\d+", item)
                if numbers:
                    result.append(int(numbers[0]))  # Take the first number found
                else:
                    result.append(1)  # Default to page 1 if no number found
            else:
                result.append(1)  # Default fallback

        return result

    class Config:
        from_attributes = True


class AnalysisDetailResponse(BaseModel):
    id: int
    name: str
    status: str
    ai_model: str
    processing_time: Optional[float] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    results: List[AnalysisResultResponse] = []

    class Config:
        from_attributes = True


# OLD FUNCTION - REPLACED BY QUEUE SYSTEM
# The old process_analysis function has been replaced by the analysis_queue system


@router.post("/", response_model=AnalysisResponse)
async def create_analysis(
    analysis: AnalysisCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate checklist exists and belongs to user OR is a template
    checklist = (
        db.query(Checklist)
        .filter(
            Checklist.id == analysis.checklist_id,
            (Checklist.owner_id == current_user.id) | (Checklist.is_template == True),
        )
        .first()
    )

    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    # Validate documents exist and belong to user
    documents = (
        db.query(Document)
        .filter(
            Document.id.in_(analysis.document_ids), Document.owner_id == current_user.id
        )
        .all()
    )

    if len(documents) != len(analysis.document_ids):
        raise HTTPException(status_code=404, detail="One or more documents not found")

    # Create analysis with pending status
    db_analysis = Analysis(
        name=analysis.name,
        checklist_id=analysis.checklist_id,
        ai_model=analysis.ai_model,
        owner_id=current_user.id,
        status="pending",  # Explicitly set to pending
    )

    db.add(db_analysis)
    db.commit()
    db.refresh(db_analysis)

    # Add documents to analysis using the many-to-many relationship table
    for doc in documents:
        analysis_doc = AnalysisDocument(analysis_id=db_analysis.id, document_id=doc.id)
        db.add(analysis_doc)

    db.commit()

    # Add to analysis queue instead of background task
    await analysis_queue.add_analysis(db_analysis.id)

    return db_analysis


@router.get("/", response_model=List[AnalysisDetailResponse])
async def get_analyses(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    analyses = db.query(Analysis).filter(Analysis.owner_id == current_user.id).all()

    # Get results for each analysis
    result_analyses = []
    for analysis in analyses:
        results = (
            db.query(AnalysisResult)
            .filter(AnalysisResult.analysis_id == analysis.id)
            .all()
        )

        # Enhance results with checklist item text and document URL
        enhanced_results = []
        for result in results:
            # Get the checklist item to get the original question text
            checklist_item = (
                db.query(ChecklistItem)
                .filter(ChecklistItem.id == result.checklist_item_id)
                .first()
            )
            question_text = checklist_item.text if checklist_item else None

            # Get the document to create the URL
            document_url = None
            if result.document_id:
                document = (
                    db.query(Document)
                    .filter(
                        Document.id == result.document_id,
                        Document.owner_id == current_user.id,
                    )
                    .first()
                )
                if document:
                    # Create the document URL using the filename
                    document_url = f"http://localhost:8000/uploads/{document.filename}"

            enhanced_result = {
                **result.__dict__,
                "question_text": question_text,
                "document_url": document_url,
            }
            enhanced_results.append(enhanced_result)

        result_analyses.append({**analysis.__dict__, "results": enhanced_results})

    return result_analyses


@router.get("/{analysis_id}", response_model=AnalysisDetailResponse)
async def get_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    analysis = (
        db.query(Analysis)
        .filter(Analysis.id == analysis_id, Analysis.owner_id == current_user.id)
        .first()
    )

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Get results
    results = (
        db.query(AnalysisResult).filter(AnalysisResult.analysis_id == analysis_id).all()
    )

    # Enhance results with checklist item text and document URL
    enhanced_results = []
    for result in results:
        # Get the checklist item to get the original question text
        checklist_item = (
            db.query(ChecklistItem)
            .filter(ChecklistItem.id == result.checklist_item_id)
            .first()
        )
        question_text = checklist_item.text if checklist_item else None

        # Get the document to create the URL
        document_url = None
        if result.document_id:
            document = (
                db.query(Document)
                .filter(
                    Document.id == result.document_id,
                    Document.owner_id == current_user.id,
                )
                .first()
            )
            if document:
                # Create the document URL using the filename
                document_url = f"http://localhost:8000/uploads/{document.filename}"

        enhanced_result = {
            **result.__dict__,
            "question_text": question_text,
            "document_url": document_url,
        }
        enhanced_results.append(enhanced_result)

    return {**analysis.__dict__, "results": enhanced_results}


@router.delete("/{analysis_id}")
async def delete_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    analysis = (
        db.query(Analysis)
        .filter(Analysis.id == analysis_id, Analysis.owner_id == current_user.id)
        .first()
    )

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    try:
        # Delete related AnalysisDocument entries first
        db.query(AnalysisDocument).filter(
            AnalysisDocument.analysis_id == analysis_id
        ).delete()

        # Delete the analysis (this will cascade delete AnalysisResult due to the relationship)
        db.delete(analysis)
        db.commit()

        return {"message": "Analysis deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to delete analysis: {str(e)}"
        )
