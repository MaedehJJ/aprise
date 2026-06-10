import os
from typing import TypeVar, cast

from langchain.agents import create_agent
from langchain.agents.middleware import ModelFallbackMiddleware
from langchain_core.runnables import RunnableConfig
from langchain_openai import OpenAIEmbeddings
from pydantic import BaseModel

from prompts import BasePromptCatalog

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

    def structured(
            self,
            prompt: BasePromptCatalog[T],
            tags: list[str] | None = None,
            **kwargs,
    ) -> T:
        """Populate the prompt, invoke the agent, return a validated schema instance."""
        prompt.with_data(**kwargs)
        messages = [
            ("system", prompt.system_instruction),
            ("human", prompt.get_user_prompt()),
        ]
        model = f"openai:{prompt.model_config.model}"
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
                config=RunnableConfig(tags=tags or []),
            ))
        except Exception as e:
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
            prompt: BasePromptCatalog,
            tags: list[str] | None = None,
            **kwargs,
    ) -> str:
        """Populate the prompt, invoke the agent, return plain text."""
        prompt.with_data(**kwargs)
        messages = [
            ("system", prompt.system_instruction),
            ("human", prompt.get_user_prompt()),
        ]
        model = f"openai:{prompt.model_config.model}"

        try:
            agent = create_agent(
                model=model,
                tools=[],
                middleware=self._fallback_middleware,
            )
            result = cast(dict, agent.invoke(
                {"messages": messages},
                config=RunnableConfig(tags=tags or []),
            ))
        except Exception as e:
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

    def embed(
            self,
            content: str,
    ) -> list[float]:
        embedder = OpenAIEmbeddings(
            model="text-embedding-3-small",
            # With the `text-embedding-3-small` class
            # of models, you can specify the size
            # of the embeddings you want returned.
            # dimensions=1024
        )
        vectors = embedder.embed_query(content)
        return vectors

    def embed_documents(
            self,
            content: list[str],
    ) -> list[list[float]]:
        embedder = OpenAIEmbeddings(
            model="text-embedding-3-small",
            # With the `text-embedding-3-small` class
            # of models, you can specify the size
            # of the embeddings you want returned.
            # dimensions=1024
        )
        vectors = embedder.embed_documents(content)
        return vectors
