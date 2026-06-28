import asyncio
import json
import logging
import uuid
from typing import AsyncGenerator

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, load_only, selectinload

from db.models import (
    ChunkType,
    Conversation,
    ConversationMessage,
    ConversationState,
    ConversationStep,
    JD,
    JDNote,
    JDNoteType,
    Memory,
    MessageRole,
    Profile,
)
from services.ai_service import AIOutputParsingError, AIService
from services.conversation_graph import CoachingState, coaching_graph
from services.gap_detection_service import GapDetectionService
from services.utils import get_profile_or_404

logger = logging.getLogger(__name__)

# Keep at most this many turns in the LLM context window.
# The opening message (index 0) is always included for anchoring.
MAX_HISTORY_TURNS = 20


class ConversationService:

    def __init__(self, db: AsyncSession, ai: AIService) -> None:
        self.db = db
        self._ai = ai

    # ── Conversations ──────────────────────────────────────────────────────

    async def create_conversation(self, jd_id: uuid.UUID, clerk_user_id: str) -> Conversation:
        """
        Creates a new conversation for a JD. Runs gap detection immediately and
        stores the opening coaching message as the first assistant message.
        """
        profile = await get_profile_or_404(self.db, clerk_user_id)
        jd = await self._get_jd(jd_id, profile.id)

        if (
            await self.db.execute(select(Conversation).filter_by(jd_id=jd_id))
        ).scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A conversation for this JD already exists.",
            )

        gap_service = GapDetectionService(db=self.db, ai=self._ai)
        gap_result = await gap_service.detect(jd=jd, profile=profile)

        initial_state: ConversationState = {
            "gaps": gap_result.gaps,
            "questions_asked": [],
            "answers": [],
            "questions_remaining": len(gap_result.gaps),
        }

        conversation = Conversation(
            user_id=profile.id,
            jd_id=jd_id,
            current_step=ConversationStep.GAP_CONVERSATION,
            state=initial_state,
        )
        self.db.add(conversation)
        await self.db.flush()

        opening_message = ConversationMessage(
            conversation_id=conversation.id,
            role=MessageRole.ASSISTANT,
            content=gap_result.initial_message,
        )
        self.db.add(opening_message)
        await self.db.commit()

        # Re-fetch with relationships eager-loaded so callers can access conv.jd
        # and conv.messages without triggering a lazy-load in the async session.
        conv = (
            await self.db.execute(
                select(Conversation)
                .filter_by(id=conversation.id)
                .options(
                    joinedload(Conversation.jd),
                    selectinload(Conversation.messages),
                )
            )
        ).scalars().unique().one()
        return conv

    async def list_conversations(
        self, clerk_user_id: str, limit: int = 50, offset: int = 0
    ) -> list[Conversation]:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        return (
            await self.db.execute(
                select(Conversation)
                .filter_by(user_id=profile.id)
                .options(
                    joinedload(Conversation.jd),
                    selectinload(Conversation.messages),
                )
                .order_by(Conversation.updated_at.desc())
                .offset(offset)
                .limit(limit)
            )
        ).scalars().unique().all()

    async def get_conversation(self, conversation_id: uuid.UUID, clerk_user_id: str) -> Conversation:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        conv = (
            await self.db.execute(
                select(Conversation)
                .filter_by(id=conversation_id, user_id=profile.id)
                .options(
                    joinedload(Conversation.jd),
                    selectinload(Conversation.messages),
                )
            )
        ).scalars().unique().one_or_none()
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found."
            )
        return conv

    async def send_message(
        self, conversation_id: uuid.UUID, clerk_user_id: str, content: str
    ) -> ConversationMessage:
        """
        Handles a user message turn via the LangGraph coaching graph.

        Flow (per call):
          1. Load conversation + JD from DB.
          2. Save the user message.
          3. Pre-compute semantic memory context for deduplication (no DB in graph).
          4. Invoke coaching_graph with the current state.
          5. Persist: assistant message, updated gaps/step, promoted memories.
        """
        profile = await get_profile_or_404(self.db, clerk_user_id)
        conv = await self.get_conversation(conversation_id, clerk_user_id)

        # Snapshot history BEFORE saving the user message so the graph
        # only sees prior context (not the message it is responding to).
        prior_messages = list(conv.messages)

        user_msg = ConversationMessage(
            conversation_id=conv.id,
            role=MessageRole.USER,
            content=content,
        )
        self.db.add(user_msg)
        # Commit the user message immediately so it is never lost if the graph
        # raises an exception downstream. The assistant message is committed in a
        # second transaction after a successful graph run.
        await self.db.commit()
        await self.db.refresh(user_msg)

        jd = conv.jd  # already eagerly loaded via joinedload in get_conversation
        db_state: ConversationState = conv.state or {}
        jd_notes = (
            await self.db.execute(select(JDNote).filter_by(jd_id=jd.id))
        ).scalars().all()

        current_gaps: list[str] = list(db_state.get("gaps", []))

        # ── Pre-compute memory context — batch both embed calls into one round-trip
        coaching_memory_query = content
        if current_gaps:
            coaching_memory_query = f"{content} {current_gaps[0]}"

        try:
            vectors = self._ai.embed_documents([coaching_memory_query, content])
            coaching_vector, dedup_vector = vectors[0], vectors[1]
        except Exception:
            logger.warning("Batch embed failed — falling back to empty context", exc_info=True)
            coaching_vector, dedup_vector = None, None

        # Retrieve coaching memories and dedup summary in parallel.
        user_memories, existing_memory_summary = await asyncio.gather(
            self._retrieve_coaching_memories_by_vector(
                user_id=profile.id, query_vector=coaching_vector
            ),
            self._get_nearby_memory_summary_by_vector(
                user_id=profile.id, query_vector=dedup_vector
            ),
        )

        # ── Build graph input state ────────────────────────────────────────────
        req = jd.parsed_requirements or {}
        star_stories_text = ""
        if conv.current_step == ConversationStep.INTERVIEW_PREP:
            star_stories_text = await self._load_star_stories(profile.id, jd.id)

        graph_state: CoachingState = {
            "history": self._format_history(prior_messages),
            "user_message": content,
            "jd_company": jd.company_name or "the company",
            "jd_role": jd.role_title or "this role",
            "jd_labels": str(jd.labels or {}),
            "jd_required_skills": ", ".join(req.get("required_skills", [])),
            "jd_responsibilities": (
                "\n- " + "\n- ".join(req.get("responsibilities", []))
                if req.get("responsibilities") else "Not specified"
            ),
            "jd_notes": self._format_jd_notes(jd_notes),
            "user_memories": user_memories,
            "company_research": jd.company_research or "",
            "star_stories": star_stories_text,
            "gaps": current_gaps,
            "questions_asked": list(db_state.get("questions_asked", [])),
            "answers": list(db_state.get("answers", [])),
            "questions_remaining": int(db_state.get("questions_remaining", 0)),
            "current_step": conv.current_step.value,
            "assistant_response": "",
            "newly_promoted_memories": [],
        }

        graph_config = {
            "configurable": {
                "ai_service": self._ai,
                "existing_memory_summary": existing_memory_summary,
            },
            "run_name": "coaching_turn",
            "tags": [f"conversation:{conv.id}", f"jd:{jd.id}"],
            "metadata": {
                "conversation_id": str(conv.id),
                "user_id": str(profile.id),
                "jd_id": str(jd.id),
            },
        }

        logger.info(
            "Invoking coaching_graph [conv=%s step=%s gaps=%d]",
            conv.id, conv.current_step.value, len(graph_state["gaps"]),
        )
        # Run the sync graph in a thread to avoid blocking the event loop.
        result: CoachingState = await asyncio.to_thread(
            coaching_graph.invoke, graph_state, graph_config
        )

        assistant_text: str = result["assistant_response"]
        if not assistant_text:
            raise AIOutputParsingError("coaching_graph returned an empty assistant_response.")

        # ── Persist assistant message ──────────────────────────────────────────
        assistant_msg = ConversationMessage(
            conversation_id=conv.id,
            role=MessageRole.ASSISTANT,
            content=assistant_text,
        )
        self.db.add(assistant_msg)

        # ── Persist updated conversation state ────────────────────────────────
        new_step_value: str = result["current_step"]
        updated_state: ConversationState = {
            **db_state,
            "gaps": result["gaps"],
            "questions_asked": result["questions_asked"],
            "answers": result["answers"],
            "questions_remaining": result["questions_remaining"],
        }
        conv.state = updated_state
        if new_step_value != conv.current_step.value:
            conv.current_step = ConversationStep(new_step_value)
            logger.info(
                "Conversation %s transitioned to %s", conv.id, new_step_value
            )

        # ── Persist promoted memories ─────────────────────────────────────────
        await self._persist_promoted_memories(
            memories=result["newly_promoted_memories"], profile=profile
        )

        await self.db.commit()
        await self.db.refresh(assistant_msg)
        return assistant_msg

    async def stream_message(
        self,
        conversation_id: uuid.UUID,
        clerk_user_id: str,
        content: str,
    ) -> AsyncGenerator[str, None]:
        """
        Streaming variant of send_message. Yields SSE-formatted strings.

        Events:
          data: {"type": "token",  "content": "<fragment>"}
          data: {"type": "done",   "message_id": "<uuid>", "content": "<full>",
                                   "current_step": "<step>"}
          data: {"type": "error",  "detail": "<message>"}

        The graph nodes (gap_conversation, resume_transition, resume_drafting) use
        ChatOpenAI(streaming=True) so _stream_text() captures individual tokens via
        an asyncio queue bridge and puts them on an async queue. This async generator
        reads from that queue and yields SSE events immediately — so the client sees
        tokens as they arrive, not all at once.
        """
        profile = await get_profile_or_404(self.db, clerk_user_id)
        conv = await self.get_conversation(conversation_id, clerk_user_id)
        prior_messages = list(conv.messages)

        user_msg = ConversationMessage(
            conversation_id=conv.id,
            role=MessageRole.USER,
            content=content,
        )
        self.db.add(user_msg)
        await self.db.commit()
        await self.db.refresh(user_msg)

        jd = conv.jd
        db_state: ConversationState = conv.state or {}
        jd_notes = (
            await self.db.execute(select(JDNote).filter_by(jd_id=jd.id))
        ).scalars().all()
        current_gaps: list[str] = list(db_state.get("gaps", []))

        coaching_memory_query = content
        if current_gaps:
            coaching_memory_query = f"{content} {current_gaps[0]}"

        try:
            vectors = self._ai.embed_documents([coaching_memory_query, content])
            coaching_vector, dedup_vector = vectors[0], vectors[1]
        except Exception:
            logger.warning("Batch embed failed — falling back to empty context", exc_info=True)
            coaching_vector, dedup_vector = None, None

        # Retrieve coaching memories and dedup summary in parallel.
        user_memories, existing_memory_summary = await asyncio.gather(
            self._retrieve_coaching_memories_by_vector(
                user_id=profile.id, query_vector=coaching_vector
            ),
            self._get_nearby_memory_summary_by_vector(
                user_id=profile.id, query_vector=dedup_vector
            ),
        )

        # For INTERVIEW_PREP mode, load STAR stories for the coach prompt.
        star_stories_text = ""
        if conv.current_step == ConversationStep.INTERVIEW_PREP:
            star_stories_text = await self._load_star_stories(profile.id, jd.id)

        requirements = jd.parsed_requirements or {}
        responsibilities_text = (
            "\n- " + "\n- ".join(requirements.get("responsibilities", []))
            if requirements.get("responsibilities")
            else "Not specified"
        )

        graph_state: CoachingState = {
            "history": self._format_history(prior_messages),
            "user_message": content,
            "jd_company": jd.company_name or "the company",
            "jd_role": jd.role_title or "this role",
            "jd_labels": str(jd.labels or {}),
            "jd_required_skills": ", ".join(requirements.get("required_skills", [])),
            "jd_responsibilities": responsibilities_text,
            "jd_notes": self._format_jd_notes(jd_notes),
            "user_memories": user_memories,
            "company_research": jd.company_research or "",
            "star_stories": star_stories_text,
            "gaps": current_gaps,
            "questions_asked": list(db_state.get("questions_asked", [])),
            "answers": list(db_state.get("answers", [])),
            "questions_remaining": int(db_state.get("questions_remaining", 0)),
            "current_step": conv.current_step.value,
            "assistant_response": "",
            "newly_promoted_memories": [],
        }

        # ── Async queue bridge for real-time streaming ────────────────────────
        # coaching_graph.invoke() runs in a thread executor. _stream_text() in
        # conversation_graph.py calls ChatOpenAI.stream() and puts each token into
        # a queue via the _BridgeQueue adapter below. This async generator reads
        # from the asyncio.Queue without blocking the event loop.
        loop = asyncio.get_running_loop()
        async_queue: asyncio.Queue = asyncio.Queue()

        class _BridgeQueue:
            """Bridges sync .put() calls from the graph thread to the async queue."""
            def put(self, token: str | None) -> None:
                loop.call_soon_threadsafe(async_queue.put_nowait, token)

        graph_config = {
            "configurable": {
                "ai_service": self._ai,
                "existing_memory_summary": existing_memory_summary,
                "_token_queue": _BridgeQueue(),
            },
            "run_name": "coaching_turn_stream",
            "tags": [f"conversation:{conv.id}", f"jd:{jd.id}"],
            "metadata": {
                "conversation_id": str(conv.id),
                "user_id": str(profile.id),
                "jd_id": str(jd.id),
            },
        }

        logger.info(
            "Streaming coaching_graph [conv=%s step=%s gaps=%d]",
            conv.id, conv.current_step.value, len(graph_state["gaps"]),
        )

        graph_result: dict = {}

        def _run_graph() -> None:
            try:
                result = coaching_graph.invoke(graph_state, graph_config)
                graph_result["state"] = result
            except Exception as exc:
                graph_result["error"] = exc
            finally:
                loop.call_soon_threadsafe(async_queue.put_nowait, None)  # sentinel

        # Start the graph in a thread; do not await yet — we'll drain the queue first.
        graph_future = loop.run_in_executor(None, _run_graph)

        text_parts: list[str] = []
        while True:
            token = await async_queue.get()
            if token is None:
                break
            text_parts.append(token)
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        # Ensure the graph thread has fully completed before accessing graph_result.
        await graph_future

        if "error" in graph_result:
            exc = graph_result["error"]
            logger.error("coaching_graph error [conv=%s]: %s", conv.id, exc, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Coaching graph failed. Please try again.'})}\n\n"
            return

        final_state: CoachingState = graph_result["state"]
        full_text = "".join(text_parts)

        # Fallback: _stream_text fell back to AIService.text() (no queue writes),
        # so take the full response from the final state.
        if not full_text:
            full_text = final_state.get("assistant_response", "")
            if full_text:
                yield f"data: {json.dumps({'type': 'token', 'content': full_text})}\n\n"

        if not full_text:
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Empty response from coaching graph.'})}\n\n"
            return

        # ── Persist assistant message + state ─────────────────────────────────
        assistant_msg = ConversationMessage(
            conversation_id=conv.id,
            role=MessageRole.ASSISTANT,
            content=full_text,
        )
        self.db.add(assistant_msg)

        new_step_value: str = final_state["current_step"]
        updated_state: ConversationState = {
            **db_state,
            "gaps": final_state["gaps"],
            "questions_asked": final_state["questions_asked"],
            "answers": final_state["answers"],
            "questions_remaining": final_state["questions_remaining"],
        }
        conv.state = updated_state
        if new_step_value != conv.current_step.value:
            conv.current_step = ConversationStep(new_step_value)
            logger.info("Conversation %s transitioned to %s", conv.id, new_step_value)

        await self._persist_promoted_memories(
            memories=final_state["newly_promoted_memories"], profile=profile
        )

        await self.db.commit()
        await self.db.refresh(assistant_msg)

        yield (
            f"data: {json.dumps({'type': 'done', 'message_id': str(assistant_msg.id), 'content': full_text, 'current_step': new_step_value})}\n\n"
        )

    # ── Interview Prep ────────────────────────────────────────────────────

    async def start_interview_prep(self, conversation_id: uuid.UUID, clerk_user_id: str) -> Conversation:
        """
        Transitions a conversation from RESUME_GENERATION to INTERVIEW_PREP.
        Returns the opening interview coaching message as the first message of that mode.
        """
        profile = await get_profile_or_404(self.db, clerk_user_id)
        conv = await self.get_conversation(conversation_id, clerk_user_id)

        allowed_steps = {ConversationStep.RESUME_GENERATION, ConversationStep.INTERVIEW_PREP}
        if conv.current_step not in allowed_steps:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot start interview prep from step '{conv.current_step.value}'. "
                       "Complete resume generation first.",
            )

        if conv.current_step == ConversationStep.INTERVIEW_PREP:
            # Already in interview prep — idempotent.
            return conv

        conv.current_step = ConversationStep.INTERVIEW_PREP
        opening = ConversationMessage(
            conversation_id=conv.id,
            role=MessageRole.ASSISTANT,
            content=(
                f"Great work on the resume! Let's get you ready for the interview at "
                f"{conv.jd.company_name or 'the company'}. "
                "I'll be asking you behavioral questions tailored to the role. "
                "Answer as you would in a real interview — be specific and use concrete examples. "
                "Ready when you are. Type anything to get your first question."
            ),
        )
        self.db.add(opening)
        await self.db.commit()
        await self.db.refresh(conv)
        return conv

    # ── JD Notes ──────────────────────────────────────────────────────────

    async def add_jd_note(
        self,
        jd_id: uuid.UUID,
        clerk_user_id: str,
        note_type: JDNoteType,
        content: str,
    ) -> JDNote:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        await self._get_jd(jd_id, profile.id)

        note = JDNote(
            user_id=profile.id,
            jd_id=jd_id,
            note_type=note_type,
            content=content,
        )
        self.db.add(note)
        await self.db.commit()
        await self.db.refresh(note)
        return note

    async def list_jd_notes(self, jd_id: uuid.UUID, clerk_user_id: str) -> list[JDNote]:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        await self._get_jd(jd_id, profile.id)
        return (
            await self.db.execute(select(JDNote).filter_by(jd_id=jd_id))
        ).scalars().all()

    async def delete_jd_note(self, note_id: uuid.UUID, clerk_user_id: str) -> None:
        profile = await get_profile_or_404(self.db, clerk_user_id)
        note = (
            await self.db.execute(
                select(JDNote).filter_by(id=note_id, user_id=profile.id)
            )
        ).scalar_one_or_none()
        if not note:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Note not found."
            )
        await self.db.delete(note)
        await self.db.commit()

    # ── Helpers ───────────────────────────────────────────────────────────

    async def _get_jd(self, jd_id: uuid.UUID, profile_id: uuid.UUID) -> JD:
        jd = (
            await self.db.execute(select(JD).filter_by(id=jd_id, user_id=profile_id))
        ).scalar_one_or_none()
        if not jd:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="JD not found."
            )
        return jd

    async def _retrieve_coaching_memories_by_vector(
        self, user_id: uuid.UUID, query_vector: list[float] | None
    ) -> str:
        """
        Semantic search for memories most relevant to the current coaching turn.
        Accepts a pre-computed embedding so the caller can batch embed calls.
        Falls back to a safe string on any error.
        """
        if query_vector is None:
            return "No background information available yet."
        try:
            memories = (
                await self.db.execute(
                    select(Memory)
                    .options(load_only(Memory.content, Memory.chunk_type))
                    .filter(Memory.user_id == user_id)
                    .order_by(Memory.embedding.op("<=>")(query_vector))
                    .limit(10)
                )
            ).scalars().all()
            if not memories:
                return "No background information available yet."
            return "\n\n".join(f"[{m.chunk_type.value}] {m.content}" for m in memories)
        except Exception:
            logger.warning(
                "Coaching memory retrieval failed for user %s — coaching without background",
                user_id,
                exc_info=True,
            )
            return "No background information available yet."

    async def _get_nearby_memory_summary_by_vector(
        self, user_id: uuid.UUID, query_vector: list[float] | None
    ) -> str:
        """
        Semantic search for deduplication context in promote_memory_node.
        Accepts a pre-computed embedding so the caller can batch embed calls.
        """
        if query_vector is None:
            return "None"
        try:
            nearby = (
                await self.db.execute(
                    select(Memory)
                    .options(load_only(Memory.content))
                    .filter(Memory.user_id == user_id)
                    .order_by(Memory.embedding.op("<=>")(query_vector))
                    .limit(8)
                )
            ).scalars().all()
            return "\n".join(f"- {m.content[:200]}" for m in nearby) or "None"
        except Exception:
            logger.warning(
                "Memory semantic search failed for user %s — using empty summary",
                user_id,
                exc_info=True,
            )
            return "None"

    async def _persist_promoted_memories(
        self, memories: list[dict[str, str]], profile: Profile
    ) -> None:
        """
        Embeds and persists memories returned by promote_memory_node.
        Errors are logged but never re-raised — promotion failure must not
        break the conversation turn.
        """
        if not memories:
            return

        valid_chunk_types = {c.value for c in ChunkType}
        try:
            contents = [m["content"] for m in memories]
            vectors = self._ai.embed_documents(contents)
            for mem_data, vector in zip(memories, vectors):
                chunk_str = mem_data.get("chunk_type", "OTHER").upper()
                if chunk_str not in valid_chunk_types:
                    chunk_str = "OTHER"
                self.db.add(
                    Memory(
                        user_id=profile.id,
                        content=mem_data["content"],
                        embedding=vector,
                        chunk_type=ChunkType(chunk_str),
                    )
                )
            await self.db.flush()
            logger.info("Persisted %d promoted memories for user %s", len(memories), profile.id)
        except Exception:
            logger.warning(
                "Memory promotion persistence failed for user %s — %d memories lost",
                profile.id,
                len(memories),
                exc_info=True,
            )

    async def _load_star_stories(self, profile_id: uuid.UUID, jd_id: uuid.UUID) -> str:
        """Load all STAR stories for a user and format them for the interview coaching prompt."""
        try:
            from db.models import StarStory
            stories = (
                await self.db.execute(
                    select(StarStory)
                    .filter(StarStory.user_id == profile_id)
                    .order_by(StarStory.created_at.desc())
                    .limit(10)
                )
            ).scalars().all()
            if not stories:
                return "No prior STAR stories recorded yet."
            parts = []
            for s in stories:
                parts.append(
                    f"[{s.title}]\n"
                    f"Situation: {s.situation}\n"
                    f"Action: {s.task_action}\n"
                    f"Result: {s.result}\n"
                    f"Skills: {', '.join(s.skills or [])}"
                )
            return "\n\n".join(parts)
        except Exception:
            logger.warning("Failed to load STAR stories for interview prep", exc_info=True)
            return "No prior STAR stories recorded yet."

    @staticmethod
    def _format_history(messages: list[ConversationMessage]) -> str:
        if not messages:
            return "(no prior messages)"

        # Always include the opening message for context; then take the most recent turns.
        if len(messages) > MAX_HISTORY_TURNS:
            messages = [messages[0]] + messages[-(MAX_HISTORY_TURNS - 1):]

        lines = []
        for m in messages:
            # Use [AI] / [Human] markers — the LLM doesn't mirror these, unlike
            # "Coach:" / "User:" labels which it tends to copy verbatim.
            prefix = "[AI]" if m.role == MessageRole.ASSISTANT else "[Human]"
            lines.append(f"{prefix} {m.content}")
        return "\n\n".join(lines)

    @staticmethod
    def _format_jd_notes(notes: list[JDNote]) -> str:
        if not notes:
            return "None"
        return "\n".join(f"[{note.note_type.value}] {note.content}" for note in notes)
