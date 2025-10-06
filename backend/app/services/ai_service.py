import anthropic
import asyncio
import json

from typing import List, Dict, Any

from app.core.config import settings
from app.models.models import Document, ChecklistItem


class AIService:
    def __init__(self):
        # Initialize clients only if API keys are available
        self.anthropic_client = None
        
        if settings.ANTHROPIC_API_KEY:
            try:
                self.anthropic_client = anthropic.Anthropic(
                    api_key=settings.ANTHROPIC_API_KEY
                )
                print("Anthropic client initialized successfully")
            except Exception as e:
                print(f"Warning: Could not initialize Anthropic client: {e}")
                self.anthropic_client = None
        else:
            print("Warning: ANTHROPIC_API_KEY not set")

    async def analyze_document_item(
        self,
        documents: List[Document],
        checklist_item: ChecklistItem,
        ai_model: str = "claude-3-haiku",
    ) -> Dict[str, Any]:
        """Analyze a checklist item against documents using AI"""

        # Combine document content
        combined_content = ""
        for doc in documents:
            combined_content += f"\n--- Document: {doc.original_filename} ---\n"
            combined_content += doc.content or ""

        # Choose AI service based on model
        if ai_model.startswith("claude"):
            return await self._analyze_with_claude(combined_content, checklist_item)
        else:
            # Default to Claude
            return await self._analyze_with_claude(combined_content, checklist_item)

    async def _analyze_with_claude(
        self, content: str, checklist_item: ChecklistItem
    ) -> Dict[str, Any]:
        """Analyze using Claude 3.5 Sonnet"""
        
        # Check if Anthropic client is available
        if not self.anthropic_client:
            return {
                "answer": "AI service not available: Anthropic API key not configured",
                "condition_result": None,
                "confidence_score": 0.0,
                "evidence": "-",
                "page_references": [],
            }

        system_prompt = """You are an expert at analyzing German and English tender documents. 
        Your task is to answer questions and evaluate conditions based on the provided document content.
        
        For questions: Provide a clear, concise answer based on the document content.
        For conditions: Evaluate whether the condition is true or false AND provide a detailed explanation of your evaluation.
        
        Always provide:
        1. A clear answer or detailed evaluation explanation
        2. Supporting evidence as an **exact text match copied verbatim** from the document. 
            - If no direct evidence is found, set "evidence" to "-"
        3. Page references as integers only (e.g., [1, 2, 3], not ["page 1", "section 2"])
            - Page numbers must indicate exactly where the evidence appears
        4. A confidence score between 0.0 and 1.0

        CRITICAL: You MUST respond with ONLY valid JSON. No additional text, explanations, or formatting.
        
        Respond with ONLY this JSON structure:
        {
            "answer": "Your detailed answer or evaluation explanation here",
            "condition_result": true,
            "confidence_score": 0.95,
            "evidence": "Exact supporting text from the document or '-' if not available",
            "page_references": [1, 2, 3]
        }

        IMPORTANT RULES:
            - Respond with ONLY the JSON object, nothing else
            - "answer" must contain a detailed explanation for both questions and conditions
            - For conditions, the "answer" should explain WHY the condition is met or not met
            - "evidence" must be a **verbatim quote** from the document (no paraphrasing, no summaries, no explanations)
            - "evidence" must be copied exactly as it appears in the document text
            - If no matching text exists, use "-" as evidence and set a lower confidence score
            - Do NOT write "The document states that..." or "It further specifies that..." in evidence
            - Do NOT summarize or explain the evidence - just copy the exact text
            - "page_references" must be an array of integers only, never strings
            - For questions, set "condition_result" to null
            - For conditions, set "condition_result" to true or false"""

        user_prompt = f"""Document Content: {content}

Task: {checklist_item.type.upper()}
Text: {checklist_item.text}

Analyze this and respond with ONLY the JSON object as specified in the system prompt."""

        try:
            # Use asyncio.to_thread to run the API call in a thread pool
            response = await asyncio.to_thread(
                lambda: self.anthropic_client.messages.create(
                    model="claude-3-haiku-20240307",
                    max_tokens=1000,  # Reduced to prevent timeout
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}],
                )
            )

            # Parse JSON response with better error handling
            response_text = response.content[0].text.strip()
            print(f"Raw Claude response: {response_text[:200]}...")  # Debug logging

            # Clean the response text to remove control characters
            import re
            # Remove control characters except newlines and tabs
            response_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', response_text)
            
            # Try to extract JSON from response if it's wrapped in markdown
            if "```json" in response_text:
                start = response_text.find("```json") + 7
                end = response_text.find("```", start)
                if end != -1:
                    response_text = response_text[start:end].strip()
            elif "```" in response_text:
                start = response_text.find("```") + 3
                end = response_text.find("```", start)
                if end != -1:
                    response_text = response_text[start:end].strip()

            # Try to find JSON object in the response
            try:
                if response_text.startswith("{") and response_text.endswith("}"):
                    result = json.loads(response_text)
                else:
                    # Try to extract JSON object from the response
                    start = response_text.find("{")
                    end = response_text.rfind("}") + 1
                    if start != -1 and end > start:
                        json_text = response_text[start:end]
                        # Clean the extracted JSON as well
                        json_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', json_text)
                        result = json.loads(json_text)
                    else:
                        print(f"Failed to find JSON in response: {response_text}")
                        raise ValueError("No valid JSON found in response")
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")
                print(f"Problematic JSON: {response_text}")
                # Try to fix common JSON issues
                try:
                    # Replace single quotes with double quotes
                    fixed_json = response_text.replace("'", '"')
                    result = json.loads(fixed_json)
                except:
                    raise ValueError(f"Invalid JSON format: {e}")

            return {
                "answer": result.get("answer", ""),
                "condition_result": result.get("condition_result"),
                "confidence_score": result.get("confidence_score", 0.5),
                "evidence": result.get("evidence", ""),
                "page_references": result.get("page_references", []),
            }

        except Exception as e:
            print(f"Claude API error: {str(e)}")
            # Return error response with low confidence
            return {
                "answer": f"Unable to analyze due to API error: {str(e)}",
                "condition_result": None,
                "confidence_score": 0.0,
                "evidence": "-",
                "page_references": [],
            }
