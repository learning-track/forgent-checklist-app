import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import documents, checklists, analysis, bypass_auth
from app.core.config import settings
from app.core.database import engine
from app.models import models
from app.websocket_manager import websocket_manager

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Forgent Checklist App API",
    description="AI-powered tender document analysis and checklist generation",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(bypass_auth.router, prefix="/api/auth", tags=["bypass-auth"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(checklists.router, prefix="/api/checklists", tags=["checklists"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])


@app.get("/")
async def root():
    return {"message": "Forgent Checklist App API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    """WebSocket endpoint for real-time analysis updates"""
    await websocket_manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            # Echo back for connection testing
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, user_id)
