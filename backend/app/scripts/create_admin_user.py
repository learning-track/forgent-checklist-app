#!/usr/bin/env python3
"""
Script to create the first admin user in the database.
This script adds a user with:
- Email: admin@email.com
- Username: admin
- Full name: Admin Admin
- Password: admin
"""

import sys

from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.api.routes.auth import get_password_hash
from app.core.database import SessionLocal, engine
from app.models.models import User, Base


def create_admin_user():
    """Create the admin user in the database."""
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Check if admin user already exists
        existing_user = db.query(User).filter(User.email == "admin@email.com").first()
        if existing_user:
            print("Admin user already exists!")
            print(f"User ID: {existing_user.id}")
            print(f"Email: {existing_user.email}")
            print(f"Username: {existing_user.username}")
            print(f"Full name: {existing_user.full_name}")
            return

        # Create the admin user
        hashed_password = get_password_hash("admin")

        admin_user = User(
            email="admin@email.com",
            username="admin",
            full_name="Admin Admin",
            hashed_password=hashed_password,
            is_active=True,
            is_admin=True,
        )

        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print("Admin user created successfully!")
        print(f"User ID: {admin_user.id}")
        print(f"Email: {admin_user.email}")
        print(f"Username: {admin_user.username}")
        print(f"Full name: {admin_user.full_name}")
        print(f"Is admin: {admin_user.is_admin}")

    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_admin_user()
