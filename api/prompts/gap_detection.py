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
    model_config = ModelConfig(model="gpt-5-nano", temperature=0.5, reasoning_effort="low")

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
  - Be 3-5 sentences max. This is a coaching conversation, not a report.
  - The user's background comes from their uploaded CV — it was not shared in this conversation.
    Frame it as "Looking at your background..." or "Based on your CV..." — never as though the
    user just told you something or as if you have a prior relationship with them.
  - Briefly note 1-2 genuine strengths relative to this role (not hollow praise).
  - YOU decide which gap is most important to address first — do not ask the user to choose.
    Base your prioritization on JD labels (tech_depth, role_focus) and the user's weakest area.
    State clearly which area you're starting with and why (one phrase is enough).
  - End with one focused open question about that specific gap to kick off the conversation.
  - Sound like a real coach: direct, concise, no corporate speak.
  - Do not use the word "gap" — say "areas to explore" or similar.
  - No hollow affirmations. No "Great!" or "That's impressive!" openers.
</instructions>
"""

    user_prompt_template: ClassVar[str] = """\
Job Description:
- Company: {company}
- Role: {role}
- Labels: company_size={company_size}, role_focus={role_focus}, tech_depth={tech_depth}, domain={domain}
- Required skills: {required_skills}
- Responsibilities: {responsibilities}

Company research (public info about this company's engineering culture / tech stack):
{company_research}

Similar past applications by this user (for reference — may inform gap calibration):
{similar_jd_context}

User's most relevant career memories:
{memories}

Use the labels to calibrate gap severity (e.g. high tech_depth means technical gaps matter more;
product role_focus means product thinking gaps matter more than infra gaps).
Use company research to personalise the opening message — e.g. mention their known tech stack
or culture if it adds relevant context for the user.
Reference similar past applications only if they meaningfully reduce gaps or add context.

Identify gaps and write the opening coaching message.
"""
