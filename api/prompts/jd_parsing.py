from typing import ClassVar, Optional

from pydantic import BaseModel, Field

from prompts import BasePromptCatalog, ModelConfig


class JDRequirements(BaseModel):
    required_skills: list[str] = Field(
        description="Skills, tools, or technologies explicitly required for the role."
    )
    nice_to_have: list[str] = Field(
        description="Skills or experiences listed as preferred but not required."
    )
    years_required: Optional[int] = Field(
        default=None,
        description="Minimum years of experience required, if explicitly stated. Null if not mentioned.",
    )
    responsibilities: list[str] = Field(
        description="Key responsibilities or day-to-day expectations of the role."
    )
    language_requirements: list[str] = Field(
        default_factory=list,
        description="Languages required or preferred for the role, with proficiency level if stated (e.g. 'English - fluent', 'German - B2').",
    )
    visa_sponsorship: Optional[bool] = Field(
        default=None,
        description="True if the company explicitly offers visa sponsorship, False if explicitly excluded, null if not mentioned.",
    )
    perks: list[str] = Field(
        default_factory=list,
        description="Notable perks or benefits offered, e.g. 'remote-friendly', 'equity', 'relocation support', 'flexible hours', 'health insurance'.",
    )


class JDLabels(BaseModel):
    company_size: str = Field(
        description="Inferred company size: 'startup', 'scaleup', or 'enterprise'."
    )
    role_focus: str = Field(
        description="Primary focus of the role, e.g. 'backend', 'ml', 'fullstack', 'product', 'design'."
    )
    tech_depth: str = Field(
        description="Depth of technical work expected: 'high', 'medium', or 'low'."
    )
    domain: str = Field(
        description="Business domain or industry, e.g. 'fintech', 'healthtech', 'e-commerce', 'b2b saas'."
    )


class JDParsingOutput(BaseModel):
    company_name: Optional[str] = Field(
        default=None,
        description="Name of the hiring company, if mentioned in the JD. Null if not found.",
    )
    role_title: Optional[str] = Field(
        default=None,
        description="Exact job title as stated in the JD. Null if not found.",
    )
    requirements: JDRequirements
    labels: JDLabels


class JDParsingPrompt(BasePromptCatalog[JDParsingOutput]):
    name = "jd_parsing"
    description = "Parses a raw job description into structured requirements and labels."
    response_type = JDParsingOutput
    model_config = ModelConfig(model="gpt-4o-mini", temperature=0, reasoning_effort="low")

    system_instruction: ClassVar[str] = """\
<role>
You are an expert technical recruiter and job description analyst.
</role>

<objective>
Parse a raw job description into structured data that an AI coaching system will use
to detect skill gaps and generate tailored resumes.
</objective>

<instructions>
- Extract only what is explicitly stated. Do not infer or embellish.
- For required_skills: include hard skills, tools, languages, and frameworks that are listed as required or expected.
- For nice_to_have: include skills listed as "preferred", "bonus", "nice to have", or "a plus".
- For years_required: extract only if a specific number is stated (e.g. "5+ years"). Set to null otherwise.
- For responsibilities: use concise action-oriented phrases, one per item.
- For language_requirements: extract all language requirements or preferences, including proficiency level if stated. Empty list if none mentioned.
- For visa_sponsorship: set to true only if the JD explicitly offers sponsorship, false only if it explicitly states "no sponsorship" or "must have right to work". Null if unmentioned.
- For perks: extract concrete, candidate-relevant benefits. Ignore vague marketing language like "great culture" or "passionate team".
- For company_size: infer from signals like team size, stage (seed/series/public), headcount, or company description.
- For role_focus: pick the single best label that describes the primary technical or functional area.
- For tech_depth: judge based on seniority, scope of ownership, and technical complexity described.
- For domain: identify the business vertical from context clues (product, customers, industry mentioned).
</instructions>

<quality_bar>
Be precise and conservative. It is better to return fewer, accurate items than many noisy ones.
</quality_bar>
"""

    user_prompt_template: ClassVar[str] = """\
Parse the following job description.

<job_description>
{jd_text}
</job_description>
"""
