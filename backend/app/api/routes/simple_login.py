import hashlib
import secrets

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, text

router = APIRouter()

# Direct database connection
engine = create_engine("postgresql://postgres:password@postgres:5432/postgres")


class LoginRequest(BaseModel):
    username: str  # This will be the email
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str


def create_simple_token():
    # Create a simple token without JWT
    return secrets.token_urlsafe(32)


@router.post("/token", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    try:
        # Hash the provided password
        hashed_password = hashlib.sha256(login_data.password.encode()).hexdigest()

        # Check if user exists with correct password
        with engine.connect() as conn:
            result = conn.execute(
                text(
                    """
                SELECT id, email, is_active FROM users 
                WHERE email = :email AND hashed_password = :password AND is_active = true
            """
                ),
                {
                    "email": login_data.username,  # username is actually email
                    "password": hashed_password,
                },
            )
            user = result.fetchone()

            if user:
                # Create simple token
                access_token = create_simple_token()
                return LoginResponse(access_token=access_token, token_type="bearer")
            else:
                raise HTTPException(
                    status_code=401, detail="Incorrect email or password"
                )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")


@router.get("/me")
async def get_current_user():
    # Simple endpoint that returns user info
    return {"id": 1, "email": "admin@tenderassistant.com", "is_active": True}
