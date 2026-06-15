from typing import ClassVar

from pydantic import BaseModel, Field

from prompts import BasePromptCatalog, ModelConfig


class ExtractAnswerOutput(BaseModel):
    remaining_gaps: list[str] = Field(
        description=(
            "Gaps that are STILL unaddressed after the user's message. "
            "Copy verbatim from the input gaps list — do NOT rephrase. "
            "Omit any gap the user meaningfully addressed."
        )
    )
    answer_summary: str = Field(
        description=(
            "One-sentence summary of the key information the user shared. "
            "Used for internal logging and resume transition context."
        )
    )


class ExtractAnswerPrompt(BasePromptCatalog[ExtractAnswerOutput]):
    name = "extract_answer"
    description = (
        "Determines which skill gaps a user's message has addressed and returns "
        "the list of gaps that are still open."
    )
    response_type = ExtractAnswerOutput
    model_config = ModelConfig(model="gpt-4o-mini", temperature=0.0, reasoning_effort="low")

    system_instruction: ClassVar[str] = """\
<role>
You are analyzing a coaching conversation to track which skill gaps a job seeker
has addressed through their replies.
</role>

<definition>
A gap is "addressed" when the user's message provides:
- A concrete experience, project, or situation that demonstrates the skill, OR
- A clear statement of direct work with the technology or domain, OR
- A war story or example that shows relevant competency.

A gap is NOT addressed by:
- Generic claims without specifics ("I'm good at X")
- Tangentially related experiences that don't map to the gap
- The user saying they haven't done it
</definition>

<instructions>
- Only remove gaps that are genuinely covered by the user's message.
- When in doubt, keep the gap — it is better to ask a follow-up than to skip an important area.
- Return the remaining_gaps in the same order they appeared in the input.
- Keep exact wording from the input gaps — do not rephrase or consolidate.
</instructions>
"""

    user_prompt_template: ClassVar[str] = """\
Current unaddressed gaps (exact strings, do not rephrase):
{gaps}

User's message:
{user_message}

Identify which gaps above are now addressed and return the ones that are still open.
"""
