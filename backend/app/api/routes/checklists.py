from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.routes.bypass_auth import get_current_user
from app.core.database import get_db
from app.models.models import Checklist, ChecklistItem, User


router = APIRouter()


class ChecklistItemCreate(BaseModel):
    type: str  # question, condition
    text: str
    is_required: bool = True
    order: int = 0


class ChecklistItemResponse(BaseModel):
    id: int
    type: str
    text: str
    is_required: bool
    order: int


class ChecklistCreate(BaseModel):
    name: str
    description: Optional[str] = None
    language: str = "de"
    is_template: bool = False
    template_category: Optional[str] = None
    items: List[ChecklistItemCreate] = []


class ChecklistResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    language: str
    is_template: bool
    template_category: Optional[str]
    created_at: datetime
    items: List[ChecklistItemResponse] = []

    class Config:
        from_attributes = True


class ChecklistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None


@router.post("/", response_model=ChecklistResponse)
async def create_checklist(
    checklist: ChecklistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_checklist = Checklist(
        name=checklist.name,
        description=checklist.description,
        language=checklist.language,
        is_template=checklist.is_template,
        template_category=checklist.template_category,
        owner_id=current_user.id,
    )

    db.add(db_checklist)
    db.commit()
    db.refresh(db_checklist)

    # Create checklist items
    for item_data in checklist.items:
        db_item = ChecklistItem(
            checklist_id=db_checklist.id,
            type=item_data.type,
            text=item_data.text,
            is_required=item_data.is_required,
            order=item_data.order,
        )
        db.add(db_item)

    db.commit()
    db.refresh(db_checklist)

    return db_checklist


@router.get("/", response_model=List[ChecklistResponse])
async def get_checklists(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    # Get user's own checklists
    user_checklists = (
        db.query(Checklist).filter(Checklist.owner_id == current_user.id).all()
    )

    # Get template checklists
    template_checklists = (
        db.query(Checklist).filter(Checklist.is_template == True).all()
    )

    # Combine both lists and remove duplicates based on ID
    all_checklists = user_checklists + template_checklists
    seen_ids = set()
    unique_checklists = []
    for checklist in all_checklists:
        if checklist.id not in seen_ids:
            seen_ids.add(checklist.id)
            unique_checklists.append(checklist)

    return unique_checklists


@router.get("/templates", response_model=List[ChecklistResponse])
async def get_template_checklists(
    language: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Checklist).filter(Checklist.is_template == True)

    if language:
        query = query.filter(Checklist.language == language)
    if category:
        query = query.filter(Checklist.template_category == category)

    checklists = query.all()
    return checklists


@router.get("/{checklist_id}", response_model=ChecklistResponse)
async def get_checklist(
    checklist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    checklist = (
        db.query(Checklist)
        .filter(Checklist.id == checklist_id, Checklist.owner_id == current_user.id)
        .first()
    )

    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    return checklist


@router.put("/{checklist_id}", response_model=ChecklistResponse)
async def update_checklist(
    checklist_id: int,
    checklist_update: ChecklistUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    checklist = (
        db.query(Checklist)
        .filter(Checklist.id == checklist_id, Checklist.owner_id == current_user.id)
        .first()
    )

    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    if checklist_update.name is not None:
        checklist.name = checklist_update.name
    if checklist_update.description is not None:
        checklist.description = checklist_update.description
    if checklist_update.language is not None:
        checklist.language = checklist_update.language

    db.commit()
    db.refresh(checklist)

    return checklist


@router.delete("/{checklist_id}")
async def delete_checklist(
    checklist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    checklist = (
        db.query(Checklist)
        .filter(Checklist.id == checklist_id, Checklist.owner_id == current_user.id)
        .first()
    )

    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    # Prevent deletion of template checklists
    if checklist.is_template:
        raise HTTPException(
            status_code=403, detail="Template checklists cannot be deleted"
        )

    db.delete(checklist)
    db.commit()

    return {"message": "Checklist deleted successfully"}


@router.post("/{checklist_id}/items", response_model=ChecklistItemResponse)
async def add_checklist_item(
    checklist_id: int,
    item: ChecklistItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    checklist = (
        db.query(Checklist)
        .filter(Checklist.id == checklist_id, Checklist.owner_id == current_user.id)
        .first()
    )

    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    db_item = ChecklistItem(
        checklist_id=checklist_id,
        type=item.type,
        text=item.text,
        is_required=item.is_required,
        order=item.order,
    )

    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    return db_item
