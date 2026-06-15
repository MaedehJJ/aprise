from typing import ClassVar, Optional

from pydantic import BaseModel, Field

from prompts import BasePromptCatalog, ModelConfig


class MemoryToPromote(BaseModel):
    content: str = Field(
        description="The memory chunk to save, written in third person, factual, and concise."
    )
    chunk_type: str = Field(
        description=(
            "One of: EXPERIENCE, EDUCATION, SKILLS_SUMMARY, PROJECTS, LANGUAGES, "
            "WAR_STORY, PREFERENCE, OTHER"
        )
    )


class MemoryPromotionOutput(BaseModel):
    should_promote: bool = Field(
        description=(
            "True if the user's message contains information worth saving to general memory "
            "(a new skill, experience, preference, or war story not yet in their background)."
        )
    )
    memories: list[MemoryToPromote] = Field(
        default_factory=list,
        description="Memories to save. Empty if should_promote is false.",
    )


class MemoryPromotionPrompt(BasePromptCatalog[MemoryPromotionOutput]):
    name = "memory_promotion"
    description = "Determines if a conversation message contains general memory-worthy information."
    response_type = MemoryPromotionOutput
    model_config = ModelConfig(model="gpt-5-nano", temperature=0, reasoning_effort="low")

    system_instruction: ClassVar[str] = """\
<role>
You are a career memory extractor working alongside a coaching AI.
</role>

<objective>
Analyze a user message from a job coaching conversation. Decide whether it contains
information that is general to the user's career (not just relevant to the current JD)
and should be saved to their long-term memory profile.
</objective>

<instructions>
- Save to general memory when the user reveals:
  - A skill, tool, or technology not mentioned in their existing background
  - A notable experience, achievement, or project not captured in their CV memories
  - A clear preference (e.g. prefers async work, loves infra over product)
  - A reusable war story (a concrete challenge they solved)
- Do NOT save information that is purely a response to the JD's specific context
  (e.g. "yes I know Kubernetes" in a JD that asks for Kubernetes) unless it adds new detail.
- Write each memory chunk in third person, factual, and concise.
- Set should_promote = false if the message contains nothing new or general.
</instructions>
"""

    user_prompt_template: ClassVar[str] = """\
Existing user memory summary (to avoid duplicates):
{existing_memory_summary}

User's message in the coaching conversation:
{user_message}

Does this message contain new, general career information worth saving?
"""
