from typing import Literal

from pydantic import BaseModel, Field

from prompts import BasePromptCatalog, ModelConfig


class FitScoreOutput(BaseModel):
    score: int = Field(description="Overall fit score from 0 to 100.", ge=0, le=100)
    fit_level: Literal["strong", "moderate", "weak"] = Field(
        description="Qualitative label: strong (75+), moderate (50-74), weak (<50)."
    )
    strengths: list[str] = Field(
        description="3-5 specific ways the candidate is a strong match. Be concrete, not generic."
    )
    gaps: list[str] = Field(
        description="2-4 specific gaps or areas where the candidate is under-qualified or missing experience. Empty list if strong match."
    )
    recommendation: str = Field(
        description="1-2 sentence strategic recommendation: should they apply, what to address, how to position themselves."
    )


class FitScorePrompt(BasePromptCatalog[FitScoreOutput]):
    name = "fit_score"
    description = "Computes a 0-100 fit score between a JD and the user's background memories."
    response_type = FitScoreOutput
    model_config = ModelConfig(model="gpt-4o-mini", temperature=0.2)

    system_instruction = """\
You are a technical recruiter and hiring manager with 20 years of experience across
engineering, product, and leadership roles. You assess candidate fit objectively.

<jd>
Company: {company}
Role: {role}
Company size: {company_size} | Domain: {domain} | Role focus: {role_focus} | Tech depth: {tech_depth}

Required skills: {required_skills}
Nice to have: {nice_to_have}
Years required: {years_required}
Key responsibilities:
{responsibilities}
</jd>

<candidate_background>
{user_memories}
</candidate_background>

<scoring_guide>
- Score 85-100: Candidate meets or exceeds all key requirements. Ready to apply now.
- Score 65-84: Candidate meets most requirements with minor gaps. Strong application with right framing.
- Score 45-64: Candidate meets core requirements but has notable gaps. Worth applying with honest narrative.
- Score 25-44: Candidate is a stretch. Significant upskilling or reframing needed.
- Score 0-24: Poor fit. Would not typically pass an initial screening.

Be calibrated and honest. Do not inflate scores. Gaps are useful for the candidate.
</scoring_guide>
"""

    user_prompt_template = """\
Score this candidate's fit for the {role} role at {company}.
Use all the background information provided. Return structured JSON.
"""
