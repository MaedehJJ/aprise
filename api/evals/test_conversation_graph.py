"""
Unit tests for the LangGraph coaching turn graph.

Run from the api/ directory:
    uv run pytest evals/test_conversation_graph.py -v

No real API keys, no database, no network required.
All LLM calls are mocked via unittest.mock.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch
import pytest

from db.models import ConversationStep
from services.conversation_graph import CoachingState, coaching_graph


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _base_state(**overrides) -> CoachingState:
    """Returns a minimal valid CoachingState, with optional field overrides."""
    base: CoachingState = {
        "history": "Coach: Tell me about your experience with distributed systems.",
        "user_message": "I built a Kafka-based event pipeline at my last job.",
        "jd_company": "Acme Corp",
        "jd_role": "Staff Engineer",
        "jd_labels": "{'role_focus': 'infra', 'tech_depth': 'high'}",
        "jd_required_skills": "Kafka, distributed systems, Python",
        "jd_notes": "None",
        "user_memories": "- Built REST APIs\n- Kafka event pipeline",
        "company_research": "Acme Corp is a distributed systems startup.",
        "star_stories": "",
        "gaps": ["distributed systems experience", "Kafka knowledge"],
        "questions_asked": [],
        "answers": [],
        "questions_remaining": 2,
        "current_step": ConversationStep.GAP_CONVERSATION.value,
        "assistant_response": "",
        "newly_promoted_memories": [],
    }
    base.update(overrides)
    return base


def _mock_ai(
    *,
    remaining_gaps: list[str] | None = None,
    text_response: str = "Great, that addresses the Kafka gap. Tell me about system design.",
    should_promote: bool = False,
    promoted_memories: list | None = None,
) -> MagicMock:
    """
    Creates a mock AIService.

    - structured() is called by extract_answer_node (returns remaining_gaps)
      and promote_memory_node (returns should_promote + memories).
    - text() is called by gap_conversation_node, resume_transition_node,
      and resume_drafting_node.
    """
    ai = MagicMock()

    # extract_answer response
    extract_result = MagicMock()
    extract_result.remaining_gaps = remaining_gaps if remaining_gaps is not None else []
    extract_result.answer_summary = "User described Kafka pipeline experience."

    # memory promotion response
    promo_result = MagicMock()
    promo_result.should_promote = should_promote
    promo_result.memories = promoted_memories or []

    # structured() returns are order-dependent: first call = extract_answer,
    # second call = promote_memory
    ai.structured.side_effect = [extract_result, promo_result]

    ai.text.return_value = text_response
    return ai


def _config(ai: MagicMock, memory_summary: str = "- Built REST APIs\n- Python 5yrs") -> dict:
    return {
        "configurable": {
            "ai_service": ai,
            "existing_memory_summary": memory_summary,
        },
        "metadata": {
            "conversation_id": "test-conv-id",
            "user_id": "test-user-id",
            "jd_id": "test-jd-id",
        },
    }


# ── Tests: GAP_CONVERSATION branch ────────────────────────────────────────────

class TestGapConversationBranch:

    def test_gaps_remain_after_answer(self):
        """
        User addresses one gap → one gap remains → gap_conversation node runs.
        """
        ai = _mock_ai(
            remaining_gaps=["distributed systems experience"],
            text_response="Good Kafka background! Now — walk me through a distributed systems challenge.",
        )
        state = _base_state()
        result = coaching_graph.invoke(state, _config(ai))

        assert result["assistant_response"] == (
            "Good Kafka background! Now — walk me through a distributed systems challenge."
        )
        assert result["gaps"] == ["distributed systems experience"]
        assert result["questions_remaining"] == 1
        # Still in gap-filling mode
        assert result["current_step"] == ConversationStep.GAP_CONVERSATION.value

    def test_all_gaps_addressed_triggers_resume_transition(self):
        """
        User addresses all gaps → no gaps remain → step_transition routes to
        resume_transition_node → current_step becomes RESUME_GENERATION.
        """
        transition_msg = "You've covered all the key areas! Ready to draft your resume — want me to start with your Kafka work or the distributed systems project?"
        ai = _mock_ai(
            remaining_gaps=[],       # all gaps addressed
            text_response=transition_msg,
        )
        state = _base_state()
        result = coaching_graph.invoke(state, _config(ai))

        assert result["assistant_response"] == transition_msg
        assert result["gaps"] == []
        assert result["questions_remaining"] == 0
        assert result["current_step"] == ConversationStep.RESUME_GENERATION.value

    def test_answers_list_accumulates(self):
        """answers list grows with each turn (used for resume-transition context)."""
        ai = _mock_ai(remaining_gaps=["distributed systems experience"])
        state = _base_state(answers=["Led a team of 4 engineers."])
        result = coaching_graph.invoke(state, _config(ai))

        # The new answer summary is appended
        assert len(result["answers"]) == 2

    def test_no_gaps_in_state_skips_extract_llm_call(self):
        """
        If the conversation already has no gaps, extract_answer_node skips the
        LLM call entirely and goes straight to step_transition → resume_transition.
        """
        ai = _mock_ai(
            remaining_gaps=[],
            text_response="Let's draft your resume now!",
        )
        # Already at zero gaps
        state = _base_state(gaps=[], questions_remaining=0)
        result = coaching_graph.invoke(state, _config(ai))

        # extract_answer skipped LLM (structured not called for extraction)
        # The graph should still proceed to resume_transition
        assert result["current_step"] == ConversationStep.RESUME_GENERATION.value
        assert result["assistant_response"] != ""


# ── Tests: RESUME_GENERATION branch ───────────────────────────────────────────

class TestResumeDraftingBranch:

    def test_resume_drafting_returns_response(self):
        """
        Conversation already in RESUME_GENERATION → router sends directly to
        resume_drafting_node, which generates a bullet-writing response.
        """
        ai = MagicMock()
        ai.text.return_value = "Here's a strong bullet for your Kafka work: ..."

        state = _base_state(
            gaps=[],
            questions_remaining=0,
            current_step=ConversationStep.RESUME_GENERATION.value,
            user_message="Can you draft a bullet for my Kafka pipeline project?",
        )
        result = coaching_graph.invoke(state, _config(ai))

        assert result["assistant_response"] == "Here's a strong bullet for your Kafka work: ..."
        # No gap extraction happens in resume mode
        ai.structured.assert_not_called()
        assert result["current_step"] == ConversationStep.RESUME_GENERATION.value


# ── Tests: Memory promotion ────────────────────────────────────────────────────

class TestMemoryPromotion:

    def test_memories_returned_when_promoted(self):
        """
        promote_memory_node detects promotable content → newly_promoted_memories
        is populated for the caller to embed and save.
        """
        mem = MagicMock()
        mem.content = "I prefer Python over Java for data pipelines."
        mem.chunk_type = "PREFERENCE"

        ai = _mock_ai(
            remaining_gaps=["distributed systems experience"],
            should_promote=True,
            promoted_memories=[mem],
        )
        state = _base_state()
        result = coaching_graph.invoke(state, _config(ai))

        assert len(result["newly_promoted_memories"]) == 1
        assert result["newly_promoted_memories"][0]["content"] == (
            "I prefer Python over Java for data pipelines."
        )
        assert result["newly_promoted_memories"][0]["chunk_type"] == "PREFERENCE"

    def test_no_promotion_when_not_relevant(self):
        """When should_promote is False, newly_promoted_memories is empty."""
        ai = _mock_ai(remaining_gaps=["distributed systems experience"], should_promote=False)
        state = _base_state()
        result = coaching_graph.invoke(state, _config(ai))

        assert result["newly_promoted_memories"] == []

    def test_promotion_failure_does_not_break_turn(self):
        """
        If promote_memory_node's LLM call throws, the graph should complete
        with an empty promotion list — not raise an exception to the caller.
        """
        ai = MagicMock()

        # First call (extract_answer) succeeds
        extract_result = MagicMock()
        extract_result.remaining_gaps = ["distributed systems experience"]
        extract_result.answer_summary = "Kafka background."

        # Second call (promote_memory) raises
        ai.structured.side_effect = [extract_result, RuntimeError("OpenAI timeout")]
        ai.text.return_value = "Next question about distributed systems."

        state = _base_state()
        result = coaching_graph.invoke(state, _config(ai))

        # Turn still completes successfully
        assert result["assistant_response"] == "Next question about distributed systems."
        assert result["newly_promoted_memories"] == []


# ── Tests: Extract-answer failure resilience ──────────────────────────────────

class TestExtractAnswerResilience:

    def test_extract_failure_keeps_all_gaps(self):
        """
        If extract_answer's LLM call fails, all gaps are kept (safe fallback)
        and the turn still completes.
        """
        ai = MagicMock()
        # Both structured() calls fail
        ai.structured.side_effect = RuntimeError("Network error")
        ai.text.return_value = "Let's keep exploring your background."

        state = _base_state(gaps=["Kafka", "system design"])
        result = coaching_graph.invoke(state, _config(ai))

        # Kept all original gaps
        assert result["gaps"] == ["Kafka", "system design"]
        assert result["questions_remaining"] == 2
        # But turn still produced a response
        assert result["assistant_response"] == "Let's keep exploring your background."


# ── Tests: INTERVIEW_PREP routing ─────────────────────────────────────────────

class TestInterviewPrepRouting:

    def test_interview_prep_step_routes_to_interview_coaching(self):
        """
        Regression: router_node must send INTERVIEW_PREP step → interview_coaching,
        not extract_answer (which would corrupt interview state with gap logic).
        """
        ai = MagicMock()
        ai.text.return_value = "Great answer! Here's a follow-up: tell me about a time you handled conflict."

        state = _base_state(
            current_step=ConversationStep.INTERVIEW_PREP.value,
            user_message="I led a project under tight deadlines by prioritising ruthlessly.",
            star_stories="- Built Kafka pipeline (STAR story 1)\n- Led infra migration (STAR story 2)",
            gaps=[],
            questions_remaining=0,
        )
        config = _config(ai)
        result = coaching_graph.invoke(state, config)

        # interview_coaching uses ai.text(), not ai.structured()
        ai.text.assert_called_once()
        ai.structured.assert_not_called()

        assert result["assistant_response"] == (
            "Great answer! Here's a follow-up: tell me about a time you handled conflict."
        )
        assert result["current_step"] == ConversationStep.INTERVIEW_PREP.value

    def test_interview_prep_does_not_modify_gaps(self):
        """
        Interview coaching must not alter the gaps list — gap extraction only
        runs for GAP_CONVERSATION, not INTERVIEW_PREP.
        """
        ai = MagicMock()
        ai.text.return_value = "Good use of the STAR format."

        initial_gaps = []
        state = _base_state(
            current_step=ConversationStep.INTERVIEW_PREP.value,
            gaps=initial_gaps,
            star_stories="- Led a data migration project",
        )
        result = coaching_graph.invoke(state, _config(ai))

        assert result["gaps"] == []
        ai.structured.assert_not_called()
