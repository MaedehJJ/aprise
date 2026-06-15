from typing import ClassVar

from pydantic import BaseModel, Field

from prompts import BasePromptCatalog, ModelConfig


class GapDetectionOutput(BaseModel):
    gaps: list[str] = Field(
        description="Required skills or experiences from the JD that are NOT covered in the user's memories."
    )
    covered: list[str] = Field(
        description="Required skills or experiences from the JD that ARE clearly covered in the user's memories."
    )
    initial_message: str = Field(
        description=(
            "Opening coaching message to the user. Warm but direct. Acknowledge what matches, "
            "name the gaps, and end with one focused question about the first gap."
        )
    )


class GapDetectionPrompt(BasePromptCatalog[GapDetectionOutput]):
    name = "gap_detection"
    description = "Detects skill gaps between a JD and the user's memories, and generates the opening coaching message."
    response_type = GapDetectionOutput
    model_config = ModelConfig(model="gpt-4o-mini", temperature=0.5, reasoning_effort="low")

    system_instruction: ClassVar[str] = """\
<role>
You are an expert career coach helping a job seeker tailor their application.
</role>

<objective>
Compare a job description's requirements against the user's career memories to identify gaps,
then write an opening coaching message that sets up a productive gap-filling conversation.
</objective>

<instructions>
- A "gap" is a required skill or responsibility that has no clear equivalent in the user's memories.
- A skill is "covered" when the user's memories demonstrate clear, direct experience with it.
- Be strict: do not mark something as covered unless the memory makes it explicit.
- For nice-to-have skills, ignore them in gaps — only required skills matter.
- The initial_message must:
  - Start by acknowledging what's strong in the user's background relative to this role.
  - Name 1-3 key gaps concisely (not a list dump).
  - End with one focused open question about the most important gap.
  - Sound like a real coach, not a form letter. Be conversational, warm, and direct.
  - Do not mention the word "gap" — instead say "areas to explore" or similar.
</instructions>
"""

    user_prompt_template: ClassVar[str] = """\
Job Description:
- Company: {company}
- Role: {role}
- Labels: company_size={company_size}, role_focus={role_focus}, tech_depth={tech_depth}, domain={domain}
- Required skills: {required_skills}
- Responsibilities: {responsibilities}

User's most relevant career memories:
{memories}

Use the labels to calibrate gap severity (e.g. high tech_depth means technical gaps matter more;
product role_focus means product thinking gaps matter more than infra gaps).

Identify gaps and write the opening coaching message.
"""
