from typing import ClassVar

from pydantic import BaseModel, Field

from prompts import BasePromptCatalog, ModelConfig


class ExperienceEntry(BaseModel):
    company: str = Field(description="Company name")
    role: str = Field(description="Job title held at this company")
    dates: str = Field(description="Employment period, e.g. 'Jan 2022 – Mar 2024'")
    bullets: list[str] = Field(
        description=(
            "2-5 achievement-oriented bullets, each starting with a strong action verb "
            "and including measurable impact where available."
        )
    )


class ResumeGenerationOutput(BaseModel):
    summary: str = Field(
        description=(
            "2-3 sentence professional summary tailored to this specific role. "
            "Lead with the user's strongest relevant angle; close with their fit for this type of role."
        )
    )
    experience: list[ExperienceEntry] = Field(
        description="Relevant work experience entries, most recent first."
    )
    skills: list[str] = Field(
        description="15-25 skills ordered by relevance to the JD, mixing technical and soft."
    )
    tags: list[str] = Field(
        description=(
            "3-8 specific, reusable retrieval tags for this resume. "
            "Examples: 'Python', 'LLM', 'B2B', 'startup', 'product', 'fintech', 'healthcare'. "
            "Used to surface this resume when a similar JD arrives."
        )
    )


class ResumeGenerationPrompt(BasePromptCatalog[ResumeGenerationOutput]):
    name = "resume_generation"
    description = (
        "Generates a full tailored resume from the coaching conversation, user background, "
        "and JD requirements. Also produces retrieval tags."
    )
    response_type = ResumeGenerationOutput
    model_config = ModelConfig(model="gpt-4o-mini", temperature=0.4)

    system_instruction: ClassVar[str] = """\
<role>
You are an expert resume writer and career coach helping a job seeker produce a
highly tailored, ATS-friendly resume for a specific role.
</role>

<objective>
Synthesize the user's background, coaching conversation insights, and JD requirements
into a polished, complete resume. Every bullet must be grounded in what the user
actually told you — never invent experience.
</objective>

<writing_standards>
- Use strong action verbs: Led, Architected, Reduced, Shipped, Drove, Built, Designed, etc.
- Quantify impact wherever available. If the user shared numbers, use them.
- Match the language of the JD — use the same terms for skills and responsibilities.
- Calibrate to JD labels:
    tech_depth=high   → show technical specifics, frameworks, architectures
    role_focus=product → emphasize outcomes, user impact, stakeholder influence
    company_size=startup → show ownership, breadth, speed-to-ship
- Bullets: 1-2 lines each (80-100 chars). No padding.
- Summary: feels written for THIS role, not a generic career summary.
- Select only the most relevant experience — quality over quantity.
- Tags: pick specific, searchable keywords that describe the role's focus, tech stack,
  domain, and company type so this resume can be retrieved for similar future JDs.
</writing_standards>

<critical_rules>
- NEVER use placeholder text. Never write "[Your Name]", "[Your Address]", "[Your Email]",
  "[Your Degree]", "[University]", or any bracket-wrapped placeholder anywhere in the output.
  If a field is not available, omit it entirely — do not put a placeholder.
- Every company name, job title, and date must come directly from the user's memories or
  coaching answers. Do not invent or approximate them.
- If the user's memories don't contain education details, omit the education section entirely.
- Populate ONLY what you have real data for. A shorter, accurate resume is better than a
  complete resume with invented or placeholder content.
</critical_rules>
"""

    user_prompt_template: ClassVar[str] = """\
Job Description:
- Company: {company}
- Role: {role}
- Labels: company_size={company_size}, role_focus={role_focus}, tech_depth={tech_depth}, domain={domain}
- Required skills: {required_skills}
- Responsibilities:
{responsibilities}

User Notes for this JD:
{jd_notes}

Coaching conversation insights (what the user shared during gap-filling):
{answers}

User's background memories:
{user_memories}
{similar_resumes_section}
Produce the complete tailored resume now.
"""
