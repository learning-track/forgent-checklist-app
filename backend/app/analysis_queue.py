"""
Analysis queue system for managing and processing analyses
"""

import asyncio
import logging

from typing import Dict, List

from app.core.database import SessionLocal
from app.models.models import Analysis
from app.services.ai_service import AIService
from app.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)


class AnalysisQueue:
    """Manages the analysis processing queue"""

    def __init__(self):
        self.queue: List[int] = []  # List of analysis IDs
        self.processing: Dict[int, bool] = (
            {}
        )  # Track which analyses are being processed
        self.max_concurrent = 2  # Maximum concurrent analyses
        self.is_running = False

    async def add_analysis(self, analysis_id: int):
        """Add an analysis to the queue"""
        if analysis_id not in self.queue:
            self.queue.append(analysis_id)
            logger.info(
                f"Added analysis {analysis_id} to queue. Queue position: {len(self.queue)}"
            )

            # Notify user about queue position
            db = SessionLocal()
            try:
                analysis = await asyncio.to_thread(
                    lambda: db.query(Analysis)
                    .filter(Analysis.id == analysis_id)
                    .first()
                )
                if analysis:
                    await websocket_manager.send_queue_update(
                        analysis.owner_id, len(self.queue), len(self.queue)
                    )
            finally:
                db.close()

            # Start processing if not already running
            if not self.is_running:
                logger.info("Starting queue processing...")
                asyncio.create_task(self.process_queue())
            else:
                logger.info("Queue is already running, analysis added to queue")
                # Try to process immediately if we have capacity
                asyncio.create_task(self._process_available_analyses())

    async def process_queue(self):
        """Process the analysis queue"""
        if self.is_running:
            logger.info("Queue is already running, skipping...")
            return

        self.is_running = True
        logger.info("Starting analysis queue processing")

        try:
            # Process queue without blocking the event loop
            await self._process_available_analyses()

        finally:
            self.is_running = False
            logger.info("Analysis queue processing stopped")

    async def _process_available_analyses(self):
        """Process available analyses without blocking"""
        while self.queue and len(self.processing) < self.max_concurrent:
            analysis_id = self.queue.pop(0)
            self.processing[analysis_id] = True
            logger.info(f"Starting analysis {analysis_id}")
            # Use asyncio.create_task to run in background without blocking
            asyncio.create_task(self.process_analysis(analysis_id))

    async def process_analysis(self, analysis_id: int):
        """Process a single analysis"""
        logger.info(f"Processing analysis {analysis_id}")
        db = SessionLocal()
        try:
            # Use asyncio.to_thread to run database operations in a thread pool
            analysis = await asyncio.to_thread(
                lambda: db.query(Analysis).filter(Analysis.id == analysis_id).first()
            )
            if not analysis:
                logger.error(f"Analysis {analysis_id} not found")
                return

            # Update status to processing
            analysis.status = "processing"
            await asyncio.to_thread(db.commit)

            # Notify frontend
            await websocket_manager.send_analysis_update(analysis_id, "processing", 0)

            logger.info(f"Processing analysis {analysis_id}: {analysis.name}")

            # Get analysis documents and checklist using proper queries
            from app.models.models import (
                AnalysisDocument,
                Document,
                Checklist,
                ChecklistItem,
            )

            # Get document IDs from the many-to-many relationship
            analysis_docs = await asyncio.to_thread(
                lambda: db.query(AnalysisDocument)
                .filter(AnalysisDocument.analysis_id == analysis.id)
                .all()
            )
            document_ids = [ad.document_id for ad in analysis_docs]
            documents = await asyncio.to_thread(
                lambda: db.query(Document).filter(Document.id.in_(document_ids)).all()
            )

            checklist = await asyncio.to_thread(
                lambda: db.query(Checklist)
                .filter(Checklist.id == analysis.checklist_id)
                .first()
            )

            if not documents or not checklist:
                analysis.status = "failed"
                analysis.error_message = "Missing documents or checklist"
                await asyncio.to_thread(db.commit)
                await websocket_manager.send_analysis_update(
                    analysis_id, "failed", error="Missing documents or checklist"
                )
                return

            # Get checklist items
            checklist_items = await asyncio.to_thread(
                lambda: db.query(ChecklistItem)
                .filter(ChecklistItem.checklist_id == checklist.id)
                .all()
            )

            # Process each checklist item for each document separately
            total_items = len(checklist_items) * len(documents)
            current_item = 0

            for item in checklist_items:
                for doc in documents:
                    try:
                        # Update progress
                        progress = int((current_item / total_items) * 100)
                        await websocket_manager.send_analysis_update(
                            analysis_id, "processing", progress
                        )
                        current_item += 1

                        # Analyze single document for this checklist item
                        ai_service = AIService()
                        result = await ai_service.analyze_document_item(
                            documents=[doc],  # Process one document at a time
                            checklist_item=item,
                            ai_model=analysis.ai_model,
                        )

                        # Add document information to result
                        result["document_id"] = doc.id
                        result["document_name"] = doc.original_filename

                        # Save result to database
                        from app.models.models import AnalysisResult

                        analysis_result = AnalysisResult(
                            analysis_id=analysis_id,
                            checklist_item_id=item.id,
                            document_id=result.get("document_id"),
                            document_name=result.get("document_name"),
                            answer=result.get("answer"),
                            condition_result=result.get("condition_result"),
                            confidence_score=result.get("confidence_score"),
                            evidence=result.get("evidence"),
                            page_references=result.get("page_references", []),
                        )
                        await asyncio.to_thread(lambda: db.add(analysis_result))
                        await asyncio.to_thread(db.commit)

                        logger.info(
                            f"Processed item {item.id} for document {doc.original_filename} in analysis {analysis_id}"
                        )

                    except Exception as e:
                        logger.error(
                            f"Error processing item {item.id} for document {doc.original_filename} in analysis {analysis_id}: {e}"
                        )
                        continue

            # Mark analysis as completed
            analysis.status = "completed"
            await asyncio.to_thread(db.commit)

            # Final notification
            await websocket_manager.send_analysis_update(analysis_id, "completed", 100)
            logger.info(f"Completed analysis {analysis_id}: {analysis.name}")

        except Exception as e:
            logger.error(f"Error processing analysis {analysis_id}: {e}")
            try:
                analysis.status = "failed"
                analysis.error_message = str(e)
                await asyncio.to_thread(db.commit)
                await websocket_manager.send_analysis_update(
                    analysis_id, "failed", error=str(e)
                )
            except:
                pass
        finally:
            # Remove from processing
            self.processing.pop(analysis_id, None)
            db.close()

            # Try to process more analyses if queue has items
            if self.queue and not self.is_running:
                asyncio.create_task(self.process_queue())


# Global analysis queue instance
analysis_queue = AnalysisQueue()
