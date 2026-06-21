"""
LangGraph-powered coaching turn graph.

Design principles
─────────────────
- Stateless invocation: the graph is compiled once at import time and invoked once
  per user message. There is no LangGraph checkpointer — all persistence is owned
  by the caller (ConversationService) via SQLAlchemy.
- Pure computation: graph nodes never touch the database. They receive pre-loaded
  context in `CoachingState` and return updated state fields. The caller persists
  deltas (assistant message, updated gaps, promoted memories, step transition).
- Dependency injection via config["configurable"]: the AI service is passed in by
  the caller so nodes remain unit-testable without FastAPI or a live DB.

Graph topology (per-request flow)
───────────────────────────────────
                    ┌─────────────────────────────────┐
            START → │           router_node            │
                    │  (reads current_step, routes)    │
                    └───────────┬─────────────┬────────┘
                                │             │
                  GAP_CONVERSATION       RESUME_GENERATION
                                │             │
                    ┌───────────▼──┐    ┌─────▼────────────┐
                    │extract_answer│    │  resume_drafting  │ → END
                    │    _node     │    └──────────────────-┘
                    └─────────────┘
                           │
                    ┌──────▼──────┐
                    │promote_mem  │
                    │  ory_node   │
                    └─────────────┘
                           │
                    ┌──────▼──────────┐
                    │step_transition  │
                    │     _node       │
                    └────┬───────┬────┘
                         │       │
                 gaps     │       │  no gaps left
                 remain   │       │
                    ┌─────▼──┐ ┌─▼──────────────┐
                    │  gap_  │ │resume_transition│
                    │conv.   │ │     _node       │
                    └───┬────┘ └────────┬────────┘
                        └──────┬────────┘
                               ▼
                              END
"""

import logging
from typing import Any, Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command
from typing_extensions import TypedDict

from db.models import ConversationStep
from prompts import (
    conversation_response_prompt,
    extract_answer_prompt,
    memory_promotion_prompt,
    resume_drafting_prompt,
    resume_transition_prompt,
)
from services.ai_service import AIService

logger = logging.getLogger(__name__)


# ── State ─────────────────────────────────────────────────────────────────────

class CoachingState(TypedDict):
    """
    In-flight state for a single coaching turn.

    Populated by ConversationService before graph.invoke(), read back afterwards.
    Nodes may mutate `gaps`, `questions_asked`, `answers`, `questions_remaining`,
    `current_step`, `assistant_response`, and `newly_promoted_memories`.
    All other fields are read-only context.
    """

    # ── Read-only context (set by caller, never mutated by nodes) ─────────────
    history: str           # pre-formatted conversation history for prompts
    user_message: str      # the current user's message (already saved to DB)
    jd_company: str
    jd_role: str
    jd_labels: str         # str(jd.labels) — included in prompts as-is
    jd_required_skills: str
    jd_notes: str
    user_memories: str     # pre-formatted relevant memories for coaching prompts
    company_research: str  # Tavily-sourced company summary (empty string if unavailable)

    # ── Mutable gap tracking (mutated by extract_answer_node) ─────────────────
    gaps: list[str]
    questions_asked: list[str]
    answers: list[str]
    questions_remaining: int

    # ── Mutable step (mutated by step_transition_node) ────────────────────────
    current_step: str      # ConversationStep.value string

    # ── Output fields (written by terminal nodes, read by caller) ─────────────
    assistant_response: str
    #: List of plain dicts {"content": str, "chunk_type": str} for the caller
    #: to embed and persist. Nodes never touch the DB directly.
    newly_promoted_memories: list[dict[str, str]]


# ── Helper ────────────────────────────────────────────────────────────────────

def _ai(config: RunnableConfig) -> AIService:
    """Retrieve the AIService injected by the caller."""
    ai: AIService | None = config.get("configurable", {}).get("ai_service")
    if ai is None:
        raise RuntimeError(
            "conversation_graph requires 'ai_service' in config['configurable']. "
            "Pass it from ConversationService."
        )
    return ai


def _langsmith_meta(config: RunnableConfig, **extra: Any) -> dict[str, Any]:
    """Merge caller-level metadata with per-node extras for LangSmith tracing."""
    base: dict = config.get("metadata", {}) or {}
    return {**base, **extra}


def _stream_text(config: RunnableConfig, prompt, **kwargs) -> str:
    """
    Stream a TextPromptCatalog prompt token-by-token.

    If a queue.Queue is registered as `_token_queue` in config['configurable'],
    each token fragment is put on it immediately so the caller (running in the
    main thread) can forward it to the SSE client in real-time.

    Falls back to AIService.text() on any error so the conversation is never
    silently broken.
    """
    import queue as _queue_mod

    try:
        populated = prompt.with_data(**kwargs)
        model_name = populated.model_config.model
        messages = [
            SystemMessage(content=populated.get_system_prompt()),
            HumanMessage(content=populated.get_user_prompt()),
        ]
        llm = ChatOpenAI(model=model_name, streaming=True)
        token_queue: _queue_mod.Queue | None = (
            config.get("configurable", {}).get("_token_queue")
        )

        full_parts: list[str] = []
        for chunk in llm.stream(messages):
            text = chunk.content if isinstance(chunk.content, str) else ""
            if text:
                full_parts.append(text)
                if token_queue is not None:
                    token_queue.put(text)

        full_text = "".join(full_parts)
        if not full_text:
            raise ValueError("Empty response from streaming LLM")
        return full_text
    except Exception:
        logger.warning(
            "_stream_text fell back to AIService.text() for prompt %s",
            getattr(prompt, "name", "unknown"),
            exc_info=True,
        )
        return _ai(config).text(prompt, **kwargs)


# ── Nodes ─────────────────────────────────────────────────────────────────────

def router_node(
    state: CoachingState,
    config: RunnableConfig,
) -> Command[Literal["extract_answer", "resume_drafting"]]:
    """
    Entry point. Routes to the correct handling branch based on the current
    conversation step:
      - GAP_CONVERSATION → extract_answer (process user reply, then coach)
      - RESUME_GENERATION → resume_drafting (directly generate resume help)
    """
    step = state["current_step"]
    if step == ConversationStep.GAP_CONVERSATION.value:
        logger.debug("router: GAP_CONVERSATION → extract_answer")
        return Command(goto="extract_answer")

    logger.debug("router: %s → resume_drafting", step)
    return Command(goto="resume_drafting")


def extract_answer_node(
    state: CoachingState,
    config: RunnableConfig,
) -> dict:
    """
    Semantic gap extraction: asks the LLM which gaps in `state["gaps"]` are
    meaningfully addressed by the user's latest message.

    Returns the *remaining* gaps (not yet addressed) and a short answer summary
    that feeds into the resume-transition message if all gaps are covered.
    """
    if not state["gaps"]:
        # Already fully addressed — skip the LLM call.
        return {
            "gaps": [],
            "questions_remaining": 0,
            "answers": state["answers"] + [state["user_message"]],
        }

    gaps_text = "\n".join(f"- {g}" for g in state["gaps"])
    try:
        result = _ai(config).structured(
            extract_answer_prompt,
            langsmith_extra=_langsmith_meta(config, node="extract_answer"),
            gaps=gaps_text,
            user_message=state["user_message"],
        )
        remaining = result.remaining_gaps
        answer_summary = result.answer_summary
    except Exception:
        # Extraction failure is non-fatal: keep all gaps so the coach continues.
        logger.warning("extract_answer LLM call failed — keeping all gaps", exc_info=True)
        remaining = state["gaps"]
        answer_summary = state["user_message"][:200]

    logger.info(
        "extract_answer: %d/%d gaps remaining",
        len(remaining),
        len(state["gaps"]),
    )

    return {
        "gaps": remaining,
        "questions_remaining": len(remaining),
        "questions_asked": state["questions_asked"],
        "answers": state["answers"] + [answer_summary],
    }


def promote_memory_node(
    state: CoachingState,
    config: RunnableConfig,
) -> dict:
    """
    Checks whether the user's message contains general career information that
    should be promoted to their long-term memory (beyond this JD).

    On failure, logs a warning and returns an empty list — never breaks the flow.
    The caller is responsible for embedding and persisting the returned dicts.
    """
    existing_summary: str = config.get("configurable", {}).get(
        "existing_memory_summary", "None"
    )

    try:
        result = _ai(config).structured(
            memory_promotion_prompt,
            langsmith_extra=_langsmith_meta(config, node="promote_memory"),
            existing_memory_summary=existing_summary,
            user_message=state["user_message"],
        )

        if result.should_promote and result.memories:
            promoted = [
                {
                    "content": m.content,
                    "chunk_type": getattr(m, "chunk_type", "OTHER"),
                }
                for m in result.memories
            ]
            logger.info("promote_memory: %d memories queued for promotion", len(promoted))
            return {"newly_promoted_memories": promoted}

    except Exception:
        logger.warning(
            "promote_memory LLM call failed — promotion skipped",
            exc_info=True,
        )

    return {"newly_promoted_memories": []}


def step_transition_node(
    state: CoachingState,
) -> Command[Literal["gap_conversation", "resume_transition"]]:
    """
    Decides whether the conversation should stay in gap-filling mode or
    transition to resume-drafting. Pure logic — no LLM call.

      - gaps remain   → gap_conversation  (keep coaching)
      - no gaps left  → resume_transition (pivot to resume drafting)
    """
    if state["gaps"]:
        return Command(goto="gap_conversation")

    logger.info("step_transition: all gaps addressed → RESUME_GENERATION")
    return Command(
        update={"current_step": ConversationStep.RESUME_GENERATION.value},
        goto="resume_transition",
    )


def gap_conversation_node(
    state: CoachingState,
    config: RunnableConfig,
) -> dict:
    """
    Generates the next coaching message targeting remaining gaps.
    Uses the same `conversation_response_prompt` that was used before LangGraph,
    ensuring consistent voice and format.
    """
    gaps_text = (
        ", ".join(state["gaps"])
        if state["gaps"]
        else "None — ready to draft resume"
    )

    response = _stream_text(
        config,
        conversation_response_prompt,
        langsmith_extra=_langsmith_meta(config, node="gap_conversation"),
        company=state["jd_company"],
        role=state["jd_role"],
        labels=state["jd_labels"],
        required_skills=state["jd_required_skills"],
        gaps_remaining=gaps_text,
        jd_notes=state["jd_notes"],
        user_memories=state["user_memories"],
        company_research=state["company_research"] or "No company research available.",
        history=state["history"],
        user_message=state["user_message"],
    )

    return {"assistant_response": response}


def resume_transition_node(
    state: CoachingState,
    config: RunnableConfig,
) -> dict:
    """
    Generates a one-time pivot message when all gaps have been addressed.
    Acknowledges what was surfaced and offers to begin drafting the resume.
    """
    # Build a concise summary from the last 5 answers gathered during coaching.
    recent_answers = state["answers"][-5:] if state["answers"] else []
    answer_summary = (
        " | ".join(a[:120] for a in recent_answers)
        if recent_answers
        else "Various experiences and stories."
    )

    response = _stream_text(
        config,
        resume_transition_prompt,
        langsmith_extra=_langsmith_meta(config, node="resume_transition"),
        company=state["jd_company"],
        role=state["jd_role"],
        answer_summary=answer_summary,
    )

    return {"assistant_response": response}


def resume_drafting_node(
    state: CoachingState,
    config: RunnableConfig,
) -> dict:
    """
    Generates a resume-coaching response for conversations already in
    RESUME_GENERATION mode. Helps the user iterate on bullets and narratives.
    """
    response = _stream_text(
        config,
        resume_drafting_prompt,
        langsmith_extra=_langsmith_meta(config, node="resume_drafting"),
        company=state["jd_company"],
        role=state["jd_role"],
        labels=state["jd_labels"],
        required_skills=state["jd_required_skills"],
        jd_notes=state["jd_notes"],
        user_memories=state["user_memories"],
        history=state["history"],
        user_message=state["user_message"],
    )

    return {"assistant_response": response}


# ── Graph assembly ─────────────────────────────────────────────────────────────

def _build_graph() -> StateGraph:
    builder = StateGraph(CoachingState)

    # Nodes
    builder.add_node("router", router_node)
    builder.add_node("extract_answer", extract_answer_node)
    builder.add_node("promote_memory", promote_memory_node)
    builder.add_node("step_transition", step_transition_node)
    builder.add_node("gap_conversation", gap_conversation_node)
    builder.add_node("resume_transition", resume_transition_node)
    builder.add_node("resume_drafting", resume_drafting_node)

    # Static edges (sequential, unconditional)
    builder.add_edge(START, "router")
    # router → extract_answer | resume_drafting  (via Command — no add_edge)
    builder.add_edge("extract_answer", "promote_memory")
    builder.add_edge("promote_memory", "step_transition")
    # step_transition → gap_conversation | resume_transition  (via Command)
    builder.add_edge("gap_conversation", END)
    builder.add_edge("resume_transition", END)
    builder.add_edge("resume_drafting", END)

    return builder


# Compiled once at module load time (thread-safe after compilation).
coaching_graph = _build_graph().compile()
