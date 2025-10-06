#!/usr/bin/env python3
"""
Test script to verify the setup works correctly.
"""

import sys
import os
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.models.models import User, Checklist, ChecklistItem

def test_setup():
    """Test if the setup data exists."""
    db = SessionLocal()
    try:
        # Check if admin user exists
        admin_user = db.query(User).filter(User.email == "admin@email.com").first()
        if admin_user:
            print(f"✅ Admin user found: {admin_user.email}")
        else:
            print("❌ Admin user not found")
            
        # Check if template checklists exist
        german_checklist = db.query(Checklist).filter(
            Checklist.template_category == "german_tender"
        ).first()
        if german_checklist:
            print(f"✅ German template checklist found: {german_checklist.name}")
            items_count = db.query(ChecklistItem).filter(
                ChecklistItem.checklist_id == german_checklist.id
            ).count()
            print(f"   - Items: {items_count}")
        else:
            print("❌ German template checklist not found")
            
        english_checklist = db.query(Checklist).filter(
            Checklist.template_category == "english_tender"
        ).first()
        if english_checklist:
            print(f"✅ English template checklist found: {english_checklist.name}")
            items_count = db.query(ChecklistItem).filter(
                ChecklistItem.checklist_id == english_checklist.id
            ).count()
            print(f"   - Items: {items_count}")
        else:
            print("❌ English template checklist not found")
            
    except Exception as e:
        print(f"❌ Error testing setup: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_setup()
