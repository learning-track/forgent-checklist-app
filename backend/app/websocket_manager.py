"""
WebSocket connection manager for real-time analysis status updates
"""

import asyncio
import json
import logging

from fastapi import WebSocket
from typing import Dict, Set

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages WebSocket connections for real-time updates"""

    def __init__(self):
        # Store active connections by user_id
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # Store connections by analysis_id for targeted updates
        self.analysis_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        """Accept a new WebSocket connection"""
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()

        self.active_connections[user_id].add(websocket)
        logger.info(f"WebSocket connected for user {user_id}")

    def disconnect(self, websocket: WebSocket, user_id: int):
        """Remove a WebSocket connection"""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

        # Remove from analysis connections
        for analysis_id, connections in self.analysis_connections.items():
            connections.discard(websocket)
            if not connections:
                del self.analysis_connections[analysis_id]

        logger.info(f"WebSocket disconnected for user {user_id}")

    async def send_to_user(self, user_id: int, message: dict):
        """Send message to all connections for a specific user"""
        if user_id in self.active_connections:
            dead_connections = set()
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error sending message to user {user_id}: {e}")
                    dead_connections.add(websocket)

            # Clean up dead connections
            for websocket in dead_connections:
                self.active_connections[user_id].discard(websocket)

    async def send_analysis_update(
        self, analysis_id: int, status: str, progress: int = None, error: str = None
    ):
        """Send analysis status update to all connected clients"""
        message = {
            "type": "analysis_update",
            "analysis_id": analysis_id,
            "status": status,
            "progress": progress,
            "error": error,
            "timestamp": asyncio.get_event_loop().time(),
        }

        # Send to all active connections (broadcast)
        for user_id, connections in self.active_connections.items():
            dead_connections = set()
            for websocket in connections:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error sending analysis update: {e}")
                    dead_connections.add(websocket)

            # Clean up dead connections
            for websocket in dead_connections:
                connections.discard(websocket)

    async def send_queue_update(
        self, user_id: int, queue_position: int, total_in_queue: int
    ):
        """Send queue position update to a specific user"""
        message = {
            "type": "queue_update",
            "queue_position": queue_position,
            "total_in_queue": total_in_queue,
            "timestamp": asyncio.get_event_loop().time(),
        }

        await self.send_to_user(user_id, message)


# Global WebSocket manager instance
websocket_manager = WebSocketManager()
