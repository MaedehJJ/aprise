import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

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
from services.ai_service import AIService
from services.conversation_graph import CoachingState, coaching_graph
from services.gap_detection_service import GapDetectionService
from services.utils import get_profile_or_404

logger = logging.getLogger(__name__)

# Keep at most this many turns in the LLM context window.
# The opening message (index 0) is always included for anchoring.
MAX_HISTORY_TURNS = 20


class ConversationService:

    def __init__(self, db: Session, ai: AIService) -> None:
        self.db = db
        self._ai = ai

    # ── Conversations ──────────────────────────────────────────────────────

    def create_conversation(self, jd_id: uuid.UUID, clerk_user_id: str) -> Conversation:
        """
        Creates a new conversation for a JD. Runs gap detection immediately and
        stores the opening coaching message as the first assistant message.
        """
        profile = get_profile_or_404(self.db, clerk_user_id)
        jd = self._get_jd(jd_id, profile.id)

        if self.db.query(Conversation).filter_by(jd_id=jd_id).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A conversation for this JD already exists.",
            )

        gap_service = GapDetectionService(db=self.db, ai=self._ai)
        gap_result = gap_service.detect(jd=jd, profile=profile)

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
        self.db.flush()

        opening_message = ConversationMessage(
            conversation_id=conversation.id,
            role=MessageRole.ASSISTANT,
            content=gap_result.initial_message,
        )
        self.db.add(opening_message)
        self.db.commit()
        self.db.refresh(conversation)
        return conversation

    def list_conversations(self, clerk_user_id: str) -> list[Conversation]:
        profile = get_profile_or_404(self.db, clerk_user_id)
        return (
            self.db.query(Conversation)
            .filter_by(user_id=profile.id)
            # Eagerly load jd and the latest message to avoid N+1 on serialization.
            .options(
                joinedload(Conversation.jd),
                selectinload(Conversation.messages),
            )
            .order_by(Conversation.updated_at.desc())
            .all()
        )

    def get_conversation(self, conversation_id: uuid.UUID, clerk_user_id: str) -> Conversation:
        profile = get_profile_or_404(self.db, clerk_user_id)
        conv = (
            self.db.query(Conversation)
            .filter_by(id=conversation_id, user_id=profile.id)
            .options(
                joinedload(Conversation.jd),
                selectinload(Conversation.messages),
            )
            .first()
        )
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found."
            )
        return conv

    def send_message(
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
        profile = get_profile_or_404(self.db, clerk_user_id)
        conv = self.get_conversation(conversation_id, clerk_user_id)

        # Snapshot history BEFORE saving the user message so the graph
        # only sees prior context (not the message it is responding to).
        prior_messages = list(conv.messages)

        user_msg = ConversationMessage(
            conversation_id=conv.id,
            role=MessageRole.USER,
            content=content,
        )
        self.db.add(user_msg)
        self.db.flush()

        jd = conv.jd  # already eagerly loaded via selectinload in get_conversation
        db_state: ConversationState = conv.state or {}
        jd_notes = self.db.query(JDNote).filter_by(jd_id=jd.id).all()

        current_gaps: list[str] = list(db_state.get("gaps", []))

        # ── Pre-compute memory context (DB-free graph) ─────────────────────────
        # 1. Coaching context: rich memories relevant to this turn.
        #    Query combines the user's message with the top pending gap so we
        #    retrieve memories useful for BOTH the answer AND the next question.
        coaching_memory_query = content
        if current_gaps:
            coaching_memory_query = f"{content} {current_gaps[0]}"
        user_memories = self._retrieve_coaching_memories(
            user_id=profile.id, query_text=coaching_memory_query
        )

        # 2. Deduplication context for the promote_memory_node.
        existing_memory_summary = self._get_nearby_memory_summary(
            user_id=profile.id, query_text=content
        )

        # ── Build graph input state ────────────────────────────────────────────
        graph_state: CoachingState = {
            "history": self._format_history(prior_messages),
            "user_message": content,
            "jd_company": jd.company_name or "the company",
            "jd_role": jd.role_title or "this role",
            "jd_labels": str(jd.labels or {}),
            "jd_required_skills": ", ".join(
                (jd.parsed_requirements or {}).get("required_skills", [])
            ),
            "jd_notes": self._format_jd_notes(jd_notes),
            "user_memories": user_memories,
            "company_research": jd.company_research or "",
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
        result: CoachingState = coaching_graph.invoke(graph_state, graph_config)

        assistant_text: str = result["assistant_response"]
        if not assistant_text:
            raise RuntimeError("coaching_graph returned an empty assistant_response.")

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
        self._persist_promoted_memories(
            memories=result["newly_promoted_memories"], profile=profile
        )

        self.db.commit()
        self.db.refresh(assistant_msg)
        return assistant_msg

    # ── JD Notes ──────────────────────────────────────────────────────────

    def add_jd_note(
        self,
        jd_id: uuid.UUID,
        clerk_user_id: str,
        note_type: JDNoteType,
        content: str,
    ) -> JDNote:
        profile = get_profile_or_404(self.db, clerk_user_id)
        self._get_jd(jd_id, profile.id)

        note = JDNote(
            user_id=profile.id,
            jd_id=jd_id,
            note_type=note_type,
            content=content,
        )
        self.db.add(note)
        self.db.commit()
        self.db.refresh(note)
        return note

    def list_jd_notes(self, jd_id: uuid.UUID, clerk_user_id: str) -> list[JDNote]:
        profile = get_profile_or_404(self.db, clerk_user_id)
        self._get_jd(jd_id, profile.id)
        return self.db.query(JDNote).filter_by(jd_id=jd_id).all()

    def delete_jd_note(self, note_id: uuid.UUID, clerk_user_id: str) -> None:
        profile = get_profile_or_404(self.db, clerk_user_id)
        note = (
            self.db.query(JDNote)
            .filter_by(id=note_id, user_id=profile.id)
            .first()
        )
        if not note:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Note not found."
            )
        self.db.delete(note)
        self.db.commit()

    # ── Helpers ───────────────────────────────────────────────────────────

    def _get_jd(self, jd_id: uuid.UUID, profile_id: uuid.UUID) -> JD:
        jd = self.db.query(JD).filter_by(id=jd_id, user_id=profile_id).first()
        if not jd:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="JD not found."
            )
        return jd

    def _retrieve_coaching_memories(self, user_id: uuid.UUID, query_text: str) -> str:
        """
        Semantic search for memories most relevant to the current coaching turn.
        Returns full memory content formatted for LLM prompts.

        Uses the user message + first pending gap as the combined query so the
        retrieved context is relevant to both the answer given and the next question.
        Falls back to an empty string on error so the coach still responds.
        """
        try:
            query_vector = self._ai.embed(query_text)
            memories = (
                self.db.query(Memory)
                .filter(Memory.user_id == user_id)
                .order_by(Memory.embedding.op("<=>")(query_vector))
                .limit(10)
                .all()
            )
            if not memories:
                return "No background information available yet."
            lines = [f"[{m.chunk_type.value}] {m.content}" for m in memories]
            return "\n\n".join(lines)
        except Exception:
            logger.warning(
                "Coaching memory retrieval failed for user %s — coaching without background",
                user_id,
                exc_info=True,
            )
            return "No background information available yet."

    def _get_nearby_memory_summary(self, user_id: uuid.UUID, query_text: str) -> str:
        """
        Runs a semantic search against the user's existing memories and returns
        a short bullet-point summary for deduplication context in promote_memory_node.
        Errors are swallowed — an empty summary is safe fallback.
        """
        try:
            query_vector = self._ai.embed(query_text)
            nearby = (
                self.db.query(Memory)
                .filter(Memory.user_id == user_id)
                .order_by(Memory.embedding.op("<=>")(query_vector))
                .limit(8)
                .all()
            )
            return "\n".join(f"- {m.content[:200]}" for m in nearby) or "None"
        except Exception:
            logger.warning(
                "Memory semantic search failed for user %s — using empty summary",
                user_id,
                exc_info=True,
            )
            return "None"

    def _persist_promoted_memories(
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
            self.db.flush()
            logger.info("Persisted %d promoted memories for user %s", len(memories), profile.id)
        except Exception:
            logger.warning(
                "Memory promotion persistence failed for user %s — %d memories lost",
                profile.id,
                len(memories),
                exc_info=True,
            )
            # Metric hook: increment a counter here once an observability sink
            # (Datadog / Sentry custom metric) is configured.

    @staticmethod
    def _format_history(messages: list[ConversationMessage]) -> str:
        if not messages:
            return "(no prior messages)"

        # Always include the opening message for context; then take the most recent turns.
        if len(messages) > MAX_HISTORY_TURNS:
            messages = [messages[0]] + messages[-(MAX_HISTORY_TURNS - 1):]

        lines = []
        for m in messages:
            prefix = "Coach" if m.role == MessageRole.ASSISTANT else "User"
            lines.append(f"{prefix}: {m.content}")
        return "\n\n".join(lines)

    @staticmethod
    def _format_jd_notes(notes: list[JDNote]) -> str:
        if not notes:
            return "None"
        return "\n".join(f"[{note.note_type.value}] {note.content}" for note in notes)
