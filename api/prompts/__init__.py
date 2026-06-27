import copy
from abc import ABC
from dataclasses import dataclass
from typing import ClassVar, Generic, Literal, Optional, Type, TypeVar

from pydantic import BaseModel


class _SafeFormatDict(dict):
    """Returns ``{key}`` for any key not present in the mapping.

    Used with ``str.format_map()`` so that system instructions with
    placeholders that aren't supplied by a particular caller are left
    untouched rather than raising ``KeyError``.
    """
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"

T = TypeVar("T", bound=BaseModel)


@dataclass
class ModelConfig:
    model: Literal["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4o-mini"] = "gpt-5-mini"
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    reasoning_effort: Optional[Literal["low", "medium", "high"]] = None


# ── Structured-output prompts ──────────────────────────────────────────────

class BasePromptCatalog(ABC, Generic[T]):
    name: ClassVar[str]
    description: ClassVar[str]
    system_instruction: ClassVar[str]
    response_type: Type[T]
    user_prompt_template: ClassVar[str]
    model_config: ClassVar[ModelConfig] = ModelConfig(reasoning_effort="low")

    def __init__(self) -> None:
        self._user_prompt: str = ""
        self._system_prompt: str = ""

    def with_data(self, **kwargs) -> "BasePromptCatalog[T]":
        """Returns a populated copy. Never mutates the original singleton."""
        instance = copy.copy(self)
        instance._system_prompt = self.system_instruction.format_map(_SafeFormatDict(kwargs))
        instance._user_prompt = self.user_prompt_template.format_map(_SafeFormatDict(kwargs))
        return instance

    def get_system_prompt(self) -> str:
        return self._system_prompt or self.system_instruction

    def get_user_prompt(self) -> str:
        return self._user_prompt

    def __init_subclass__(cls, **kwargs: object) -> None:
        super().__init_subclass__(**kwargs)

        required_fields = ["name", "description", "system_instruction", "response_type"]
        missing = [f for f in required_fields if not hasattr(cls, f) or getattr(cls, f) is None]
        if missing:
            raise TypeError(
                f"{cls.__name__} must define the following required fields: {', '.join(missing)}"
            )

        if getattr(cls, "user_prompt_template", None) and not cls.system_instruction:
            raise TypeError(
                f"{cls.__name__} must define system_instruction if user_prompt_template is defined"
            )


# ── Text-only prompts ──────────────────────────────────────────────────────

class TextPromptCatalog(ABC):
    """
    Base class for prompts that return plain text (not structured output).
    Use with AIService.text(). No response_type needed.
    """
    name: ClassVar[str]
    description: ClassVar[str]
    system_instruction: ClassVar[str]
    user_prompt_template: ClassVar[str]
    model_config: ClassVar[ModelConfig] = ModelConfig()

    def __init__(self) -> None:
        self._user_prompt: str = ""
        self._system_prompt: str = ""

    def with_data(self, **kwargs) -> "TextPromptCatalog":
        """Returns a populated copy. Never mutates the original singleton."""
        instance = copy.copy(self)
        instance._system_prompt = self.system_instruction.format_map(_SafeFormatDict(kwargs))
        instance._user_prompt = self.user_prompt_template.format_map(_SafeFormatDict(kwargs))
        return instance

    def get_system_prompt(self) -> str:
        return self._system_prompt or self.system_instruction

    def get_user_prompt(self) -> str:
        return self._user_prompt


# ── Singletons (imported last to avoid circular deps) ─────────────────────

from prompts.memory_extraction import MemoryExtractionPrompt  # noqa: E402
from prompts.jd_parsing import JDParsingPrompt  # noqa: E402
from prompts.gap_detection import GapDetectionPrompt  # noqa: E402
from prompts.conversation_response import ConversationResponsePrompt  # noqa: E402
from prompts.memory_promotion import MemoryPromotionPrompt  # noqa: E402
from prompts.extract_answer import ExtractAnswerPrompt  # noqa: E402
from prompts.resume_drafting import ResumeDraftingPrompt  # noqa: E402
from prompts.resume_transition import ResumeTransitionPrompt  # noqa: E402
from prompts.resume_generation import ResumeGenerationPrompt  # noqa: E402
from prompts.cover_letter_generation import CoverLetterGenerationPrompt  # noqa: E402
from prompts.star_extraction import StarExtractionPrompt  # noqa: E402
from prompts.interview_coaching import InterviewCoachingPrompt  # noqa: E402
from prompts.fit_score import FitScorePrompt  # noqa: E402
from prompts.ats_score import ATSScorePrompt  # noqa: E402

memory_extraction_prompt = MemoryExtractionPrompt()
jd_parsing_prompt = JDParsingPrompt()
gap_detection_prompt = GapDetectionPrompt()
conversation_response_prompt = ConversationResponsePrompt()
memory_promotion_prompt = MemoryPromotionPrompt()
extract_answer_prompt = ExtractAnswerPrompt()
resume_drafting_prompt = ResumeDraftingPrompt()
resume_transition_prompt = ResumeTransitionPrompt()
resume_generation_prompt = ResumeGenerationPrompt()
cover_letter_generation_prompt = CoverLetterGenerationPrompt()
star_extraction_prompt = StarExtractionPrompt()
interview_coaching_prompt = InterviewCoachingPrompt()
fit_score_prompt = FitScorePrompt()
ats_score_prompt = ATSScorePrompt()
