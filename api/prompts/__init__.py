from abc import ABC
from dataclasses import dataclass
from typing import ClassVar, Generic, Literal, Optional, Type, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


@dataclass
class ModelConfig:
    model: Literal["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4o-mini"] = "gpt-5-mini"
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    reasoning_effort: Optional[Literal["low", "medium", "high"]] = None


class BasePromptCatalog(ABC, Generic[T]):
    name: ClassVar[str]
    description: ClassVar[str]
    system_instruction: ClassVar[str]
    response_type: Type[T]
    user_prompt_template: ClassVar[str]
    model_config: ClassVar[ModelConfig] = ModelConfig(reasoning_effort="low")

    def __init__(self) -> None:
        self._user_prompt: str = ""

    def with_data(self, **kwargs) -> "BasePromptCatalog[T]":
        self._user_prompt = self.user_prompt_template.format(**kwargs)
        return self

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


from prompts.memory_extraction import MemoryExtractionPrompt  # noqa: E402

memory_extraction_prompt = MemoryExtractionPrompt()
