import logging
import os
from functools import lru_cache
from typing import Any, TypeVar, Union, cast

from langchain.agents import create_agent
from langchain.agents.middleware import ModelFallbackMiddleware
from langchain_core.runnables import RunnableConfig
from langchain_openai import OpenAIEmbeddings
from pydantic import BaseModel

from prompts import BasePromptCatalog, TextPromptCatalog

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


# ── Exceptions ────────────────────────────────────────────────────────────────

class AIServiceError(Exception):
    """Base exception for all AIService failures."""
    pass


class AIConfigurationError(AIServiceError):
    """Raised when required environment variables are missing at init time."""
    pass


class AIInferenceError(AIServiceError):
    """Raised when the LLM call fails after all fallbacks are exhausted."""
    pass


class AIOutputParsingError(AIServiceError):
    """Raised when the model returns output that doesn't match the expected schema."""
    pass


# ── Service ───────────────────────────────────────────────────────────────────

class AIService:

    def __init__(self) -> None:
        fallback_model = os.getenv("AI_FALLBACK_MODEL")
        if not fallback_model:
            raise AIConfigurationError("AI_FALLBACK_MODEL environment variable is not set.")

        self._fallback_middleware = [ModelFallbackMiddleware(f"openai:{fallback_model}")]
        # Embedder is held on the instance — one HTTP client for the lifetime of this object.
        self._embedder = OpenAIEmbeddings(model="text-embedding-3-small")

    def structured(
            self,
            prompt: BasePromptCatalog[T],
            tags: list[str] | None = None,
            langsmith_extra: dict[str, Any] | None = None,
            **kwargs,
    ) -> T:
        """Populate the prompt, invoke the agent, return a validated schema instance."""
        populated = prompt.with_data(**kwargs)
        messages = [
            ("system", populated.system_instruction),
            ("human", populated.get_user_prompt()),
        ]
        model = f"openai:{populated.model_config.model}"
        schema: type[T] = prompt.response_type

        try:
            agent = create_agent(
                model=model,
                tools=[],
                response_format=schema,
                middleware=self._fallback_middleware,
            )
            result = cast(dict, agent.invoke(
                {"messages": messages},
                config=RunnableConfig(
                    run_name=getattr(prompt, "name", schema.__name__),
                    tags=tags or [],
                    metadata=langsmith_extra or {},
                ),
            ))
        except Exception as e:
            logger.error(
                "LLM inference failed for prompt '%s': %s",
                getattr(prompt, "name", "unknown"), e,
                exc_info=True,
            )
            raise AIInferenceError(
                f"Agent call failed for schema {schema.__name__}: {e}"
            ) from e

        output = result.get("structured_response")
        if output is None:
            raise AIOutputParsingError(
                f"Agent returned no output for schema {schema.__name__}."
            )

        return cast(T, output)

    def text(
            self,
            prompt: Union[TextPromptCatalog, BasePromptCatalog],
            tags: list[str] | None = None,
            langsmith_extra: dict[str, Any] | None = None,
            **kwargs,
    ) -> str:
        """Populate the prompt, invoke the agent, return plain text."""
        populated = prompt.with_data(**kwargs)
        messages = [
            ("system", populated.system_instruction),
            ("human", populated.get_user_prompt()),
        ]
        model = f"openai:{populated.model_config.model}"

        try:
            agent = create_agent(
                model=model,
                tools=[],
                middleware=self._fallback_middleware,
            )
            result = cast(dict, agent.invoke(
                {"messages": messages},
                config=RunnableConfig(
                    run_name=getattr(prompt, "name", "text_call"),
                    tags=tags or [],
                    metadata=langsmith_extra or {},
                ),
            ))
        except Exception as e:
            logger.error(
                "LLM text call failed for prompt '%s': %s",
                getattr(prompt, "name", "unknown"), e,
                exc_info=True,
            )
            raise AIInferenceError(f"Agent call failed: {e}") from e

        messages_out = result.get("messages") or []
        if not messages_out:
            raise AIOutputParsingError("Agent returned no messages.")

        content = messages_out[-1].content
        if not isinstance(content, str):
            raise AIOutputParsingError(
                f"Expected string content, got {type(content).__name__}."
            )

        return content

    def embed(self, content: str) -> list[float]:
        try:
            return self._embedder.embed_query(content)
        except Exception as e:
            logger.error("Embedding call failed: %s", e, exc_info=True)
            raise AIInferenceError(f"Embedding failed: {e}") from e

    def embed_documents(self, content: list[str]) -> list[list[float]]:
        try:
            return self._embedder.embed_documents(content)
        except Exception as e:
            logger.error("Batch embedding call failed (%d docs): %s", len(content), e, exc_info=True)
            raise AIInferenceError(f"Batch embedding failed: {e}") from e


# ── Singleton factory ─────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_ai_service() -> AIService:
    """
    Application-scoped AIService singleton.
    lru_cache is thread-safe in CPython. Use via FastAPI's Depends():

        ai: AIService = Depends(get_ai_service)
    """
    return AIService()
