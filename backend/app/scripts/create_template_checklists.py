#!/usr/bin/env python3
"""
Script to create template checklists in the database.
This script adds:
- German template checklist with 10 questions and 10 conditions
- English template checklist with 10 questions and 10 conditions
Both assigned to the admin user.
"""

import sys

from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.core.database import SessionLocal, engine
from app.models.models import User, Checklist, ChecklistItem, Base


def create_template_checklists():
    """Create template checklists in the database."""
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Find the admin user
        admin_user = db.query(User).filter(User.email == "admin@email.com").first()
        if not admin_user:
            print("Admin user not found! Please run create_admin_user.py first.")
            return

        print(f"Found admin user: {admin_user.full_name} (ID: {admin_user.id})")

        # German template checklist
        german_checklist = Checklist(
            name="Deutsche Ausschreibungs-Checkliste",
            description="Template checklist for German tenders with questions and conditions",
            language="de",
            is_template=True,
            template_category="german_tender",
            owner_id=admin_user.id,
        )

        db.add(german_checklist)
        db.flush()  # Get the ID

        # German questions
        german_questions = [
            "In welcher Form sind die Angebote/Teilnahmeanträge einzureichen?",
            "Wann ist die Frist für die Einreichung von Bieterfragen?",
            "Welche Unterlagen müssen mit dem Angebot eingereicht werden?",
            "Wie ist die Bewertung der Angebote strukturiert?",
            "Welche Nachweise sind für die Eignung erforderlich?",
            "Wie werden die Angebote versiegelt und übermittelt?",
            "Welche Kriterien werden für die Vergabe herangezogen?",
            "Wie ist der Zeitplan für das Vergabeverfahren?",
            "Welche Sicherheiten sind zu leisten?",
            "Wie erfolgt die Bekanntgabe der Ergebnisse?",
        ]

        # German conditions
        german_conditions = [
            "Ist die Abgabefrist vor dem 31.12.2025?",
            "Werden alle erforderlichen Nachweise vollständig eingereicht?",
            "Ist das Angebot fristgerecht eingegangen?",
            "Sind alle Pflichtangaben im Angebot enthalten?",
            "Erfüllt der Bieter die Mindestanforderungen?",
            "Ist das Angebot wirtschaftlich?",
            "Sind alle Sicherheiten ordnungsgemäß hinterlegt?",
            "Wurden alle Bewertungskriterien berücksichtigt?",
            "Ist das Angebot rechtlich zulässig?",
            "Sind alle Dokumente vollständig und lesbar?",
        ]

        # Add German questions
        for i, question in enumerate(german_questions):
            item = ChecklistItem(
                checklist_id=german_checklist.id,
                type="question",
                text=question,
                is_required=True,
                order=i,
            )
            db.add(item)

        # Add German conditions
        for i, condition in enumerate(german_conditions):
            item = ChecklistItem(
                checklist_id=german_checklist.id,
                type="condition",
                text=condition,
                is_required=True,
                order=i + 10,
            )
            db.add(item)

        # English template checklist
        english_checklist = Checklist(
            name="English Tender Checklist",
            description="Template checklist for English tenders with questions and conditions",
            language="en",
            is_template=True,
            template_category="english_tender",
            owner_id=admin_user.id,
        )

        db.add(english_checklist)
        db.flush()  # Get the ID

        # English questions
        english_questions = [
            "In what form should offers/applications be submitted?",
            "When is the deadline for submitting bidder questions?",
            "Which documents must be submitted with the offer?",
            "How is the evaluation of offers structured?",
            "What evidence is required for qualification?",
            "How are offers sealed and submitted?",
            "What criteria are used for awarding the contract?",
            "What is the timeline for the procurement procedure?",
            "What securities are to be provided?",
            "How are the results communicated?",
        ]

        # English conditions
        english_conditions = [
            "Is the submission deadline before 31.12.2025?",
            "Are all required documents submitted completely?",
            "Was the offer submitted on time?",
            "Are all mandatory information included in the offer?",
            "Does the bidder meet the minimum requirements?",
            "Is the offer economically viable?",
            "Are all securities properly deposited?",
            "Were all evaluation criteria considered?",
            "Is the offer legally permissible?",
            "Are all documents complete and readable?",
        ]

        # Add English questions
        for i, question in enumerate(english_questions):
            item = ChecklistItem(
                checklist_id=english_checklist.id,
                type="question",
                text=question,
                is_required=True,
                order=i,
            )
            db.add(item)

        # Add English conditions
        for i, condition in enumerate(english_conditions):
            item = ChecklistItem(
                checklist_id=english_checklist.id,
                type="condition",
                text=condition,
                is_required=True,
                order=i + 10,
            )
            db.add(item)

        db.commit()

        print("Template checklists created successfully!")
        print(f"German checklist ID: {german_checklist.id}")
        print(f"English checklist ID: {english_checklist.id}")
        print(
            f"Total items in German checklist: {len(german_questions) + len(german_conditions)}"
        )
        print(
            f"Total items in English checklist: {len(english_questions) + len(english_conditions)}"
        )

    except Exception as e:
        print(f"Error creating template checklists: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_template_checklists()
