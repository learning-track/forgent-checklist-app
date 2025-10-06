from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Text,
    Boolean,
    ForeignKey,
    JSON,
    Float,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships - temporarily disabled to fix startup issues
    # documents = relationship("Document", back_populates="owner")
    # checklists = relationship("Checklist", back_populates="owner")
    # analyses = relationship("Analysis", back_populates="owner")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String, nullable=False)
    language = Column(String, default="de")  # de, en
    status = Column(
        String, default="uploaded"
    )  # uploaded, processing, processed, error
    content = Column(Text)  # Extracted text content
    document_metadata = Column(JSON)  # Additional metadata
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships - temporarily disabled to fix startup issues
    # owner = relationship("User", back_populates="documents")


class Checklist(Base):
    __tablename__ = "checklists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    language = Column(String, default="de")  # de, en
    is_template = Column(Boolean, default=False)
    template_category = Column(String)  # german_tender, english_tender, custom
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships - temporarily disabled to fix startup issues
    # owner = relationship("User", back_populates="checklists")
    items = relationship(
        "ChecklistItem", back_populates="checklist", cascade="all, delete-orphan"
    )


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("checklists.id"))
    type = Column(String, nullable=False)  # question, condition
    text = Column(Text, nullable=False)
    is_required = Column(Boolean, default=True)
    order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    checklist = relationship("Checklist", back_populates="items")
    results = relationship("AnalysisResult", back_populates="checklist_item")


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    ai_model = Column(String, nullable=False)  # claude-3.5-sonnet, gpt-5, etc.
    processing_time = Column(Float)  # Time in seconds
    owner_id = Column(Integer, ForeignKey("users.id"))
    checklist_id = Column(Integer, ForeignKey("checklists.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    # Relationships - temporarily disabled to fix startup issues
    # owner = relationship("User", back_populates="analyses")
    results = relationship(
        "AnalysisResult", back_populates="analysis", cascade="all, delete-orphan"
    )


class AnalysisDocument(Base):
    __tablename__ = "analysis_documents"

    analysis_id = Column(Integer, ForeignKey("analyses.id"), primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), primary_key=True)


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"))
    checklist_item_id = Column(Integer, ForeignKey("checklist_items.id"))
    document_id = Column(
        Integer, ForeignKey("documents.id")
    )  # Which document this result came from
    document_name = Column(String)  # Document filename for easy reference
    answer = Column(Text)  # AI-generated answer
    condition_result = Column(Boolean)  # For condition type items
    confidence_score = Column(Float)  # AI confidence score
    evidence = Column(Text)  # Supporting text excerpts
    page_references = Column(JSON)  # Page numbers where evidence was found
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    analysis = relationship("Analysis", back_populates="results")
    checklist_item = relationship("ChecklistItem", back_populates="results")
    document = relationship("Document")
