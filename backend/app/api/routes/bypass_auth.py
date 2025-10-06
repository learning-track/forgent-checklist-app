import hashlib
import secrets

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from passlib.context import CryptContext

from app.core.database import engine

# Use the same password context as the auth module
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str


class User(BaseModel):
    id: int
    email: str
    is_active: bool
    is_admin: bool


class UserRegistration(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    password: str


class UserRegistrationResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    is_active: bool
    message: str


# Simple token storage (in production, use Redis or database)
valid_tokens = {}  # token -> user_id mapping

security = HTTPBearer()


@router.post("/token", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    """Login endpoint that supports both hardcoded admin and database users"""
    try:
        # First check for hardcoded admin credentials (backward compatibility)
        if (
            login_data.username == "admin@tenderassistant.com"
            and login_data.password == "admin123"
        ):
            access_token = secrets.token_urlsafe(32)
            valid_tokens[access_token] = 1  # Admin user ID is 1
            return LoginResponse(access_token=access_token, token_type="bearer")

        # Then check database users
        with engine.connect() as conn:
            result = conn.execute(
                text(
                    """
                    SELECT id, email, username, full_name, is_active, is_admin, hashed_password FROM users 
                    WHERE (email = :login OR username = :login) AND is_active = true
                """
                ),
                {
                    "login": login_data.username,  # Can be email or username
                },
            )
            user = result.fetchone()

            if user and pwd_context.verify(login_data.password, user[6]):  # user[6] is hashed_password
                # Create simple token
                access_token = secrets.token_urlsafe(32)
                valid_tokens[access_token] = user[0]  # Store user ID with token
                return LoginResponse(access_token=access_token, token_type="bearer")
            else:
                raise HTTPException(
                    status_code=401, detail="Incorrect email/username or password"
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Dependency to get current user from token"""
    token = credentials.credentials
    if token not in valid_tokens:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    # Get user ID from token
    user_id = valid_tokens[token]

    # Fetch user from database
    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT id, email, username, full_name, is_active, is_admin FROM users WHERE id = :user_id"
            ),
            {"user_id": user_id},
        )
        user = result.fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return User(id=user[0], email=user[1], is_active=user[4], is_admin=user[5])


@router.post("/register", response_model=UserRegistrationResponse)
async def register_user(user_data: UserRegistration):
    """Register a new user"""
    try:
        # Check if user already exists
        with engine.connect() as conn:
            # Check email
            email_result = conn.execute(
                text("SELECT id FROM users WHERE email = :email"),
                {"email": user_data.email},
            )
            if email_result.fetchone():
                raise HTTPException(status_code=400, detail="Email already registered")

            # Check username
            username_result = conn.execute(
                text("SELECT id FROM users WHERE username = :username"),
                {"username": user_data.username},
            )
            if username_result.fetchone():
                raise HTTPException(status_code=400, detail="Username already taken")

            # Hash password using bcrypt
            hashed_password = pwd_context.hash(user_data.password)

            # Insert new user
            result = conn.execute(
                text(
                    """
                    INSERT INTO users (email, username, full_name, hashed_password, is_active, is_admin)
                    VALUES (:email, :username, :full_name, :password, :is_active, :is_admin)
                    RETURNING id
                """
                ),
                {
                    "email": user_data.email,
                    "username": user_data.username,
                    "full_name": user_data.full_name,
                    "password": hashed_password,
                    "is_active": True,
                    "is_admin": False,
                },
            )

            user_id = result.fetchone()[0]
            conn.commit()

            return UserRegistrationResponse(
                id=user_id,
                email=user_data.email,
                username=user_data.username,
                full_name=user_data.full_name,
                is_active=True,
                message="User registered successfully",
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")


@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    # Return actual user info
    return {
        "id": current_user.id,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "is_admin": current_user.is_admin,
    }
